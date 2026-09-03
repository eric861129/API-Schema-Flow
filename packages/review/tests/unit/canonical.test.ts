import { describe, expect, test } from 'vitest'

import type { ReviewDecision } from '@api-schema-flow/domain'

import { createReviewDecisionId } from '../../src/index.js'

function semanticDecision(overrides: Partial<Omit<ReviewDecision, 'id'>> = {}) {
  return {
    schemaVersion: '1.0' as const,
    candidateId: 'candidate:abc',
    candidateFingerprint: 'abc',
    ruleSetVersion: 'm2c-v1',
    revision: 1,
    action: 'accept' as const,
    ...overrides,
  }
}

describe('review decision identity', () => {
  test('ignores decidedAt metadata', () => {
    const first = createReviewDecisionId(semanticDecision({ decidedAt: '2026-09-03T00:00:00Z' }))
    const second = createReviewDecisionId(semanticDecision({ decidedAt: '2026-09-04T00:00:00Z' }))

    expect(first).toBe(second)
    expect(first).toMatch(/^decision:[0-9a-f]{16}$/)
  })

  test('changes when edited mapping semantics change', () => {
    const first = createReviewDecisionId(
      semanticDecision({
        action: 'edit',
        editedMapping: {
          id: 'ignored-one',
          source: { kind: 'response-body', pointer: '#/reservationId' },
          target: { kind: 'path-parameter', name: 'id' },
          aliases: [],
          sourcePointers: [],
        },
      }),
    )
    const second = createReviewDecisionId(
      semanticDecision({
        action: 'edit',
        editedMapping: {
          id: 'ignored-two',
          source: { kind: 'response-body', pointer: '#/reservationId' },
          target: { kind: 'query-parameter', name: 'id' },
          aliases: [],
          sourcePointers: [],
        },
      }),
    )

    expect(first).not.toBe(second)
  })
})
