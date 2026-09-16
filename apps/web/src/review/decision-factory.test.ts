import { describe, expect, test } from 'vitest'

import {
  INFERENCE_SCHEMA_VERSION,
  REVIEW_DECISION_SCHEMA_VERSION,
  type InferenceCandidate,
  type ReviewDecisionSet,
} from '@api-schema-flow/domain'
import { createReviewDecisionId } from '@api-schema-flow/review/browser'

import { createReviewDecisionFromIntent, deriveBaselineRevisions } from './decision-factory'

const sourcePointer = {
  uri: 'fixture://reservation/openapi.yaml',
  pointer: '#/paths/~1reservations/post',
} as const

const candidate: InferenceCandidate = {
  schemaVersion: INFERENCE_SCHEMA_VERSION,
  id: 'candidate:reservation-id',
  fingerprint: 'fingerprint:reservation-id',
  ruleSetVersion: '1.0.0',
  sourceOperationNodeId: 'endpoint:create-reservation',
  targetOperationNodeId: 'endpoint:get-reservation',
  sourceOperationKey: 'operation:post:/reservations',
  targetOperationKey: 'operation:get:/reservations/{id}',
  mapping: {
    id: 'mapping:reservation-id',
    source: { kind: 'response-body', pointer: '#/id' },
    target: { kind: 'path-parameter', name: 'id' },
    aliases: [],
    sourcePointers: [sourcePointer],
  },
  score: 74,
  confidence: 0.94,
  band: 'high',
  evidence: [],
  blockers: [],
  provenance: 'inferred',
  status: 'candidate',
}

describe('review decision factory', () => {
  test('creates the exact deterministic Domain Accept decision', () => {
    const semanticDecision = {
      schemaVersion: REVIEW_DECISION_SCHEMA_VERSION,
      candidateId: candidate.id,
      candidateFingerprint: candidate.fingerprint,
      ruleSetVersion: candidate.ruleSetVersion,
      revision: 4,
      action: 'accept' as const,
    }

    expect(
      createReviewDecisionFromIntent(
        { action: 'accept', candidateId: candidate.id, revision: 4 },
        candidate,
      ),
    ).toEqual({
      ...semanticDecision,
      id: createReviewDecisionId(semanticDecision),
    })
  })

  test('keeps structured Reject reason and note out of the Domain decision', () => {
    const decision = createReviewDecisionFromIntent(
      {
        action: 'reject',
        candidateId: candidate.id,
        revision: 5,
        reason: 'other',
        note: 'The value belongs to another bounded context.',
      },
      candidate,
    )

    expect(decision).toMatchObject({
      schemaVersion: '1.0',
      candidateId: candidate.id,
      candidateFingerprint: candidate.fingerprint,
      ruleSetVersion: candidate.ruleSetVersion,
      revision: 5,
      action: 'reject',
    })
    expect(decision).not.toHaveProperty('reason')
    expect(decision).not.toHaveProperty('note')
    expect(decision).not.toHaveProperty('decidedAt')
  })

  test('rejects an intent bound to a different candidate', () => {
    expect(() =>
      createReviewDecisionFromIntent(
        { action: 'accept', candidateId: 'candidate:other', revision: 1 },
        candidate,
      ),
    ).toThrow(
      'Review intent candidate "candidate:other" does not match "candidate:reservation-id".',
    )
  })

  test('derives deterministic maximum baseline revisions per candidate', () => {
    const decisionSet: ReviewDecisionSet = {
      schemaVersion: REVIEW_DECISION_SCHEMA_VERSION,
      revision: 3,
      decisions: [
        {
          schemaVersion: REVIEW_DECISION_SCHEMA_VERSION,
          id: 'decision:second',
          candidateId: 'candidate:b',
          candidateFingerprint: 'fingerprint:b',
          ruleSetVersion: '1.0.0',
          revision: 2,
          action: 'reject',
        },
        {
          schemaVersion: REVIEW_DECISION_SCHEMA_VERSION,
          id: 'decision:first-v3',
          candidateId: 'candidate:a',
          candidateFingerprint: 'fingerprint:a',
          ruleSetVersion: '1.0.0',
          revision: 3,
          action: 'accept',
        },
        {
          schemaVersion: REVIEW_DECISION_SCHEMA_VERSION,
          id: 'decision:first-v1',
          candidateId: 'candidate:a',
          candidateFingerprint: 'fingerprint:a',
          ruleSetVersion: '1.0.0',
          revision: 1,
          action: 'reject',
        },
      ],
      manualEdges: [],
    }

    expect(deriveBaselineRevisions(decisionSet)).toEqual({
      'candidate:a': 3,
      'candidate:b': 2,
    })
  })
})
