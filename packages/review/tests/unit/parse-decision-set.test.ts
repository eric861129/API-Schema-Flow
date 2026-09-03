import { describe, expect, test } from 'vitest'

import type { ReviewDecision } from '@api-schema-flow/domain'

import { createReviewDecisionId, parseReviewDecisionSet } from '../../src/index.js'

function decision(overrides: Partial<Omit<ReviewDecision, 'id'>> = {}): ReviewDecision {
  const semantic = {
    schemaVersion: '1.0' as const,
    candidateId: 'candidate:abc',
    candidateFingerprint: 'abc',
    ruleSetVersion: 'm2c-v1',
    revision: 1,
    action: 'accept' as const,
    ...overrides,
  }
  return { ...semantic, id: createReviewDecisionId(semantic) }
}

function set(value: unknown) {
  return parseReviewDecisionSet({
    schemaVersion: '1.0',
    revision: 1,
    decisions: [value],
    manualEdges: [],
  })
}

describe('review decision set parser', () => {
  test('accepts a canonical valid decision set', () => {
    const result = set(decision({ decidedAt: '2026-09-03T00:00:00.000Z' }))
    expect(result.diagnostics).toEqual([])
    expect(result.decisionSet?.decisions).toHaveLength(1)
  })

  test('rejects malformed manual edges before materialization', () => {
    const result = parseReviewDecisionSet({
      schemaVersion: '1.0',
      revision: 1,
      decisions: [],
      manualEdges: [
        {
          id: 'edge:manual',
          kind: 'data',
          sourceNodeId: 'endpoint:source',
          targetNodeId: 'endpoint:target',
          provenance: 'manual',
          status: 'accepted',
          mappings: [{}],
          sourceStandardRefs: [],
        },
      ],
    })

    expect(result.decisionSet).toBeUndefined()
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'ASF-REV-1006', severity: 'error' }),
    )
  })

  test.each([
    ['wrong schema version', { ...decision(), schemaVersion: '2.0' }],
    ['invalid timestamp', decision({ decidedAt: 'not-a-date' })],
    ['edit without mapping', decision({ action: 'edit' })],
    [
      'accept with mapping',
      decision({
        editedMapping: {
          id: 'mapping:x',
          source: { kind: 'response-body', pointer: '#/id' },
          target: { kind: 'path-parameter', name: 'id' },
          aliases: [],
          sourcePointers: [],
        },
      }),
    ],
    ['decision id mismatch', { ...decision(), id: 'decision:wrong' }],
  ])('rejects %s', (_label, value) => {
    const result = set(value)
    expect(result.decisionSet).toBeUndefined()
    expect(result.diagnostics.some(({ severity }) => severity === 'error')).toBe(true)
  })
})
