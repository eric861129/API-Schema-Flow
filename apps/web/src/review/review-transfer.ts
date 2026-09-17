import type { ReviewDecisionSet } from '@api-schema-flow/domain'
import { canonicalizeDecisionSet, parseReviewDecisionSet } from '@api-schema-flow/review/browser'
import type { WorkspaceSnapshot } from '../data/types'
import { deriveBaselineRevisions } from './decision-factory'
import { materializeReviewSession } from './review-engine'
import {
  createInitialReviewSession,
  type ReviewIntent,
  type ReviewSessionState,
} from './review-session'
import { validateEditedMapping } from './mapping-editor-model'
import { version as toolVersion } from '../../package.json'
import {
  DEFAULT_WORKSPACE_LAYOUT,
  parseWorkspaceLayout,
  type WorkspaceLayoutState,
} from '../project/workspace-layout'
import { parseWorkflowDraft, type WorkflowDraft } from '../workflow/workflow-draft'

export const MAX_DECISION_FILE_BYTES = 5 * 1024 * 1024

/** 檔案使用 Review core 格式；儲存時間與畫面狀態不參與確定性輸出。 */
export function serializeDecisionSet(set: ReviewDecisionSet): string {
  return stableJson(canonicalizeDecisionSet(set)) + '\n'
}

function stableJson(value: unknown): string {
  return JSON.stringify(
    value,
    (_key, item) =>
      item && typeof item === 'object' && !Array.isArray(item)
        ? Object.fromEntries(
            Object.entries(item).sort(([left], [right]) =>
              left < right ? -1 : left > right ? 1 : 0,
            ),
          )
        : item,
    2,
  )
}

export function parseDecisionFile(text: string): ReviewDecisionSet {
  if (new TextEncoder().encode(text).length > MAX_DECISION_FILE_BYTES)
    throw new Error('Decision Set exceeds the 5 MB limit.')
  const parsed = parseReviewDecisionSet(JSON.parse(text))
  if (!parsed.decisionSet)
    throw new Error(parsed.diagnostics.map(({ message }) => message).join(' '))
  if (
    [
      parsed.decisionSet.revision,
      ...parsed.decisionSet.decisions.map(({ revision }) => revision),
    ].some((revision) => !Number.isSafeInteger(revision) || revision >= Number.MAX_SAFE_INTEGER)
  )
    throw new Error('Decision revisions exceed the supported safe integer range.')
  return parsed.decisionSet
}

/** 同 ID 但內容不同時拒絕匯入；重複匯入相同檔案不增加決策。 */
export function mergeDecisionSets(
  left: ReviewDecisionSet,
  right: ReviewDecisionSet,
): ReviewDecisionSet {
  function unique<T extends { readonly id: string }>(items: readonly T[]): T[] {
    const found = new Map<string, T>()
    for (const item of items) {
      const previous = found.get(item.id)
      if (previous && stableJson(previous) !== stableJson(item))
        throw new Error(`Conflicting content for identifier ${item.id}.`)
      found.set(item.id, item)
    }
    return [...found.values()]
  }
  return canonicalizeDecisionSet({
    schemaVersion: '1.0',
    revision: Math.max(left.revision, right.revision),
    decisions: unique([...left.decisions, ...right.decisions]),
    manualEdges: unique([...left.manualEdges, ...right.manualEdges]),
  })
}

export function initialStoredSession(snapshot: WorkspaceSnapshot): ReviewSessionState {
  return createInitialReviewSession({
    ...snapshot.reviewContext,
    baselineRevisions: deriveBaselineRevisions(snapshot.reviewDecisionSet),
  })
}

export function previewDecisionImport(
  snapshot: WorkspaceSnapshot,
  state: ReviewSessionState,
  incoming: ReviewDecisionSet,
) {
  for (const decision of incoming.decisions) {
    const candidate = snapshot.inferenceCandidates.find(({ id }) => id === decision.candidateId)
    if (
      decision.action !== 'edit' ||
      !candidate ||
      candidate.fingerprint !== decision.candidateFingerprint ||
      candidate.ruleSetVersion !== decision.ruleSetVersion
    )
      continue
    const mapping = decision.editedMapping!
    if (
      mapping.transform &&
      !/^[^{}$]*\{\$steps\.source\.outputs\.[A-Za-z_][A-Za-z0-9_]*\}[^{}$]*$/.test(
        mapping.transform.raw,
      )
    )
      throw new Error('Imported mapping contains an unsupported transform template.')
    const errors = validateEditedMapping(snapshot, candidate, mapping)
    if (errors.length) throw new Error(`Imported mapping is incompatible: ${errors.join(' ')}`)
  }
  const existing = state.importedDecisionSet ?? {
    schemaVersion: '1.0' as const,
    revision: 0,
    decisions: [],
    manualEdges: [],
  }
  const current = materializeReviewSession(snapshot, state).decisionSet
  mergeDecisionSets(current, incoming)
  const localIds = new Set(
    materializeReviewSession(snapshot, state).draftDecisions.map(({ id }) => id),
  )
  const importedDecisionSet = mergeDecisionSets(existing, {
    ...incoming,
    decisions: incoming.decisions.filter(({ id }) => !localIds.has(id)),
  })
  const baselineRevisions = deriveBaselineRevisions(
    mergeDecisionSets(snapshot.reviewDecisionSet, importedDecisionSet),
  )
  const next = { ...state, importedDecisionSet, baselineRevisions }
  const materialization = materializeReviewSession(snapshot, next)
  return { state: next, materialization }
}

export interface StoredReview {
  readonly version: 2
  readonly schemaVersion: '2.0'
  readonly toolVersion: string
  readonly workspaceLayout: WorkspaceLayoutState
  readonly workflowDraft?: WorkflowDraft | undefined
  readonly baseline: string
  readonly draftIntents: readonly ReviewIntent[]
  readonly importedDecisionSet?: ReviewDecisionSet | undefined
}

export function encodeStoredReview(
  snapshot: WorkspaceSnapshot,
  state: ReviewSessionState,
): StoredReview {
  return {
    version: 2,
    schemaVersion: '2.0',
    toolVersion,
    workspaceLayout: state.workspaceLayout ?? DEFAULT_WORKSPACE_LAYOUT,
    ...(state.workflowDraft ? { workflowDraft: state.workflowDraft } : {}),
    baseline: serializeDecisionSet(snapshot.reviewDecisionSet),
    draftIntents: state.draftIntents,
    ...(state.importedDecisionSet ? { importedDecisionSet: state.importedDecisionSet } : {}),
  }
}

/** 清除後只保留停用偏好與世代，避免其他分頁把舊決策寫回。 */
export function disabledStoredReview() {
  return { version: 2, schemaVersion: '2.0', toolVersion, autosave: false } as const
}

export function isStoredReviewDisabled(value: unknown): boolean {
  return Boolean(
    value &&
    typeof value === 'object' &&
    'version' in value &&
    (value.version === 1 || value.version === 2) &&
    'schemaVersion' in value &&
    value.schemaVersion === (value.version === 1 ? '1.0' : '2.0') &&
    'toolVersion' in value &&
    typeof value.toolVersion === 'string' &&
    value.toolVersion.trim() &&
    'autosave' in value &&
    value.autosave === false,
  )
}

/** 未知版本或損壞內容不自動降版、刪除或覆寫。 */
export function decodeStoredReview(
  snapshot: WorkspaceSnapshot,
  value: unknown,
): ReviewSessionState {
  if (
    !value ||
    typeof value !== 'object' ||
    !('version' in value) ||
    (value.version !== 1 && value.version !== 2)
  )
    throw new Error('Unsupported stored review version. Existing data has been preserved.')
  const record = value as Partial<StoredReview>
  // 尚未發布的早期 v1 可讀取；下一次明確變更才寫入完整版本資訊。
  if (
    (record.schemaVersion !== undefined &&
      record.schemaVersion !== (value.version === 1 ? '1.0' : '2.0')) ||
    (value.version === 2 &&
      (!record.schemaVersion || !record.toolVersion || !record.workspaceLayout)) ||
    (record.toolVersion !== undefined &&
      (typeof record.toolVersion !== 'string' || !record.toolVersion.trim())) ||
    (record.schemaVersion === undefined) !== (record.toolVersion === undefined)
  )
    throw new Error('Unsupported stored review metadata. Existing data has been preserved.')
  if (record.baseline !== serializeDecisionSet(snapshot.reviewDecisionSet))
    throw new Error(
      'The baseline changed. Existing review data has been preserved; export it before resetting.',
    )
  if (!Array.isArray(record.draftIntents)) throw new Error('Stored review decisions are damaged.')
  const reasons = [
    'wrong-resource',
    'wrong-field',
    'not-a-workflow',
    'duplicate',
    'unsafe-or-ambiguous',
    'other',
  ]
  for (const intent of record.draftIntents) {
    if (
      !intent ||
      typeof intent !== 'object' ||
      typeof intent.candidateId !== 'string' ||
      !Number.isSafeInteger(intent.revision) ||
      intent.revision <= 0 ||
      !['accept', 'reject', 'edit'].includes(intent.action)
    )
      throw new Error('Stored review intent is invalid.')
    if (
      intent.action === 'reject' &&
      (!reasons.includes(intent.reason) ||
        (intent.note !== undefined && typeof intent.note !== 'string') ||
        (intent.reason === 'other' && !intent.note?.trim()))
    )
      throw new Error('Stored rejection reason is invalid.')
  }
  let state = initialStoredSession(snapshot)
  if (record.importedDecisionSet)
    state = previewDecisionImport(
      snapshot,
      state,
      parseDecisionFile(JSON.stringify(record.importedDecisionSet)),
    ).state
  state = {
    ...state,
    draftIntents: record.draftIntents,
    ...(record.workflowDraft
      ? { workflowDraft: parseWorkflowDraft(record.workflowDraft, snapshot) }
      : {}),
    workspaceLayout: record.workspaceLayout
      ? parseWorkspaceLayout(
          record.workspaceLayout,
          new Set(snapshot.declaredGraph.nodes.map((node) => node.id)),
        )
      : DEFAULT_WORKSPACE_LAYOUT,
  }
  // 同時驗證結構、決策 ID、編輯映射及圖形投影，避免信任瀏覽器儲存內容。
  const validated = parseDecisionFile(
    serializeDecisionSet(materializeReviewSession(snapshot, state).decisionSet),
  )
  previewDecisionImport(snapshot, initialStoredSession(snapshot), validated)
  return state
}
