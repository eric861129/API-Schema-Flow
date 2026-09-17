import type { NormalizedOperation } from '@api-schema-flow/domain'
import type { CanonicalArazzoDocument } from '@api-schema-flow/exporter-arazzo'
import { assessMockPair, type InMemoryMockSession } from '@api-schema-flow/mock-runtime'

export interface LocalMockPlan {
  readonly create: NormalizedOperation
  readonly read: NormalizedOperation
  readonly createStepId: string
  readonly readStepId: string
}

export interface LocalTraceEvent {
  readonly sequence: number
  readonly stepId: string
  readonly request: string
  readonly responseStatus: number
  readonly responseFieldCount: number
  readonly outputId?: string
  readonly mutation: 'created' | 'read' | 'not-found'
  readonly entityCount: number
}

export interface LocalMockRun {
  readonly status: 'passed' | 'failed'
  readonly trace: readonly LocalTraceEvent[]
  readonly reason?: string
  readonly sameEntity: boolean
}

/** 只執行匯出文件中確實存在的已接受 id 映射，不推測其他資料關係。 */
export function prepareLocalMockWorkflow(
  document: CanonicalArazzoDocument,
  operations: readonly NormalizedOperation[],
): { readonly plan?: LocalMockPlan; readonly reason?: string } {
  const steps = document.workflows[0]?.steps
  if (document.workflows.length !== 1 || steps?.length !== 2)
    return { reason: 'Local Mock requires exactly two steps: POST then GET.' }
  const [createStep, readStep] = steps
  if (!createStep || !readStep) return { reason: 'Local Mock requires two steps.' }
  const resolve = (step: typeof createStep) =>
    operations.filter((operation) =>
      step.operationId
        ? operation.operationId === step.operationId
        : step.operationPath?.endsWith(
            `#/paths/${operation.path.replaceAll('~', '~0').replaceAll('/', '~1')}/${operation.method}`,
          ),
    )
  const createMatches = resolve(createStep)
  const readMatches = resolve(readStep)
  if (createMatches.length !== 1 || readMatches.length !== 1)
    return { reason: 'Local Mock could not uniquely match both OpenAPI operations.' }
  const create = createMatches[0]!
  const read = readMatches[0]!
  const contract = assessMockPair(create, read)
  if (contract) return { reason: contract }
  if (
    Object.keys(createStep.outputs ?? {}).length !== 1 ||
    createStep.outputs?.id !== '$response.body#/id' ||
    readStep.parameters?.length !== 1 ||
    readStep.parameters[0]?.in !== 'path' ||
    readStep.parameters[0]?.name !== 'id' ||
    readStep.parameters[0]?.value !== `$steps.${createStep.stepId}.outputs.id` ||
    readStep.dependsOn?.length !== 1 ||
    readStep.dependsOn[0] !== createStep.stepId ||
    createStep.requestBody ||
    readStep.requestBody
  )
    return { reason: 'Select the accepted response id → path id mapping without other bindings.' }
  return {
    plan: {
      create,
      read,
      createStepId: createStep.stepId,
      readStepId: readStep.stepId,
    },
  }
}

/** 執行順序與 Trace 保持一致；只記錄產生的 id，從不寫入使用者提供的本文。 */
export function executeLocalMockWorkflow(
  plan: LocalMockPlan,
  body: unknown,
  session: InMemoryMockSession,
): LocalMockRun {
  try {
    const created = session.create(plan.create, body)
    const id = created.body.id
    if (typeof id !== 'string') throw new Error('Mock response did not contain an id.')
    const first: LocalTraceEvent = {
      sequence: 1,
      stepId: plan.createStepId,
      request: `POST ${plan.create.path} · JSON fields: ${Object.keys(body as object).length}`,
      responseStatus: created.status,
      responseFieldCount: Object.keys(created.body).length,
      outputId: id,
      mutation: created.mutation,
      entityCount: created.summary.entityCount,
    }
    const fetched = session.read(plan.read, id)
    const second: LocalTraceEvent = {
      sequence: 2,
      stepId: plan.readStepId,
      request: `GET ${plan.read.path} · id from ${plan.createStepId}`,
      responseStatus: fetched.status,
      responseFieldCount: Object.keys(fetched.body).length,
      outputId: id,
      mutation: fetched.mutation,
      entityCount: fetched.summary.entityCount,
    }
    return {
      status: fetched.status === 200 && fetched.body === created.body ? 'passed' : 'failed',
      trace: [first, second],
      sameEntity: fetched.status === 200 && fetched.body === created.body,
      ...(fetched.status === 200 ? {} : { reason: 'The created entity could not be read back.' }),
    }
  } catch (error) {
    return {
      status: 'failed',
      trace: [],
      sameEntity: false,
      reason: error instanceof Error ? error.message : 'Local Mock execution failed.',
    }
  }
}
