import type { FlowGraph, NormalizedOperation } from '@api-schema-flow/domain'
import type { ArazzoExportArtifact } from '@api-schema-flow/exporter-arazzo'
import { exportArazzo } from '@api-schema-flow/exporter-arazzo'

import type { WorkspaceSnapshot } from '../data/types'
import type { WorkflowDraft } from './workflow-draft'

function blocked(message: string): ArazzoExportArtifact {
  return {
    fileName: '',
    mediaType: 'application/json',
    contents: '',
    contentHash: '',
    diagnostics: [
      {
        code: 'ASF-WEB-WORKFLOW-1001',
        severity: 'error',
        message,
        source: { uri: 'memory://workflow-draft', pointer: '#' },
      },
    ],
  }
}

/** 預覽只投影使用者選取且目前仍已接受的欄位映射。 */
export async function exportWorkflowDraft(
  snapshot: WorkspaceSnapshot,
  acceptedGraph: FlowGraph,
  draft: WorkflowDraft,
  format: 'json' | 'yaml',
): Promise<ArazzoExportArtifact> {
  if (!draft.sourceUrl.trim()) return blocked('OpenAPI source URL is required.')
  const operations = new Map(
    snapshot.apiDocument.operations.map((operation) => [operation.id, operation]),
  )
  const sourceId = snapshot.project.sourceUri
  const nodes: FlowGraph['nodes'] = acceptedGraph.nodes.map((node) => {
    if (node.kind !== 'endpoint') return node
    const operation: NormalizedOperation | undefined = operations.get(node.operationKey)
    return {
      ...node,
      sourceId,
      method: operation?.method ?? node.method,
      path: operation?.path ?? node.path,
      ...(operation?.operationId ? { operationId: operation.operationId } : {}),
    }
  })
  const indexes = new Map(draft.steps.map((step, index) => [step.operationNodeId, index]))
  const selections = new Map<string, Set<string>>()
  for (const selected of draft.selectedMappings) {
    const edge = acceptedGraph.edges.find((item) => item.id === selected.edgeId)
    if (
      !edge ||
      edge.status !== 'accepted' ||
      edge.kind !== 'data' ||
      !edge.mappings.some((mapping) => mapping.id === selected.mappingId)
    )
      return blocked('A selected data mapping is no longer accepted. Review the workflow bindings.')
    const sourceIndex = indexes.get(edge.sourceNodeId)
    const targetIndex = indexes.get(edge.targetNodeId)
    if (sourceIndex === undefined || targetIndex === undefined || sourceIndex >= targetIndex)
      return blocked('A selected data mapping must connect an earlier step to a later step.')
    selections.set(edge.id, new Set([...(selections.get(edge.id) ?? []), selected.mappingId]))
  }
  const graph: FlowGraph = {
    ...acceptedGraph,
    nodes,
    edges: acceptedGraph.edges.flatMap((edge) => {
      const ids = selections.get(edge.id)
      if (!ids) return []
      return [{ ...edge, mappings: edge.mappings.filter((mapping) => ids.has(mapping.id)) }]
    }),
  }
  return exportArazzo({
    title: snapshot.apiDocument.info.title || snapshot.project.name,
    version: snapshot.apiDocument.info.version || '1.0.0',
    format,
    workflowPlan: {
      schemaVersion: '1.0',
      workflowId: draft.workflowId,
      ...(draft.summary.trim() ? { summary: draft.summary.trim() } : {}),
      sourceDescriptions: [{ sourceId, name: 'api', url: draft.sourceUrl.trim() }],
      steps: draft.steps,
    },
    openApiSources: [
      { sourceId, sourceName: snapshot.project.sourceName, document: snapshot.apiDocument },
    ],
    acceptedOperationGraph: graph,
  })
}
