import type { BoundWorkflowStep, ProjectedArazzoStep } from './contracts.js'

export interface CanonicalArazzoSourceDescription {
  readonly name: string
  readonly url: string
  readonly type: 'openapi'
}

export interface CanonicalArazzoParameter {
  readonly name: string
  readonly in: 'path' | 'query' | 'header' | 'cookie'
  readonly value: string
}

export interface CanonicalArazzoRequestBody {
  readonly contentType: 'application/json'
  readonly payload: Readonly<Record<string, unknown>>
}

export interface CanonicalArazzoStep {
  readonly stepId: string
  readonly description?: string
  readonly operationId?: string
  readonly operationPath?: string
  readonly parameters?: readonly CanonicalArazzoParameter[]
  readonly requestBody?: CanonicalArazzoRequestBody
  readonly outputs?: Readonly<Record<string, string>>
  readonly dependsOn?: readonly string[]
}

export interface CanonicalArazzoWorkflow {
  readonly workflowId: string
  readonly summary?: string
  readonly description?: string
  readonly steps: readonly CanonicalArazzoStep[]
}

export interface CanonicalArazzoDocument {
  readonly arazzo: '1.1.0'
  readonly info: {
    readonly title: string
    readonly version: string
  }
  readonly sourceDescriptions: readonly CanonicalArazzoSourceDescription[]
  readonly workflows: readonly CanonicalArazzoWorkflow[]
}

export interface BuildArazzoDocumentInput {
  readonly title: string
  readonly version: string
  readonly workflowId: string
  readonly summary?: string
  readonly description?: string
  readonly sourceDescriptionCount: number
  readonly boundSteps: readonly BoundWorkflowStep[]
  readonly projectedSteps: readonly ProjectedArazzoStep[]
}

function escapeJsonPointerToken(value: string): string {
  return value.replace(/~/gu, '~0').replace(/\//gu, '~1')
}

function operationReference(
  step: BoundWorkflowStep,
  sourceDescriptionCount: number,
): Pick<CanonicalArazzoStep, 'operationId' | 'operationPath'> {
  if (step.operation.operationId !== undefined) {
    return {
      operationId:
        sourceDescriptionCount === 1
          ? step.operation.operationId
          : `$sourceDescriptions.${step.sourceDescription.name}.${step.operation.operationId}`,
    }
  }

  return {
    operationPath: `{$sourceDescriptions.${step.sourceDescription.name}.url}#/paths/${escapeJsonPointerToken(step.operation.path)}/${step.operation.method}`,
  }
}

export function buildCanonicalArazzoDocument(
  input: BuildArazzoDocumentInput,
): CanonicalArazzoDocument {
  const projectedByStepId = new Map(input.projectedSteps.map((step) => [step.stepId, step]))

  const steps: CanonicalArazzoStep[] = input.boundSteps.map((boundStep) => {
    const projected = projectedByStepId.get(boundStep.stepId)
    const parameters = projected?.parameters ?? []
    const dependsOn = projected?.dependsOn ?? []
    const outputs = projected?.outputs ?? {}
    return {
      stepId: boundStep.stepId,
      ...(boundStep.description === undefined ? {} : { description: boundStep.description }),
      ...operationReference(boundStep, input.sourceDescriptionCount),
      ...(parameters.length === 0 ? {} : { parameters }),
      ...(projected?.requestBody === undefined ? {} : { requestBody: projected.requestBody }),
      ...(Object.keys(outputs).length === 0 ? {} : { outputs }),
      ...(dependsOn.length === 0 ? {} : { dependsOn }),
    }
  })

  return {
    arazzo: '1.1.0',
    info: {
      title: input.title,
      version: input.version,
    },
    sourceDescriptions: [...input.boundSteps]
      .map(({ sourceDescription }) => sourceDescription)
      .filter(
        (source, index, all) =>
          all.findIndex(({ sourceId }) => sourceId === source.sourceId) === index,
      )
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(({ name, url }) => ({ name, url, type: 'openapi' as const })),
    workflows: [
      {
        workflowId: input.workflowId,
        ...(input.summary === undefined ? {} : { summary: input.summary }),
        ...(input.description === undefined ? {} : { description: input.description }),
        steps,
      },
    ],
  }
}
