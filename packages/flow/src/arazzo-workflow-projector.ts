import {
  resolveArazzoOperations,
  type NormalizedArazzoStep,
  type NormalizedArazzoWorkflow,
  type ResolvedArazzoOperation,
} from '@api-schema-flow/arazzo'
import {
  ACCEPTED_FLOW_STATUS,
  DECLARED_FLOW_PROVENANCE,
  appendSourcePointer,
  type EndpointFlowNode,
  type FlowDataMapping,
  type FlowEdge,
  type FlowValueTarget,
  type NormalizedOperation,
  type SourcePointer,
  type WorkflowStepFlowNode,
} from '@api-schema-flow/domain'
import { DIAGNOSTIC_CODES, sortDiagnostics, type Diagnostic } from '@api-schema-flow/diagnostics'

import { createEdgeId, createEndpointNodeId, createMappingId, createWorkflowStepNodeId } from './canonical.js'
import type {
  ArazzoProjectionResult,
  ArazzoWorkflowGraphFragment,
  FlowArazzoSource,
  FlowOpenApiSource,
  ArazzoStepOutputUse,
} from './contracts.js'
import {
  collectArazzoStepOutputUses,
  collectTargetedArazzoStepOutputUses,
  resolveArazzoStepOutputSelector,
} from './arazzo-value-projector.js'
import { createArazzoOperationCatalogs } from './operation-catalog.js'
import { arazzoParameterTarget } from './target-parameter.js'

interface BoundStepOperation {
  readonly source: FlowOpenApiSource
  readonly operation: NormalizedOperation
  readonly endpointNodeId: string
}

function relationEdge(
  kind: 'control' | 'dependency',
  sourceNodeId: string,
  targetNodeId: string,
  source: SourcePointer,
): FlowEdge {
  return {
    id: createEdgeId(kind, sourceNodeId, targetNodeId, []),
    kind,
    sourceNodeId,
    targetNodeId,
    provenance: DECLARED_FLOW_PROVENANCE,
    status: ACCEPTED_FLOW_STATUS,
    mappings: [],
    sourceStandardRefs: [{ standard: 'arazzo', source }],
  }
}

function dataEdge(
  sourceNodeId: string,
  targetNodeId: string,
  mapping: FlowDataMapping,
  source: SourcePointer,
): FlowEdge {
  return {
    id: createEdgeId('data', sourceNodeId, targetNodeId, [mapping]),
    kind: 'data',
    sourceNodeId,
    targetNodeId,
    provenance: DECLARED_FLOW_PROVENANCE,
    status: ACCEPTED_FLOW_STATUS,
    mappings: [mapping],
    sourceStandardRefs: [{ standard: 'arazzo', source }],
  }
}

function resolutionDiagnostic(
  resolution: ResolvedArazzoOperation,
  step: NormalizedArazzoStep,
): Diagnostic | undefined {
  switch (resolution.status) {
    case 'missing':
      return {
        code: DIAGNOSTIC_CODES.FLOW_OPERATION_BINDING_MISSING,
        severity: 'error',
        message: `Arazzo step "${step.stepId}" operation binding is missing.`,
        source: step.source,
        details: { workflowId: resolution.workflowId, stepId: resolution.stepId },
      }
    case 'ambiguous':
      return {
        code: DIAGNOSTIC_CODES.FLOW_OPERATION_BINDING_AMBIGUOUS,
        severity: 'error',
        message: `Arazzo step "${step.stepId}" operation binding is ambiguous.`,
        source: step.source,
        details: {
          workflowId: resolution.workflowId,
          stepId: resolution.stepId,
          candidates: resolution.candidates ?? [],
        },
      }
    case 'type-mismatch':
    case 'preserve-only':
      return {
        code: DIAGNOSTIC_CODES.FLOW_PROJECTION_UNSUPPORTED,
        severity: 'error',
        message: `Arazzo step "${step.stepId}" target cannot be projected into an OpenAPI flow graph.`,
        source: step.source,
        details: {
          workflowId: resolution.workflowId,
          stepId: resolution.stepId,
          status: resolution.status,
        },
      }
    case 'resolved':
      return undefined
  }
}

function bindResolution(
  resolution: ResolvedArazzoOperation | undefined,
  openApiSources: readonly FlowOpenApiSource[],
): BoundStepOperation | undefined {
  if (
    resolution?.status !== 'resolved' ||
    resolution.sourceName === undefined ||
    resolution.operationKey === undefined
  ) {
    return undefined
  }
  const matchingSources = openApiSources.filter(
    ({ sourceName }) => sourceName === resolution.sourceName,
  )
  if (matchingSources.length !== 1) return undefined
  const source = matchingSources[0]!
  const operation = source.document.operations.find(
    ({ id }) => id === resolution.operationKey,
  )
  if (operation === undefined) return undefined
  return {
    source,
    operation,
    endpointNodeId: createEndpointNodeId(source.sourceId, operation.id),
  }
}

function workflowNode(
  source: FlowArazzoSource,
  workflow: NormalizedArazzoWorkflow,
  step: NormalizedArazzoStep,
  binding: BoundStepOperation | undefined,
): WorkflowStepFlowNode {
  const target = step.targets[0]
  return {
    kind: 'workflow-step',
    id: createWorkflowStepNodeId(source.sourceId, workflow.workflowId, step.stepId),
    sourceId: source.sourceId,
    workflowId: workflow.workflowId,
    stepId: step.stepId,
    ...(binding === undefined ? {} : { operationKey: binding.operation.id }),
    ...(target?.type === 'operationId' ? { operationId: target.operationId } : {}),
    ...(target?.type === 'operationPath' ? { operationPath: target.operationPath } : {}),
    source: step.source,
  }
}

function mapResolutionByStep(
  resolutions: readonly ResolvedArazzoOperation[],
): Map<string, ResolvedArazzoOperation> {
  const result = new Map<string, ResolvedArazzoOperation>()
  for (const resolution of resolutions) {
    const key = `${resolution.workflowId}\u0000${resolution.stepId}`
    if (!result.has(key)) result.set(key, resolution)
  }
  return result
}

function bindingKey(workflowId: string, stepId: string): string {
  return `${workflowId}\u0000${stepId}`
}

function targetMapping(
  workflow: NormalizedArazzoWorkflow,
  use: ArazzoStepOutputUse,
  target: FlowValueTarget,
  diagnostics: Diagnostic[],
): FlowDataMapping | undefined {
  const resolved = resolveArazzoStepOutputSelector(
    workflow,
    use.stepId,
    use.outputName,
  )
  diagnostics.push(...resolved.diagnostics)
  if (resolved.selector === undefined) return undefined
  if (resolved.transform !== undefined && use.transform !== undefined) {
    diagnostics.push({
      code: DIAGNOSTIC_CODES.FLOW_PROJECTION_UNSUPPORTED,
      severity: 'error',
      message: `Arazzo mapping from "${use.stepId}.${use.outputName}" requires compound transforms.`,
      source: use.source,
      details: {
        workflowId: workflow.workflowId,
        stepId: use.stepId,
        outputName: use.outputName,
      },
    })
    return undefined
  }
  const transform = use.transform ?? resolved.transform
  return {
    id: createMappingId(resolved.selector, target, transform),
    source: resolved.selector,
    target,
    aliases: [
      {
        kind: 'step-output',
        workflowId: workflow.workflowId,
        stepId: use.stepId,
        outputName: use.outputName,
      },
    ],
    ...(transform === undefined ? {} : { transform }),
    sourcePointers: [...resolved.sourcePointers, use.source],
  }
}

function appendMappingEdges(
  workflow: NormalizedArazzoWorkflow,
  sourceStep: NormalizedArazzoStep | undefined,
  targetStep: NormalizedArazzoStep,
  use: ArazzoStepOutputUse,
  target: FlowValueTarget,
  workflowNodes: ReadonlyMap<string, WorkflowStepFlowNode>,
  bindings: ReadonlyMap<string, BoundStepOperation>,
  workflowEdges: FlowEdge[],
  operationEdges: FlowEdge[],
  diagnostics: Diagnostic[],
): void {
  if (sourceStep === undefined) {
    diagnostics.push({
      code: DIAGNOSTIC_CODES.FLOW_WORKFLOW_REFERENCE_MISSING,
      severity: 'error',
      message: `Arazzo step "${targetStep.stepId}" references missing step "${use.stepId}".`,
      source: use.source,
      details: {
        workflowId: workflow.workflowId,
        targetStepId: targetStep.stepId,
        sourceStepId: use.stepId,
      },
    })
    return
  }
  const mapping = targetMapping(workflow, use, target, diagnostics)
  if (mapping === undefined) return

  const sourceNode = workflowNodes.get(sourceStep.stepId)
  const targetNode = workflowNodes.get(targetStep.stepId)
  if (sourceNode === undefined || targetNode === undefined) return
  workflowEdges.push(dataEdge(sourceNode.id, targetNode.id, mapping, use.source))

  const sourceBinding = bindings.get(bindingKey(workflow.workflowId, sourceStep.stepId))
  const targetBinding = bindings.get(bindingKey(workflow.workflowId, targetStep.stepId))
  if (sourceBinding !== undefined && targetBinding !== undefined) {
    operationEdges.push(
      dataEdge(
        sourceBinding.endpointNodeId,
        targetBinding.endpointNodeId,
        mapping,
        use.source,
      ),
    )
  }
}

export function projectArazzoWorkflowStructure(
  source: FlowArazzoSource,
  openApiSources: readonly FlowOpenApiSource[],
): ArazzoProjectionResult {
  const diagnostics: Diagnostic[] = []
  const catalogs = createArazzoOperationCatalogs(openApiSources)
  const resolutionResult = resolveArazzoOperations(
    source.document,
    catalogs,
    source.retrievalUri,
  )
  const resolutionByStep = mapResolutionByStep(resolutionResult.resolutions)
  const bindings = new Map<string, BoundStepOperation>()
  const operationEdges: FlowEdge[] = []
  const workflowFragments: ArazzoWorkflowGraphFragment[] = []

  for (const workflow of source.document.workflows) {
    const workflowNodes = new Map<string, WorkflowStepFlowNode>()
    for (const step of workflow.steps) {
      const key = bindingKey(workflow.workflowId, step.stepId)
      const resolution = resolutionByStep.get(key)
      const binding = bindResolution(resolution, openApiSources)
      if (resolution !== undefined) {
        const diagnostic = resolutionDiagnostic(resolution, step)
        if (diagnostic !== undefined) diagnostics.push(diagnostic)
      } else {
        diagnostics.push({
          code: DIAGNOSTIC_CODES.FLOW_OPERATION_BINDING_MISSING,
          severity: 'error',
          message: `Arazzo step "${step.stepId}" has no operation resolution.`,
          source: step.source,
          details: { workflowId: workflow.workflowId, stepId: step.stepId },
        })
      }
      if (binding !== undefined) bindings.set(key, binding)
      workflowNodes.set(step.stepId, workflowNode(source, workflow, step, binding))
    }

    const workflowEdges: FlowEdge[] = []
    for (let index = 1; index < workflow.steps.length; index += 1) {
      const previous = workflow.steps[index - 1]!
      const current = workflow.steps[index]!
      const previousNode = workflowNodes.get(previous.stepId)!
      const currentNode = workflowNodes.get(current.stepId)!
      workflowEdges.push(relationEdge('control', previousNode.id, currentNode.id, current.source))

      const previousBinding = bindings.get(bindingKey(workflow.workflowId, previous.stepId))
      const currentBinding = bindings.get(bindingKey(workflow.workflowId, current.stepId))
      if (previousBinding !== undefined && currentBinding !== undefined) {
        operationEdges.push(
          relationEdge(
            'control',
            previousBinding.endpointNodeId,
            currentBinding.endpointNodeId,
            current.source,
          ),
        )
      }
    }

    for (const targetStep of workflow.steps) {
      const targetNode = workflowNodes.get(targetStep.stepId)!
      targetStep.dependsOn.forEach((dependency, index) => {
        const sourceStep = workflow.steps.find(({ stepId }) => stepId === dependency)
        if (sourceStep === undefined) {
          diagnostics.push({
            code: DIAGNOSTIC_CODES.FLOW_WORKFLOW_REFERENCE_MISSING,
            severity: 'error',
            message: `Arazzo step "${targetStep.stepId}" depends on missing step "${dependency}".`,
            source: appendSourcePointer(targetStep.source, ['dependsOn', String(index)]),
            details: {
              workflowId: workflow.workflowId,
              stepId: targetStep.stepId,
              dependency,
            },
          })
          return
        }
        const sourceNode = workflowNodes.get(sourceStep.stepId)!
        const relationSource = appendSourcePointer(targetStep.source, ['dependsOn', String(index)])
        workflowEdges.push(
          relationEdge('dependency', sourceNode.id, targetNode.id, relationSource),
        )

        const sourceBinding = bindings.get(bindingKey(workflow.workflowId, sourceStep.stepId))
        const targetBinding = bindings.get(bindingKey(workflow.workflowId, targetStep.stepId))
        if (sourceBinding !== undefined && targetBinding !== undefined) {
          operationEdges.push(
            relationEdge(
              'dependency',
              sourceBinding.endpointNodeId,
              targetBinding.endpointNodeId,
              relationSource,
            ),
          )
        }
      })

      for (const parameter of targetStep.parameters) {
        const uses = collectArazzoStepOutputUses(parameter.value)
        const target = arazzoParameterTarget(parameter.location, parameter.name)
        if (target === undefined && uses.length > 0) {
          diagnostics.push({
            code: DIAGNOSTIC_CODES.FLOW_DATA_MAPPING_INVALID,
            severity: 'error',
            message: `Arazzo parameter location "${parameter.location}" cannot be projected.`,
            source: parameter.source,
            details: {
              workflowId: workflow.workflowId,
              stepId: targetStep.stepId,
              parameterName: parameter.name,
              parameterLocation: parameter.location,
            },
          })
          continue
        }
        if (target === undefined) continue
        for (const use of uses) {
          const sourceStep = workflow.steps.find(({ stepId }) => stepId === use.stepId)
          appendMappingEdges(
            workflow,
            sourceStep,
            targetStep,
            use,
            target,
            workflowNodes,
            bindings,
            workflowEdges,
            operationEdges,
            diagnostics,
          )
        }
      }

      if (targetStep.requestBody !== undefined) {
        const uses = collectTargetedArazzoStepOutputUses(targetStep.requestBody.payload)
        for (const use of uses) {
          const sourceStep = workflow.steps.find(({ stepId }) => stepId === use.stepId)
          appendMappingEdges(
            workflow,
            sourceStep,
            targetStep,
            use,
            { kind: 'request-body', pointer: use.targetPointer },
            workflowNodes,
            bindings,
            workflowEdges,
            operationEdges,
            diagnostics,
          )
        }
      }
    }

    workflowFragments.push({
      sourceId: source.sourceId,
      workflowId: workflow.workflowId,
      title: workflow.summary ?? workflow.workflowId,
      nodes: [...workflowNodes.values()],
      edges: workflowEdges,
      diagnostics: [],
    })
  }

  return {
    workflowFragments: workflowFragments.sort((left, right) =>
      left.workflowId.localeCompare(right.workflowId),
    ),
    operationEdges,
    diagnostics: sortDiagnostics(diagnostics),
  }
}

export function endpointNodesForSources(
  sources: readonly FlowOpenApiSource[],
): readonly EndpointFlowNode[] {
  return sources
    .flatMap((source) =>
      source.document.operations.map((operation): EndpointFlowNode => ({
        kind: 'endpoint',
        id: createEndpointNodeId(source.sourceId, operation.id),
        sourceId: source.sourceId,
        operationKey: operation.id,
        method: operation.method,
        path: operation.path,
        ...(operation.operationId === undefined ? {} : { operationId: operation.operationId }),
        ...(operation.summary === undefined ? {} : { summary: operation.summary }),
        source: operation.source,
      })),
    )
    .sort((left, right) => left.id.localeCompare(right.id))
}
