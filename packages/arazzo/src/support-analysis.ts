import type { SourcePointer } from '@api-schema-flow/domain'

import type {
  NormalizedArazzoAction,
  NormalizedArazzoCriterion,
  NormalizedArazzoDocument,
  NormalizedArazzoStep,
  NormalizedArazzoWorkflow,
} from './model.js'
import { validateArazzoDocument } from './semantic-validation.js'

export type ArazzoSupportLevel = 'supported' | 'preserve-only' | 'invalid'

export interface ArazzoFeatureSupport {
  readonly feature: string
  readonly level: ArazzoSupportLevel
  readonly reason: string
  readonly source?: SourcePointer
  readonly workflowId?: string
  readonly stepId?: string
}

export interface ArazzoWorkflowSupport {
  readonly workflowId: string
  readonly level: ArazzoSupportLevel
  readonly features: readonly ArazzoFeatureSupport[]
}

export interface ArazzoSupportReport {
  readonly level: ArazzoSupportLevel
  readonly summary: Readonly<Record<ArazzoSupportLevel extends never ? never : string, number>> & {
    readonly supported: number
    readonly preserveOnly: number
    readonly invalid: number
  }
  readonly features: readonly ArazzoFeatureSupport[]
  readonly workflows: readonly ArazzoWorkflowSupport[]
}

function feature(
  name: string,
  level: ArazzoSupportLevel,
  reason: string,
  source?: SourcePointer,
  workflowId?: string,
  stepId?: string,
): ArazzoFeatureSupport {
  return {
    feature: name,
    level,
    reason,
    ...(source === undefined ? {} : { source }),
    ...(workflowId === undefined ? {} : { workflowId }),
    ...(stepId === undefined ? {} : { stepId }),
  }
}

function preservedFeatures(
  preservedFields: Readonly<Record<string, unknown>>,
  source: SourcePointer,
  workflowId?: string,
  stepId?: string,
): ArazzoFeatureSupport[] {
  return Object.keys(preservedFields)
    .sort()
    .map((fieldName) =>
      feature(
        'unknown-field',
        'preserve-only',
        `Field "${fieldName}" is preserved but not interpreted in M2-A.`,
        source,
        workflowId,
        stepId,
      ),
    )
}

function criterionFeatures(
  criteria: readonly NormalizedArazzoCriterion[],
  workflowId: string,
  stepId: string,
): ArazzoFeatureSupport[] {
  return criteria.flatMap((criterion) => {
    const type = criterion.type?.toLowerCase()
    if (!type || type === 'simple') return []
    if (['regex', 'jsonpath', 'xpath'].includes(type)) {
      return [
        feature(
          `criterion:${type}`,
          'preserve-only',
          `${type} criteria are preserved but not evaluated in M2-A.`,
          criterion.source,
          workflowId,
          stepId,
        ),
      ]
    }
    return [
      feature(
        `criterion:${type}`,
        'preserve-only',
        `Criterion type "${type}" is not in the M2-A support profile.`,
        criterion.source,
        workflowId,
        stepId,
      ),
    ]
  })
}

function actionFeatures(
  actions: readonly NormalizedArazzoAction[],
  workflowId: string,
  stepId: string,
): ArazzoFeatureSupport[] {
  return actions.flatMap((action) => {
    const type = action.type?.toLowerCase()
    if (!type || type === 'retry' || type === 'end') return []
    return [
      feature(
        `action:${type}`,
        'preserve-only',
        `Action type "${type}" is preserved but not executable in M2-A.`,
        action.source,
        workflowId,
        stepId,
      ),
    ]
  })
}

function stepFeatures(step: NormalizedArazzoStep, workflowId: string): ArazzoFeatureSupport[] {
  const features: ArazzoFeatureSupport[] = []
  for (const target of step.targets) {
    switch (target.type) {
      case 'operationId':
      case 'operationPath':
        features.push(
          feature(
            `target:${target.type}`,
            'supported',
            'Synchronous OpenAPI operation target.',
            step.source,
            workflowId,
            step.stepId,
          ),
        )
        break
      case 'workflowId':
      case 'channelPath':
        features.push(
          feature(
            `target:${target.type}`,
            'preserve-only',
            `${target.type} targets are preserved but not executable in M2-A.`,
            step.source,
            workflowId,
            step.stepId,
          ),
        )
        break
    }
  }
  features.push(...criterionFeatures(step.successCriteria, workflowId, step.stepId))
  features.push(...actionFeatures(step.onSuccess, workflowId, step.stepId))
  features.push(...actionFeatures(step.onFailure, workflowId, step.stepId))
  features.push(...preservedFeatures(step.preservedFields, step.source, workflowId, step.stepId))
  return features
}

function workflowFeatures(workflow: NormalizedArazzoWorkflow): ArazzoFeatureSupport[] {
  return [
    feature(
      'workflow',
      'supported',
      'Workflow structure is normalized and preserved.',
      workflow.source,
      workflow.workflowId,
    ),
    ...preservedFeatures(workflow.preservedFields, workflow.source, workflow.workflowId),
    ...workflow.steps.flatMap((step) => stepFeatures(step, workflow.workflowId)),
  ]
}

function levelFor(features: readonly ArazzoFeatureSupport[]): ArazzoSupportLevel {
  if (features.some(({ level }) => level === 'invalid')) return 'invalid'
  if (features.some(({ level }) => level === 'preserve-only')) return 'preserve-only'
  return 'supported'
}

export function analyzeArazzoSupport(document: NormalizedArazzoDocument): ArazzoSupportReport {
  const features: ArazzoFeatureSupport[] = []
  for (const sourceDescription of document.sourceDescriptions) {
    const type = sourceDescription.type.toLowerCase()
    features.push(
      feature(
        `source:${type || 'unknown'}`,
        type === 'openapi' ? 'supported' : 'preserve-only',
        type === 'openapi'
          ? 'OpenAPI Source Description is supported by the M2-A binding profile.'
          : `Source type "${sourceDescription.type}" is preserved but not executable in M2-A.`,
        sourceDescription.source,
      ),
    )
    features.push(...preservedFeatures(sourceDescription.preservedFields, sourceDescription.source))
  }

  const workflowReports = document.workflows.map((workflow) => {
    const workflowFeatureList = workflowFeatures(workflow)
    features.push(...workflowFeatureList)
    return {
      workflowId: workflow.workflowId,
      level: levelFor(workflowFeatureList),
      features: workflowFeatureList,
    } satisfies ArazzoWorkflowSupport
  })

  const semanticDiagnostics = validateArazzoDocument(document).filter(
    ({ severity }) => severity === 'error',
  )
  for (const diagnostic of semanticDiagnostics) {
    features.push(
      feature(`semantic:${diagnostic.code}`, 'invalid', diagnostic.message, diagnostic.source),
    )
  }

  const orderedFeatures = [...features].sort(
    (left, right) =>
      left.feature.localeCompare(right.feature) ||
      (left.workflowId ?? '').localeCompare(right.workflowId ?? '') ||
      (left.stepId ?? '').localeCompare(right.stepId ?? '') ||
      (left.source?.pointer ?? '').localeCompare(right.source?.pointer ?? ''),
  )
  const summary = {
    supported: orderedFeatures.filter(({ level }) => level === 'supported').length,
    preserveOnly: orderedFeatures.filter(({ level }) => level === 'preserve-only').length,
    invalid: orderedFeatures.filter(({ level }) => level === 'invalid').length,
  }

  return {
    level: levelFor(orderedFeatures),
    summary,
    features: orderedFeatures,
    workflows: workflowReports.map((workflow) => ({
      ...workflow,
      level: semanticDiagnostics.some(({ source }) =>
        source?.pointer.startsWith(
          document.workflows.find(({ workflowId }) => workflowId === workflow.workflowId)?.source
            .pointer ?? '\u0000',
        ),
      )
        ? 'invalid'
        : workflow.level,
    })),
  }
}
