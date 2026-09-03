import { describe, expect, test } from 'vitest'

import {
  REVIEW_DECISION_SCHEMA_VERSION,
  type FlowEdge,
  type ReviewDecision,
  type ReviewDecisionOutcome,
  type ReviewDecisionSet,
} from '../../src/index.js'

const decision: ReviewDecision = {
  schemaVersion: REVIEW_DECISION_SCHEMA_VERSION,
  id: 'decision:abc',
  candidateId: 'candidate:abc',
  candidateFingerprint: 'abc',
  ruleSetVersion: 'm2c-v1',
  revision: 1,
  action: 'accept',
  decidedAt: '2026-09-03T00:00:00.000Z',
}

const edge: FlowEdge = {
  id: 'edge:data:abc',
  kind: 'data',
  sourceNodeId: 'endpoint:source:create',
  targetNodeId: 'endpoint:source:get',
  provenance: 'inferred',
  status: 'accepted',
  mappings: [],
  sourceStandardRefs: [],
  review: {
    decisionId: decision.id,
    candidateId: decision.candidateId,
    candidateFingerprint: decision.candidateFingerprint,
    ruleSetVersion: decision.ruleSetVersion,
    evidenceRuleIds: ['INF-RESOURCE-ID'],
  },
}

const set: ReviewDecisionSet = {
  schemaVersion: REVIEW_DECISION_SCHEMA_VERSION,
  revision: 1,
  decisions: [decision],
  manualEdges: [edge],
}

const outcome: ReviewDecisionOutcome = {
  decisionId: decision.id,
  candidateId: decision.candidateId,
  state: 'applied',
  edgeId: edge.id,
}

describe('review decision domain contracts', () => {
  test('expose schema version 1.0 and remain JSON serializable', () => {
    expect(REVIEW_DECISION_SCHEMA_VERSION).toBe('1.0')
    expect(JSON.parse(JSON.stringify({ decision, set, outcome, edge }))).toEqual({
      decision,
      set,
      outcome,
      edge,
    })
  })

  test('support edit decisions with one structural mapping', () => {
    const edited: ReviewDecision = {
      ...decision,
      id: 'decision:edited',
      action: 'edit',
      editedMapping: {
        id: 'mapping:edited',
        source: { kind: 'response-body', pointer: '#/reservationId' },
        target: { kind: 'path-parameter', name: 'id' },
        aliases: [],
        sourcePointers: [],
      },
    }

    expect(edited.action).toBe('edit')
    expect(edited.editedMapping?.target).toEqual({ kind: 'path-parameter', name: 'id' })
  })
})
