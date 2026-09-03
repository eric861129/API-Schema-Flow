import { describe, expect, test } from 'vitest'

import {
  describeReviewCompatibility,
  groupReviewEvidence,
  type ReviewCandidateDetail,
} from './review-detail'

const candidate: ReviewCandidateDetail = {
  id: 'candidate:reservation',
  sourceOperationKey: 'operation:post:/reservations',
  sourceLabel: 'POST /reservations',
  sourceSelector: '$response.body#/reservationId',
  targetOperationKey: 'operation:get:/reservations/{id}',
  targetLabel: 'GET /reservations/{id}',
  targetDescriptor: 'path.id',
  confidence: 0.94,
  band: 'high',
  evidenceCount: 3,
  blockerCount: 0,
  state: 'pending',
  ruleSetVersion: '1.0.0',
  fingerprint: 'fingerprint:reservation',
  sourceSchema: { type: 'string', format: 'uuid' },
  targetSchema: { type: 'string', format: 'uuid', required: true },
  evidence: [
    {
      ruleId: 'INF-SCHEMA-TYPE',
      kind: 'positive',
      weight: 12,
      summary: 'Schema types match.',
      sourcePointers: [],
    },
    {
      ruleId: 'INF-RESOURCE-ID',
      kind: 'positive',
      weight: 25,
      summary: 'Resource-qualified IDs match.',
      sourcePointers: ['fixture://reservation/openapi.yaml#/paths'],
    },
    {
      ruleId: 'INF-CYCLE-RISK',
      kind: 'negative',
      weight: -8,
      summary: 'The mapping may create a reverse relation.',
      sourcePointers: [],
    },
  ],
  blockers: [],
}

describe('review candidate detail', () => {
  test('describes type, format, and required compatibility', () => {
    expect(describeReviewCompatibility(candidate)).toEqual([
      { state: 'compatible', label: 'Type compatible · string' },
      { state: 'compatible', label: 'Format compatible · uuid' },
      { state: 'compatible', label: 'Target value is required' },
    ])
  })

  test('adds array and blocker warnings without exposing runtime values', () => {
    expect(
      describeReviewCompatibility({
        ...candidate,
        sourceSchema: { ...candidate.sourceSchema, arrayDepth: 1 },
        blockers: [
          {
            code: 'INF-BLOCK-ARRAY-SELECTOR',
            summary: 'An explicit array selector is required.',
            sourcePointers: [],
          },
        ],
      }),
    ).toContainEqual({ state: 'blocked', label: 'An explicit array selector is required.' })
  })

  test('sorts evidence by absolute weight and stable rule ID inside each group', () => {
    const grouped = groupReviewEvidence(candidate)

    expect(grouped.positive.map(({ ruleId }) => ruleId)).toEqual([
      'INF-RESOURCE-ID',
      'INF-SCHEMA-TYPE',
    ])
    expect(grouped.negative.map(({ ruleId }) => ruleId)).toEqual(['INF-CYCLE-RISK'])
    expect(grouped.neutral).toEqual([])
  })
})
