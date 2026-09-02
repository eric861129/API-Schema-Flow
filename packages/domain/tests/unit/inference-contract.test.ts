import { describe, expect, test } from 'vitest'

import {
  CANDIDATE_FLOW_STATUS,
  INFERENCE_SCHEMA_VERSION,
  INFERRED_FLOW_PROVENANCE,
  type FlowDataMapping,
  type InferenceCandidate,
  type InferenceEvidence,
  type InferenceReport,
} from '../../src/index.js'

// RED contract: these project-owned inference exports do not exist yet.
const sourcePointer = {
  uri: 'memory://reservation.yaml',
  pointer:
    '#/paths/~1reservations/post/responses/201/content/application~1json/schema/properties/id',
}

const mapping: FlowDataMapping = {
  id: 'mapping:reservation-id',
  source: { kind: 'response-body', pointer: '#/id' },
  target: { kind: 'path-parameter', name: 'id' },
  aliases: [],
  sourcePointers: [sourcePointer],
}

const evidence: InferenceEvidence = {
  ruleId: 'INF-RESOURCE-ID',
  kind: 'positive',
  weight: 25,
  message: 'Response resource ID matches the target item parameter.',
  sourcePointers: [sourcePointer],
}

const candidate: InferenceCandidate = {
  schemaVersion: INFERENCE_SCHEMA_VERSION,
  id: 'candidate:reservation-id',
  fingerprint: 'reservation-id',
  ruleSetVersion: 'm2c-v1',
  sourceOperationNodeId: 'endpoint:reservationApi:operation:post:/reservations',
  targetOperationNodeId: 'endpoint:reservationApi:operation:get:/reservations/{id}',
  sourceOperationKey: 'operation:post:/reservations',
  targetOperationKey: 'operation:get:/reservations/{id}',
  mapping,
  score: 82,
  confidence: 0.95,
  band: 'high',
  evidence: [evidence],
  blockers: [],
  provenance: INFERRED_FLOW_PROVENANCE,
  status: CANDIDATE_FLOW_STATUS,
}

const report: InferenceReport = {
  schemaVersion: INFERENCE_SCHEMA_VERSION,
  ruleSetVersion: 'm2c-v1',
  candidates: [candidate],
  metrics: {
    sourceFieldCount: 1,
    targetFieldCount: 1,
    generatedPairCount: 1,
    blockedPairCount: 0,
    suppressedDeclaredCount: 0,
    emittedCandidateCount: 1,
    highConfidenceCount: 1,
    mediumConfidenceCount: 0,
    lowConfidenceCount: 0,
    truncated: false,
    elapsedMs: 0,
  },
  diagnostics: [],
}

describe('inference domain contracts', () => {
  test('expose stable candidate constants', () => {
    expect(INFERENCE_SCHEMA_VERSION).toBe('1.0')
    expect(INFERRED_FLOW_PROVENANCE).toBe('inferred')
    expect(CANDIDATE_FLOW_STATUS).toBe('candidate')
  })

  test('remain plain serializable values', () => {
    expect(JSON.parse(JSON.stringify(report))).toEqual(report)
  })

  test('model reviewable candidates without accepting them', () => {
    expect(candidate).toMatchObject({
      provenance: 'inferred',
      status: 'candidate',
      evidence: [expect.objectContaining({ ruleId: 'INF-RESOURCE-ID' })],
      blockers: [],
    })
  })
})
