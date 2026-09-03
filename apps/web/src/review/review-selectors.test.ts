import { describe, expect, test } from 'vitest'

import { filterAndSortReviewCandidates, type ReviewCandidateRow } from './review-selectors'

const candidates: readonly ReviewCandidateRow[] = [
  {
    id: 'candidate:low',
    sourceOperationKey: 'operation:get:/spaces',
    sourceLabel: 'GET /spaces',
    sourceSelector: '$response.body#/cursor',
    targetOperationKey: 'operation:get:/spaces',
    targetLabel: 'GET /spaces',
    targetDescriptor: 'query.cursor',
    confidence: 0.68,
    band: 'low',
    evidenceCount: 2,
    blockerCount: 0,
    state: 'pending',
  },
  {
    id: 'candidate:reservation',
    sourceOperationKey: 'operation:post:/reservations',
    sourceLabel: 'POST /reservations',
    sourceSelector: '$response.body#/reservationId',
    targetOperationKey: 'operation:get:/reservations/{id}',
    targetLabel: 'GET /reservations/{id}',
    targetDescriptor: 'path.id',
    confidence: 0.94,
    band: 'high',
    evidenceCount: 4,
    blockerCount: 0,
    state: 'pending',
  },
  {
    id: 'candidate:token',
    sourceOperationKey: 'operation:post:/auth/login',
    sourceLabel: 'POST /auth/login',
    sourceSelector: '$response.body#/token',
    targetOperationKey: 'operation:post:/reservations',
    targetLabel: 'POST /reservations',
    targetDescriptor: 'header.Authorization',
    confidence: 0.91,
    band: 'high',
    evidenceCount: 3,
    blockerCount: 1,
    state: 'conflict',
  },
  {
    id: 'candidate:accepted',
    sourceOperationKey: 'operation:get:/spaces',
    sourceLabel: 'GET /spaces',
    sourceSelector: '$response.body#/spaceId',
    targetOperationKey: 'operation:post:/reservations',
    targetLabel: 'POST /reservations',
    targetDescriptor: 'requestBody#/spaceId',
    confidence: 0.86,
    band: 'medium',
    evidenceCount: 3,
    blockerCount: 0,
    state: 'accepted',
  },
]

const defaultQuery = {
  filters: {
    query: '',
    confidenceBands: ['high', 'medium'] as const,
    reviewState: 'pending' as const,
    hasBlockersOnly: false,
  },
  sort: 'confidence-desc' as const,
}

describe('review candidate selectors', () => {
  test('defaults to pending high and medium candidates ordered by confidence', () => {
    expect(filterAndSortReviewCandidates(candidates, defaultQuery).map(({ id }) => id)).toEqual([
      'candidate:reservation',
    ])
  })

  test('searches source, target, selector, and descriptor using normalized text', () => {
    const result = filterAndSortReviewCandidates(candidates, {
      filters: {
        ...defaultQuery.filters,
        query: 'RESERVATIONID',
        reviewState: 'all',
      },
      sort: 'confidence-desc',
    })

    expect(result.map(({ id }) => id)).toEqual(['candidate:reservation'])
  })

  test('projects attention states and blocker-only results', () => {
    const result = filterAndSortReviewCandidates(candidates, {
      filters: {
        query: '',
        confidenceBands: ['high', 'medium', 'low', 'hidden'],
        reviewState: 'needs-attention',
        hasBlockersOnly: true,
      },
      sort: 'review-state',
    })

    expect(result.map(({ id }) => id)).toEqual(['candidate:token'])
  })

  test('sorts deterministically when semantic keys tie', () => {
    const reversed = [...candidates].reverse()
    const query = {
      filters: {
        query: '',
        confidenceBands: ['high', 'medium', 'low', 'hidden'] as const,
        reviewState: 'all' as const,
        hasBlockersOnly: false,
      },
      sort: 'target-endpoint' as const,
    }

    expect(filterAndSortReviewCandidates(reversed, query)).toEqual(
      filterAndSortReviewCandidates(candidates, query),
    )
  })

  test('does not mutate the supplied candidate order', () => {
    const originalIds = candidates.map(({ id }) => id)
    filterAndSortReviewCandidates(candidates, {
      ...defaultQuery,
      filters: { ...defaultQuery.filters, reviewState: 'all' },
    })

    expect(candidates.map(({ id }) => id)).toEqual(originalIds)
  })
})
