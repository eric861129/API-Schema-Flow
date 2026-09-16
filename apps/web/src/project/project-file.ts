import { version as toolVersion } from '../../package.json'
import type { WorkspaceSnapshot } from '../data/types'
import type { ReviewSessionState } from '../review/review-session'
import {
  decodeStoredReview,
  encodeStoredReview,
  MAX_DECISION_FILE_BYTES,
} from '../review/review-transfer'
import { DEFAULT_WORKSPACE_LAYOUT, parseWorkspaceLayout } from './workspace-layout'

/** 可攜檔只參照已載入的來源，不包含原始規格、Parser AST 或瀏覽器控制物件。 */
export function serializeProject(snapshot: WorkspaceSnapshot, state: ReviewSessionState): string {
  const stored = encodeStoredReview(snapshot, state)
  const review = {
    version: stored.version,
    schemaVersion: stored.schemaVersion,
    toolVersion: stored.toolVersion,
    baseline: stored.baseline,
    draftIntents: stored.draftIntents,
    ...(stored.importedDecisionSet ? { importedDecisionSet: stored.importedDecisionSet } : {}),
  }
  const project = {
    kind: 'api-schema-flow-project',
    schemaVersion: '1.0',
    toolVersion,
    source: {
      projectFingerprint: snapshot.reviewContext.projectFingerprint,
      sourceRevision: snapshot.reviewContext.sourceRevision,
    },
    review,
    layout: parseWorkspaceLayout(
      state.workspaceLayout ?? DEFAULT_WORKSPACE_LAYOUT,
      new Set(snapshot.declaredGraph.nodes.map((node) => node.id)),
    ),
  }
  return (
    JSON.stringify(
      project,
      (_key, value) =>
        value && typeof value === 'object' && !Array.isArray(value)
          ? Object.fromEntries(
              Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
            )
          : value,
      2,
    ) + '\n'
  )
}

export function parseProject(text: string, snapshot: WorkspaceSnapshot): ReviewSessionState {
  if (new TextEncoder().encode(text).length > MAX_DECISION_FILE_BYTES)
    throw new Error('Project file exceeds the 5 MB limit.')
  const value: unknown = JSON.parse(text)
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid project file.')
  const root = value as Record<string, unknown>
  if (
    root.kind !== 'api-schema-flow-project' ||
    root.schemaVersion !== '1.0' ||
    typeof root.toolVersion !== 'string' ||
    !root.toolVersion.trim()
  )
    throw new Error('Unsupported project format or version.')
  if (
    Object.keys(root).some(
      (key) =>
        !['kind', 'schemaVersion', 'toolVersion', 'source', 'review', 'layout'].includes(key),
    )
  )
    throw new Error('Unsupported project field.')
  const source = root.source as Record<string, unknown> | null
  if (
    !source ||
    typeof source !== 'object' ||
    Object.keys(source).some((key) => !['projectFingerprint', 'sourceRevision'].includes(key)) ||
    source.projectFingerprint !== snapshot.reviewContext.projectFingerprint ||
    source.sourceRevision !== snapshot.reviewContext.sourceRevision
  )
    throw new Error(
      'Project source does not match the loaded workspace. Load its source before opening this project.',
    )
  const layout = parseWorkspaceLayout(
    root.layout,
    new Set(snapshot.declaredGraph.nodes.map((node) => node.id)),
  )
  if (!root.review || typeof root.review !== 'object' || Array.isArray(root.review))
    throw new Error('Invalid project review data.')
  const review = root.review as Record<string, unknown>
  if (
    Object.keys(review).some(
      (key) =>
        ![
          'version',
          'schemaVersion',
          'toolVersion',
          'baseline',
          'draftIntents',
          'importedDecisionSet',
        ].includes(key),
    )
  )
    throw new Error('Unsupported project review field.')
  if (
    review.version !== 2 ||
    review.schemaVersion !== '2.0' ||
    typeof review.toolVersion !== 'string' ||
    !review.toolVersion.trim()
  )
    throw new Error('Unsupported project review version.')
  return decodeStoredReview(snapshot, { ...review, workspaceLayout: layout })
}
