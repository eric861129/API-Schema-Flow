import { describe, expect, test } from 'vitest'

import type { InferenceCandidate, ReviewDecision } from '@api-schema-flow/domain'

import { createReviewDecisionId, resolveReviewDecisions } from '../../src/index.js'

function candidate(overrides: Partial<InferenceCandidate> = {}): InferenceCandidate {
  return {
    schemaVersion: '1.0',
    id: 'candidate:abc',
    fingerprint: 'abc',
    ruleSetVersion: 'm2c-v1',
    sourceOperationNodeId: 'endpoint:api:operation:post:/reservations',
    targetOperationNodeId: 'endpoint:api:operation:get:/reservations/{id}',
    sourceOperationKey: 'operation:post:/reservations',
    targetOperationKey: 'operation:get:/reservations/{id}',
    mapping: {
      id: 'mapping:abc',
      source: { kind: 'response-body', pointer: '#/id' },
      target: { kind: 'path-parameter', name: 'id' },
      aliases: [],
      sourcePointers: [],
    },
    score: 90,
    confidence: 0.95,
    band: 'high',
    evidence: [],
    blockers: [],
    provenance: 'inferred',
    status: 'candidate',
    ...overrides,
  }
}

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

function resolve(decisions: ReviewDecision[], candidates = [candidate()]) {
  return resolveReviewDecisions({
    candidates,
    decisionSet: { schemaVersion: '1.0', revision: 1, decisions, manualEdges: [] },
  })
}

describe('review decision resolution', () => {
  test('selects the highest revision and marks lower revisions superseded', () => {
    const result = resolve([decision(), decision({ revision: 2, action: 'reject' })])
    expect(result.active).toEqual([expect.objectContaining({ revision: 2, action: 'reject' })])
    expect(result.outcomes).toContainEqual(
      expect.objectContaining({ state: 'superseded', candidateId: 'candidate:abc' }),
    )
  })

  test('deduplicates exact records but blocks conflicting highest revisions', () => {
    const duplicate = decision({ revision: 2 })
    const ok = resolve([duplicate, duplicate])
    expect(ok.active).toHaveLength(1)

    const conflict = resolve([duplicate, decision({ revision: 2, action: 'reject' })])
    expect(conflict.active).toEqual([])
    expect(conflict.outcomes).toContainEqual(expect.objectContaining({ state: 'invalid' }))
    expect(conflict.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'ASF-REV-1005', severity: 'error' }),
    )
  })

  test('marks changed fingerprints or rule sets stale', () => {
    const result = resolve([decision()], [candidate({ fingerprint: 'changed' })])
    expect(result.active).toEqual([])
    expect(result.outcomes).toContainEqual(expect.objectContaining({ state: 'stale' }))
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'ASF-REV-1003', severity: 'warning' }),
    )
  })

  test('marks absent candidates orphaned', () => {
    const result = resolve([decision()], [])
    expect(result.active).toEqual([])
    expect(result.outcomes).toContainEqual(expect.objectContaining({ state: 'orphaned' }))
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'ASF-REV-1004', severity: 'warning' }),
    )
  })
})
