import { readFile } from 'node:fs/promises'

import {
  INFERENCE_SCHEMA_VERSION,
  REVIEW_WORKSPACE_SNAPSHOT_SCHEMA_VERSION,
  isReviewWorkspaceSnapshot,
  type ReviewWorkspaceSnapshot,
} from '@api-schema-flow/domain'
import { describe, expect, test } from 'vitest'

import { materializeReviewedOperationGraph } from '../../src/index.js'

const fixtureUrl = new URL(
  '../../../../apps/web/public/fixtures/reservation-workspace.json',
  import.meta.url,
)

async function loadFixture(): Promise<unknown> {
  return JSON.parse(await readFile(fixtureUrl, 'utf8')) as unknown
}

function requireReviewSnapshot(value: unknown): ReviewWorkspaceSnapshot {
  expect(isReviewWorkspaceSnapshot(value)).toBe(true)
  if (!isReviewWorkspaceSnapshot(value)) {
    throw new Error('Reservation fixture is not a Review Workspace Snapshot 1.1.')
  }
  return value
}

describe('Reservation Review Workspace fixture', () => {
  test('is a structurally valid Snapshot 1.1', async () => {
    const snapshot = requireReviewSnapshot(await loadFixture())

    expect(snapshot.schemaVersion).toBe(REVIEW_WORKSPACE_SNAPSHOT_SCHEMA_VERSION)
    expect(snapshot.generatedBy).toEqual({
      package: 'api-schema-flow',
      milestone: 'M3-B1',
    })
    expect(snapshot.reviewContext.projectFingerprint).not.toHaveLength(0)
    expect(snapshot.reviewContext.sourceRevision).not.toHaveLength(0)
    expect(snapshot.declaredGraph.kind).toBe('operation-topology')
    expect(snapshot.acceptedGraph.kind).toBe('operation-topology')
  })

  test('emits current Domain candidate and mapping fields', async () => {
    const snapshot = requireReviewSnapshot(await loadFixture())

    expect(snapshot.inferenceCandidates.length).toBeGreaterThanOrEqual(4)
    for (const candidate of snapshot.inferenceCandidates) {
      expect(candidate).toEqual(
        expect.objectContaining({
          schemaVersion: INFERENCE_SCHEMA_VERSION,
          id: expect.any(String),
          fingerprint: expect.any(String),
          ruleSetVersion: expect.any(String),
          sourceOperationNodeId: expect.any(String),
          targetOperationNodeId: expect.any(String),
          sourceOperationKey: expect.any(String),
          targetOperationKey: expect.any(String),
          mapping: expect.objectContaining({
            id: expect.any(String),
            source: expect.any(Object),
            target: expect.any(Object),
            aliases: expect.any(Array),
            sourcePointers: expect.any(Array),
          }),
          score: expect.any(Number),
          confidence: expect.any(Number),
          band: expect.stringMatching(/^(high|medium|low)$/),
          evidence: expect.any(Array),
          blockers: expect.any(Array),
          provenance: 'inferred',
          status: 'candidate',
        }),
      )

      for (const evidence of [...candidate.evidence, ...candidate.blockers]) {
        expect(evidence).toEqual(
          expect.objectContaining({
            ruleId: expect.any(String),
            kind: expect.stringMatching(/^(positive|penalty|blocker)$/),
            weight: expect.any(Number),
            message: expect.any(String),
            sourcePointers: expect.any(Array),
          }),
        )
      }
    }
  })

  test('rebuilds accepted graph and outcomes through Review core', async () => {
    const snapshot = requireReviewSnapshot(await loadFixture())

    const result = materializeReviewedOperationGraph({
      declaredOperationGraph: snapshot.declaredGraph,
      candidates: snapshot.inferenceCandidates,
      decisionSet: snapshot.reviewDecisionSet,
    })

    expect(result.diagnostics).toEqual([])
    expect(result.graph).toEqual(snapshot.acceptedGraph)
    expect(result.outcomes).toEqual(snapshot.reviewOutcomes)
  })
})
