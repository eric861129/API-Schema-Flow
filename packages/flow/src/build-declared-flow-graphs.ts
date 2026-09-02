import type { FlowEdge } from '@api-schema-flow/domain'
import { sortDiagnostics, type Diagnostic } from '@api-schema-flow/diagnostics'

import {
  endpointNodesForSources,
  projectArazzoWorkflowStructure,
} from './arazzo-workflow-projector.js'
import { assembleFlowGraph } from './graph-assembler.js'
import { createOperationGraphId, createWorkflowGraphId } from './canonical.js'
import type {
  ArazzoWorkflowGraphFragment,
  BuildDeclaredFlowGraphsInput,
  DeclaredFlowProjection,
} from './contracts.js'
import { projectOpenApiLinks } from './openapi-link-projector.js'

export function buildDeclaredFlowGraphs(
  input: BuildDeclaredFlowGraphsInput,
): DeclaredFlowProjection {
  const diagnostics: Diagnostic[] = []
  const operationNodes = [...endpointNodesForSources(input.openApiSources)]
  const operationEdges: FlowEdge[] = []

  for (const source of input.openApiSources) {
    const fragment = projectOpenApiLinks(source)
    operationEdges.push(...fragment.edges)
    diagnostics.push(...fragment.diagnostics)
  }

  const workflowFragments: ArazzoWorkflowGraphFragment[] = []
  for (const source of input.arazzoSources ?? []) {
    const projection = projectArazzoWorkflowStructure(source, input.openApiSources)
    operationEdges.push(...projection.operationEdges)
    workflowFragments.push(...projection.workflowFragments)
    diagnostics.push(...projection.diagnostics)
  }

  const operationAssembly = assembleFlowGraph({
    id: createOperationGraphId(input.openApiSources.map(({ sourceId }) => sourceId)),
    kind: 'operation-topology',
    title: 'Operation topology',
    sourceIds: input.openApiSources.map(({ sourceId }) => sourceId),
    nodes: operationNodes,
    edges: operationEdges,
  })
  diagnostics.push(...operationAssembly.diagnostics)

  const workflowGraphs = workflowFragments
    .map((fragment) => {
      const assembly = assembleFlowGraph({
        id: createWorkflowGraphId(fragment.sourceId, fragment.workflowId),
        kind: 'workflow-instance',
        title: fragment.title,
        sourceIds: [fragment.sourceId],
        nodes: fragment.nodes,
        edges: fragment.edges,
      })
      diagnostics.push(...fragment.diagnostics, ...assembly.diagnostics)
      return assembly.graph
    })
    .sort((left, right) => left.id.localeCompare(right.id))

  return {
    operationGraph: operationAssembly.graph,
    workflowGraphs,
    diagnostics: sortDiagnostics(diagnostics),
  }
}
