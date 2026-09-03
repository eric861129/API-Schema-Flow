export const REVIEW_SESSION_SCHEMA_VERSION = '1.0' as const

export type ReviewRejectReason =
  | 'wrong-resource'
  | 'wrong-field'
  | 'not-a-workflow'
  | 'duplicate'
  | 'unsafe-or-ambiguous'
  | 'other'

export type ReviewIntent =
  | {
      readonly action: 'accept'
      readonly candidateId: string
      readonly revision: number
    }
  | {
      readonly action: 'reject'
      readonly candidateId: string
      readonly revision: number
      readonly reason: ReviewRejectReason
      readonly note?: string
    }

export type ReviewCandidateStateFilter =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'edited'
  | 'needs-attention'
  | 'all'

export type ReviewCandidateSort =
  | 'confidence-desc'
  | 'source-endpoint'
  | 'target-endpoint'
  | 'review-state'

export type ReviewConfidenceBand = 'high' | 'medium' | 'low' | 'hidden'

export interface ReviewSessionFilters {
  readonly query: string
  readonly confidenceBands: readonly ReviewConfidenceBand[]
  readonly reviewState: ReviewCandidateStateFilter
  readonly hasBlockersOnly: boolean
}

export interface ReviewSessionState {
  readonly schemaVersion: typeof REVIEW_SESSION_SCHEMA_VERSION
  readonly projectFingerprint: string
  readonly sourceRevision: string
  readonly baselineRevisions: Readonly<Record<string, number>>
  readonly draftIntents: readonly ReviewIntent[]
  readonly selectedCandidateId: string | null
  readonly filters: ReviewSessionFilters
  readonly sort: ReviewCandidateSort
  readonly evidenceOpen: boolean
  readonly previewMode: 'mapping' | 'topology'
}

export interface CreateReviewSessionOptions {
  readonly projectFingerprint: string
  readonly sourceRevision: string
  readonly baselineRevisions?: Readonly<Record<string, number>>
}

export type ReviewSessionAction =
  | { readonly type: 'select-candidate'; readonly candidateId: string | null }
  | { readonly type: 'accept-candidate'; readonly candidateId: string }
  | {
      readonly type: 'reject-candidate'
      readonly candidateId: string
      readonly reason: ReviewRejectReason
      readonly note?: string
    }
  | { readonly type: 'undo-last-draft' }
  | { readonly type: 'set-query'; readonly query: string }
  | { readonly type: 'toggle-confidence'; readonly band: ReviewConfidenceBand }
  | { readonly type: 'set-review-state'; readonly state: ReviewCandidateStateFilter }
  | { readonly type: 'set-sort'; readonly sort: ReviewCandidateSort }
  | { readonly type: 'set-blockers-only'; readonly enabled: boolean }
  | { readonly type: 'toggle-evidence' }
  | { readonly type: 'set-preview-mode'; readonly mode: 'mapping' | 'topology' }

const DEFAULT_CONFIDENCE_BANDS: readonly ReviewConfidenceBand[] = ['high', 'medium']

export function createInitialReviewSession(
  options: CreateReviewSessionOptions,
): ReviewSessionState {
  return {
    schemaVersion: REVIEW_SESSION_SCHEMA_VERSION,
    projectFingerprint: options.projectFingerprint,
    sourceRevision: options.sourceRevision,
    baselineRevisions: { ...(options.baselineRevisions ?? {}) },
    draftIntents: [],
    selectedCandidateId: null,
    filters: {
      query: '',
      confidenceBands: DEFAULT_CONFIDENCE_BANDS,
      reviewState: 'pending',
      hasBlockersOnly: false,
    },
    sort: 'confidence-desc',
    evidenceOpen: true,
    previewMode: 'mapping',
  }
}

export function getNextReviewRevision(
  state: ReviewSessionState,
  candidateId: string,
): number {
  let highestRevision = state.baselineRevisions[candidateId] ?? 0

  for (const intent of state.draftIntents) {
    if (intent.candidateId === candidateId && intent.revision > highestRevision) {
      highestRevision = intent.revision
    }
  }

  return highestRevision + 1
}

export function validateRejectReason(
  reason: ReviewRejectReason,
  note?: string,
): { readonly valid: true } | { readonly valid: false; readonly message: string } {
  if (reason === 'other' && !note?.trim()) {
    return {
      valid: false,
      message: 'A note is required when the reject reason is Other.',
    }
  }

  return { valid: true }
}

function toggleBand(
  current: readonly ReviewConfidenceBand[],
  band: ReviewConfidenceBand,
): readonly ReviewConfidenceBand[] {
  return current.includes(band)
    ? current.filter((value) => value !== band)
    : [...current, band].sort()
}

export function reviewSessionReducer(
  state: ReviewSessionState,
  action: ReviewSessionAction,
): ReviewSessionState {
  switch (action.type) {
    case 'select-candidate':
      return { ...state, selectedCandidateId: action.candidateId }

    case 'accept-candidate':
      return {
        ...state,
        draftIntents: [
          ...state.draftIntents,
          {
            action: 'accept',
            candidateId: action.candidateId,
            revision: getNextReviewRevision(state, action.candidateId),
          },
        ],
      }

    case 'reject-candidate': {
      const validation = validateRejectReason(action.reason, action.note)
      if (!validation.valid) {
        return state
      }

      const note = action.note?.trim()
      const intent: ReviewIntent = {
        action: 'reject',
        candidateId: action.candidateId,
        revision: getNextReviewRevision(state, action.candidateId),
        reason: action.reason,
        ...(note ? { note } : {}),
      }

      return {
        ...state,
        draftIntents: [...state.draftIntents, intent],
      }
    }

    case 'undo-last-draft':
      return state.draftIntents.length === 0
        ? state
        : { ...state, draftIntents: state.draftIntents.slice(0, -1) }

    case 'set-query':
      return {
        ...state,
        filters: { ...state.filters, query: action.query },
      }

    case 'toggle-confidence':
      return {
        ...state,
        filters: {
          ...state.filters,
          confidenceBands: toggleBand(state.filters.confidenceBands, action.band),
        },
      }

    case 'set-review-state':
      return {
        ...state,
        filters: { ...state.filters, reviewState: action.state },
      }

    case 'set-sort':
      return { ...state, sort: action.sort }

    case 'set-blockers-only':
      return {
        ...state,
        filters: { ...state.filters, hasBlockersOnly: action.enabled },
      }

    case 'toggle-evidence':
      return { ...state, evidenceOpen: !state.evidenceOpen }

    case 'set-preview-mode':
      return { ...state, previewMode: action.mode }
  }
}
