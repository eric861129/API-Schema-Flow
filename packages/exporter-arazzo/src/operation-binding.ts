import type { EndpointFlowNode } from '@api-schema-flow/domain'
import { DIAGNOSTIC_CODES, sortDiagnostics, type Diagnostic } from '@api-schema-flow/diagnostics'

import type {
  BindWorkflowPlanOperationsInput,
  BindWorkflowPlanOperationsResult,
  BoundWorkflowStep,
} from './contracts.js'

export function bindWorkflowPlanOperations(
  input: BindWorkflowPlanOperationsInput,
): BindWorkflowPlanOperationsResult {
  const diagnostics: Diagnostic[] = []
  const nodes = new Map(
    input.acceptedOperationGraph.nodes
      .filter((node): node is EndpointFlowNode => node.kind === 'endpoint')
      .map((node) => [node.id, node]),
  )
  const sources = new Map(input.openApiSources.map((source) => [source.sourceId, source]))
  const sourceDescriptions = new Map(
    input.workflowPlan.sourceDescriptions.map((source) => [source.sourceId, source]),
  )
  const steps: BoundWorkflowStep[] = []

  for (const [index, step] of input.workflowPlan.steps.entries()) {
    const sourcePointer = { uri: 'memory://workflow-plan', pointer: `#/steps/${index}` }
    const node = nodes.get(step.operationNodeId)
    if (node === undefined) {
      diagnostics.push({
        code: DIAGNOSTIC_CODES.EXPORT_OPERATION_BINDING_INVALID,
        severity: 'error',
        message: `Workflow step "${step.stepId}" does not reference an endpoint node.`,
        source: sourcePointer,
        details: { stepId: step.stepId, operationNodeId: step.operationNodeId },
      })
      continue
    }
    const source = sources.get(node.sourceId)
    const sourceDescription = sourceDescriptions.get(node.sourceId)
    if (source === undefined || sourceDescription === undefined) {
      diagnostics.push({
        code: DIAGNOSTIC_CODES.EXPORT_OPERATION_BINDING_INVALID,
        severity: 'error',
        message: `Workflow step "${step.stepId}" has no matching OpenAPI source description.`,
        source: sourcePointer,
        details: { stepId: step.stepId, sourceId: node.sourceId },
      })
      continue
    }
    const operations = source.document.operations.filter(({ id }) => id === node.operationKey)
    if (operations.length !== 1) {
      diagnostics.push({
        code: DIAGNOSTIC_CODES.EXPORT_OPERATION_BINDING_INVALID,
        severity: 'error',
        message: `Workflow step "${step.stepId}" operation binding is ${operations.length === 0 ? 'missing' : 'ambiguous'}.`,
        source: sourcePointer,
        details: {
          stepId: step.stepId,
          operationKey: node.operationKey,
          matches: operations.length,
        },
      })
      continue
    }
    steps.push({
      stepId: step.stepId,
      ...(step.description === undefined ? {} : { description: step.description }),
      node,
      operation: operations[0]!,
      source,
      sourceDescription,
    })
  }

  return { steps, diagnostics: sortDiagnostics(diagnostics) }
}
