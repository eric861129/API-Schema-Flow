import type {
  ReviewCandidateSort,
  ReviewCandidateStateFilter,
  ReviewConfidenceBand,
  ReviewSessionFilters,
} from './review-session'

export type ReviewCandidateState =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'edited'
  | 'stale'
  | 'orphaned'
  | 'superseded'
  | 'conflict'
  | 'invalid'

export interface ReviewCandidateRow {
  readonly id: string
  readonly sourceOperationKey: string
  readonly sourceLabel: string
  readonly sourceSelector: string
  readonly targetOperationKey: string
  readonly targetLabel: string
  readonly targetDescriptor: string
  readonly confidence: number
  readonly band: ReviewConfidenceBand
  readonly evidenceCount: number
  readonly blockerCount: number
  readonly state: ReviewCandidateState
}

export interface ReviewCandidateQuery {
  readonly filters: ReviewSessionFilters
  readonly sort: ReviewCandidateSort
}

const STATE_PRIORITY: Readonly<Record<ReviewCandidateState, number>> = {
  conflict: 0,
  invalid: 1,
  stale: 2,
  orphaned: 3,
  accepted: 4,
  edited: 5,
  rejected: 6,
  superseded: 7,
  pending: 8,
}

function normalizeSearchText(value: string): string {
  return value.normalize('NFKC').trim().toLowerCase()
}

function matchesStateFilter(
  state: ReviewCandidateState,
  filter: ReviewCandidateStateFilter,
): boolean {
  switch (filter) {
    case 'all':
      return true
    case 'needs-attention':
      return ['conflict', 'invalid', 'stale', 'orphaned'].includes(state)
    case 'edited':
    case 'accepted':
    case 'rejected':
    case 'pending':
      return state === filter
  }
}

function compareText(left: string, right: string): number {
  if (left === right) return 0
  return left < right ? -1 : 1
}

function compareCandidates(
  left: ReviewCandidateRow,
  right: ReviewCandidateRow,
  sort: ReviewCandidateSort,
): number {
  switch (sort) {
    case 'confidence-desc':
      return (
        right.confidence - left.confidence ||
        compareText(left.targetOperationKey, right.targetOperationKey) ||
        compareText(left.sourceOperationKey, right.sourceOperationKey) ||
        compareText(left.id, right.id)
      )
    case 'source-endpoint':
      return (
        compareText(left.sourceOperationKey, right.sourceOperationKey) ||
        compareText(left.targetOperationKey, right.targetOperationKey) ||
        compareText(left.id, right.id)
      )
    case 'target-endpoint':
      return (
        compareText(left.targetOperationKey, right.targetOperationKey) ||
        compareText(left.sourceOperationKey, right.sourceOperationKey) ||
        compareText(left.id, right.id)
      )
    case 'review-state':
      return (
        STATE_PRIORITY[left.state] - STATE_PRIORITY[right.state] ||
        right.confidence - left.confidence ||
        compareText(left.id, right.id)
      )
  }
}

export function filterAndSortReviewCandidates(
  candidates: readonly ReviewCandidateRow[],
  query: ReviewCandidateQuery,
): readonly ReviewCandidateRow[] {
  const normalizedQuery = normalizeSearchText(query.filters.query)

  return candidates
    .filter((candidate) => {
      if (!query.filters.confidenceBands.includes(candidate.band)) {
        return false
      }

      if (!matchesStateFilter(candidate.state, query.filters.reviewState)) {
        return false
      }

      if (query.filters.hasBlockersOnly && candidate.blockerCount === 0) {
        return false
      }

      if (!normalizedQuery) {
        return true
      }

      const searchable = normalizeSearchText(
        [
          candidate.sourceOperationKey,
          candidate.sourceLabel,
          candidate.sourceSelector,
          candidate.targetOperationKey,
          candidate.targetLabel,
          candidate.targetDescriptor,
        ].join(' '),
      )

      return searchable.includes(normalizedQuery)
    })
    .toSorted((left, right) => compareCandidates(left, right, query.sort))
}

export function countReviewCandidateStates(
  candidates: readonly ReviewCandidateRow[],
): Readonly<Record<ReviewCandidateState, number>> {
  const counts: Record<ReviewCandidateState, number> = {
    pending: 0,
    accepted: 0,
    rejected: 0,
    edited: 0,
    stale: 0,
    orphaned: 0,
    superseded: 0,
    conflict: 0,
    invalid: 0,
  }

  for (const candidate of candidates) {
    counts[candidate.state] += 1
  }

  return counts
}
