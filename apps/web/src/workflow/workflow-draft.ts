import type { WorkspaceSnapshot } from '../data/types'

export const WORKFLOW_DRAFT_SCHEMA_VERSION = '1.0' as const

export interface WorkflowStepDraft {
  readonly stepId: string
  readonly operationNodeId: string
}

export interface WorkflowMappingDraft {
  readonly edgeId: string
  readonly mappingId: string
}

/** 工作流程只保存使用者明確選取的步驟與已接受映射，不複製 OpenAPI 或審查候選。 */
export interface WorkflowDraft {
  readonly schemaVersion: typeof WORKFLOW_DRAFT_SCHEMA_VERSION
  readonly workflowId: string
  readonly summary: string
  readonly sourceUrl: string
  readonly steps: readonly WorkflowStepDraft[]
  readonly selectedMappings: readonly WorkflowMappingDraft[]
}

function sourceUrl(snapshot: WorkspaceSnapshot): string {
  const uri = snapshot.project.sourceUri
  try {
    const parsed = new URL(uri)
    if (
      (parsed.protocol === 'https:' || parsed.protocol === 'http:') &&
      !parsed.username &&
      !parsed.password
    )
      return `${parsed.origin}${parsed.pathname}`
  } catch {
    // 本機來源以檔名建立相對參照，下載 Arazzo 後可與規格放在同一資料夾。
  }
  const name = uri.replaceAll('\\', '/').split(/[/?#]/u).filter(Boolean).at(-1)
  return `./${name && /^[A-Za-z0-9._-]+$/u.test(name) ? name : 'openapi.yaml'}`
}

export function createWorkflowDraft(snapshot: WorkspaceSnapshot): WorkflowDraft {
  return {
    schemaVersion: WORKFLOW_DRAFT_SCHEMA_VERSION,
    workflowId: 'newWorkflow',
    summary: '',
    sourceUrl: sourceUrl(snapshot),
    steps: [],
    selectedMappings: [],
  }
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid workflow draft.')
  return value as Record<string, unknown>
}

function exact(value: Record<string, unknown>, keys: readonly string[]) {
  if (Object.keys(value).some((key) => !keys.includes(key)))
    throw new Error('Unsupported workflow draft field.')
}

function boundedString(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length <= max
}

/** 專案檔與 IndexedDB 共用邊界驗證；草稿可暫時不完整，匯出時再做語意驗證。 */
export function parseWorkflowDraft(value: unknown, snapshot: WorkspaceSnapshot): WorkflowDraft {
  const draft = record(value)
  exact(draft, ['schemaVersion', 'workflowId', 'summary', 'sourceUrl', 'steps', 'selectedMappings'])
  if (
    draft.schemaVersion !== WORKFLOW_DRAFT_SCHEMA_VERSION ||
    !boundedString(draft.workflowId, 128) ||
    !boundedString(draft.summary, 500) ||
    !boundedString(draft.sourceUrl, 2048) ||
    !Array.isArray(draft.steps) ||
    draft.steps.length > 40 ||
    !Array.isArray(draft.selectedMappings) ||
    draft.selectedMappings.length > 200
  )
    throw new Error('Invalid workflow draft.')

  const nodes = new Set(snapshot.declaredGraph.nodes.map((node) => node.id))
  const steps = draft.steps.map((value) => {
    const step = record(value)
    exact(step, ['stepId', 'operationNodeId'])
    if (
      !boundedString(step.stepId, 128) ||
      !boundedString(step.operationNodeId, 1024) ||
      !nodes.has(step.operationNodeId)
    )
      throw new Error('Workflow step references an unknown endpoint.')
    return { stepId: step.stepId, operationNodeId: step.operationNodeId }
  })
  const selectedMappings = draft.selectedMappings.map((value) => {
    const mapping = record(value)
    exact(mapping, ['edgeId', 'mappingId'])
    if (!boundedString(mapping.edgeId, 1024) || !boundedString(mapping.mappingId, 1024))
      throw new Error('Invalid workflow mapping reference.')
    return { edgeId: mapping.edgeId, mappingId: mapping.mappingId }
  })
  const references = selectedMappings.map(({ edgeId, mappingId }) => `${edgeId}\u0000${mappingId}`)
  if (new Set(references).size !== references.length)
    throw new Error('Duplicate workflow mapping reference.')
  return {
    schemaVersion: WORKFLOW_DRAFT_SCHEMA_VERSION,
    workflowId: draft.workflowId,
    summary: draft.summary,
    sourceUrl: draft.sourceUrl,
    steps,
    selectedMappings,
  }
}
