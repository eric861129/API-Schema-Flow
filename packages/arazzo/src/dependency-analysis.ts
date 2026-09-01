import { sortDiagnostics, type Diagnostic } from '@api-schema-flow/diagnostics'

import type {
  NormalizedArazzoAction,
  NormalizedArazzoCriterion,
  NormalizedArazzoStep,
  NormalizedArazzoValue,
  NormalizedArazzoWorkflow,
} from './model.js'
import type { RuntimeExpression } from './runtime-expression.js'

export interface ArazzoStepDependencySummary {
  readonly stepId: string
  readonly explicit: readonly string[]
  readonly implicit: readonly string[]
  readonly all: readonly string[]
  readonly forward: readonly string[]
  readonly missing: readonly string[]
}

export interface ArazzoWorkflowDependencyAnalysis {
  readonly workflowId: string
  readonly steps: readonly ArazzoStepDependencySummary[]
  readonly order: readonly string[]
  readonly hasCycle: boolean
  readonly diagnostics: readonly Diagnostic[]
}

interface StepOutputReference {
  readonly stepId: string
  readonly outputName: string
  readonly source: RuntimeExpression['source']
}

function visitExpression(expression: RuntimeExpression, references: StepOutputReference[]): void {
  if (expression.kind === 'step-output') {
    references.push({
      stepId: expression.stepId,
      outputName: expression.outputName,
      source: expression.source,
    })
  }
}

function visitValue(value: NormalizedArazzoValue, references: StepOutputReference[]): void {
  switch (value.kind) {
    case 'expression':
      visitExpression(value.expression, references)
      return
    case 'template':
      for (const segment of value.template.segments) {
        if (segment.kind === 'expression') visitExpression(segment.expression, references)
      }
      return
    case 'array':
      for (const item of value.items) visitValue(item, references)
      return
    case 'object':
      for (const nested of Object.values(value.properties)) visitValue(nested, references)
      return
    case 'literal':
      return
  }
}

function visitCriteria(
  criteria: readonly NormalizedArazzoCriterion[],
  references: StepOutputReference[],
): void {
  for (const criterion of criteria) visitValue(criterion.condition, references)
}

function visitActions(
  actions: readonly NormalizedArazzoAction[],
  references: StepOutputReference[],
): void {
  for (const action of actions) visitCriteria(action.criteria, references)
}

function stepOutputReferences(step: NormalizedArazzoStep): readonly StepOutputReference[] {
  const references: StepOutputReference[] = []
  for (const parameter of step.parameters) visitValue(parameter.value, references)
  if (step.requestBody) visitValue(step.requestBody.payload, references)
  for (const output of Object.values(step.outputs)) visitValue(output, references)
  visitCriteria(step.successCriteria, references)
  visitActions(step.onSuccess, references)
  visitActions(step.onFailure, references)
  return references
}

function stableUnique(values: readonly string[]): string[] {
  return [...new Set(values)].sort()
}

export function analyzeWorkflowDependencies(
  workflow: NormalizedArazzoWorkflow,
): ArazzoWorkflowDependencyAnalysis {
  const diagnostics: Diagnostic[] = []
  const stepIndexes = new Map<string, number>()
  const stepsById = new Map<string, NormalizedArazzoStep>()
  workflow.steps.forEach((step, index) => {
    if (!stepIndexes.has(step.stepId)) stepIndexes.set(step.stepId, index)
    if (!stepsById.has(step.stepId)) stepsById.set(step.stepId, step)
  })

  const summaries: ArazzoStepDependencySummary[] = []
  const graphDependencies = new Map<string, Set<string>>()

  for (const [index, step] of workflow.steps.entries()) {
    const explicit = stableUnique(step.dependsOn)
    const references = stepOutputReferences(step)
    const implicit = stableUnique(references.map(({ stepId }) => stepId))
    const all = stableUnique([...explicit, ...implicit])
    const missing = all.filter((dependency) => !stepIndexes.has(dependency))
    const forward = all.filter((dependency) => {
      const targetIndex = stepIndexes.get(dependency)
      return targetIndex !== undefined && targetIndex > index
    })

    for (const dependency of missing) {
      diagnostics.push({
        code: 'ASF-ARZ-1008',
        severity: 'error',
        message: `Step "${step.stepId}" depends on missing step "${dependency}".`,
        source: step.source,
        details: { workflowId: workflow.workflowId, stepId: step.stepId, dependency },
      })
    }

    for (const reference of references) {
      const referencedStep = stepsById.get(reference.stepId)
      if (referencedStep && !Object.hasOwn(referencedStep.outputs, reference.outputName)) {
        diagnostics.push({
          code: 'ASF-ARZ-1011',
          severity: 'error',
          message: `Step "${step.stepId}" references missing output "${reference.outputName}" on step "${reference.stepId}".`,
          ...(reference.source === undefined
            ? { source: step.source }
            : { source: reference.source }),
          details: {
            workflowId: workflow.workflowId,
            stepId: step.stepId,
            referencedStepId: reference.stepId,
            outputName: reference.outputName,
          },
        })
      }
    }

    for (const dependency of forward) {
      diagnostics.push({
        code: 'ASF-ARZ-1012',
        severity: 'warning',
        message: `Step "${step.stepId}" references later step "${dependency}".`,
        source: step.source,
        details: { workflowId: workflow.workflowId, stepId: step.stepId, dependency },
      })
    }

    summaries.push({ stepId: step.stepId, explicit, implicit, all, forward, missing })
    const graphValues = [
      ...explicit.filter((dependency) => stepIndexes.has(dependency)),
      ...implicit.filter(
        (dependency) => stepIndexes.has(dependency) && !forward.includes(dependency),
      ),
    ]
    graphDependencies.set(step.stepId, new Set(graphValues))
  }

  const order: string[] = []
  const completed = new Set<string>()
  let advanced = true
  while (advanced) {
    advanced = false
    for (const step of workflow.steps) {
      if (completed.has(step.stepId)) continue
      const dependencies = graphDependencies.get(step.stepId) ?? new Set<string>()
      if ([...dependencies].every((dependency) => completed.has(dependency))) {
        completed.add(step.stepId)
        order.push(step.stepId)
        advanced = true
      }
    }
  }

  const cyclic = workflow.steps
    .map(({ stepId }) => stepId)
    .filter((stepId) => !completed.has(stepId))
  if (cyclic.length > 0) {
    diagnostics.push({
      code: 'ASF-ARZ-1009',
      severity: 'error',
      message: `Workflow "${workflow.workflowId}" contains a dependency cycle.`,
      source: workflow.source,
      details: { workflowId: workflow.workflowId, stepIds: stableUnique(cyclic) },
    })
  }

  return {
    workflowId: workflow.workflowId,
    steps: summaries,
    order,
    hasCycle: cyclic.length > 0,
    diagnostics: sortDiagnostics(diagnostics),
  }
}
