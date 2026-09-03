import { DIAGNOSTIC_CODES, sortDiagnostics, type Diagnostic } from '@api-schema-flow/diagnostics'

import {
  ARAZZO_WORKFLOW_PLAN_SCHEMA_VERSION,
  type ValidateArazzoWorkflowPlanInput,
  type ValidateArazzoWorkflowPlanResult,
} from './contracts.js'

function nonEmpty(value: string | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function duplicate(
  values: readonly string[],
  normalize: (value: string) => string = (value) => value,
): boolean {
  const seen = new Set<string>()
  for (const value of values) {
    const key = normalize(value)
    if (seen.has(key)) return true
    seen.add(key)
  }
  return false
}

export function validateArazzoWorkflowPlan(
  input: ValidateArazzoWorkflowPlanInput,
): ValidateArazzoWorkflowPlanResult {
  const diagnostics: Diagnostic[] = []
  const plan = input.workflowPlan
  const nodeIds = new Set(input.acceptedOperationGraph.nodes.map(({ id }) => id))
  const invalid = (message: string, pointer: string, details?: Record<string, unknown>) => {
    diagnostics.push({
      code: DIAGNOSTIC_CODES.EXPORT_WORKFLOW_PLAN_INVALID,
      severity: 'error',
      message,
      source: { uri: 'memory://workflow-plan', pointer },
      ...(details === undefined ? {} : { details }),
    })
  }

  if (plan.schemaVersion !== ARAZZO_WORKFLOW_PLAN_SCHEMA_VERSION) {
    invalid('Workflow plan must use schema version 1.0.', '#/schemaVersion')
  }
  if (!nonEmpty(plan.workflowId)) invalid('Workflow ID must not be empty.', '#/workflowId')
  if (input.acceptedOperationGraph.kind !== 'operation-topology') {
    invalid('Workflow plan requires an operation-topology graph.', '#')
  }
  if (plan.steps.length === 0) invalid('Workflow plan must contain at least one step.', '#/steps')
  if (duplicate(plan.steps.map(({ stepId }) => stepId))) {
    invalid('Workflow step IDs must be unique.', '#/steps')
  }
  if (duplicate(plan.sourceDescriptions.map(({ name }) => name))) {
    invalid('Source description names must be unique.', '#/sourceDescriptions')
  }
  if (duplicate(plan.sourceDescriptions.map(({ sourceId }) => sourceId))) {
    invalid('Source description source IDs must be unique.', '#/sourceDescriptions')
  }

  for (const [index, source] of plan.sourceDescriptions.entries()) {
    if (!nonEmpty(source.sourceId) || !nonEmpty(source.name) || !nonEmpty(source.url)) {
      invalid('Source description fields must not be empty.', `#/sourceDescriptions/${index}`)
    }
  }
  for (const [index, step] of plan.steps.entries()) {
    if (!nonEmpty(step.stepId) || !nonEmpty(step.operationNodeId)) {
      invalid('Workflow step fields must not be empty.', `#/steps/${index}`)
    } else if (!nodeIds.has(step.operationNodeId)) {
      invalid(
        `Workflow step "${step.stepId}" references a missing endpoint node.`,
        `#/steps/${index}`,
        {
          stepId: step.stepId,
          operationNodeId: step.operationNodeId,
        },
      )
    }
  }

  return diagnostics.length === 0
    ? { workflowPlan: plan, diagnostics: [] }
    : { diagnostics: sortDiagnostics(diagnostics) }
}
