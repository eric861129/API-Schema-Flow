import { describe, expect, test } from 'vitest'

import rawSnapshot from '../../public/fixtures/reservation-workspace.json'
import { REVIEW_DECISION_SCHEMA_VERSION, type InferenceCandidate } from '@api-schema-flow/domain'
import { materializeReviewedOperationGraph } from '@api-schema-flow/review/browser'

import { loadWorkspaceSnapshot } from '../data/load-workspace'
import type { WorkspaceSnapshot } from '../data/types'
import { deriveBaselineRevisions } from './decision-factory'
import { materializeReviewSession } from './review-engine'
import {
  createInitialReviewSession,
  reviewSessionReducer,
  type ReviewSessionState,
} from './review-session'

async function canonicalSnapshot(): Promise<WorkspaceSnapshot> {
  return loadWorkspaceSnapshot(
    '/fixture.json',
    async () =>
      new Response(JSON.stringify(rawSnapshot), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
  )
}

function candidateBySource(
  snapshot: WorkspaceSnapshot,
  sourceOperationKey: string,
): InferenceCandidate {
  const candidate = snapshot.inferenceCandidates.find(
    (value) => value.sourceOperationKey === sourceOperationKey,
  )
  if (!candidate) throw new Error(`Missing candidate from ${sourceOperationKey}`)
  return candidate
}

function emptyBaseline(snapshot: WorkspaceSnapshot): WorkspaceSnapshot {
  const reviewDecisionSet = {
    schemaVersion: REVIEW_DECISION_SCHEMA_VERSION,
    revision: 0,
    decisions: [],
    manualEdges: [],
  } as const
  const baseline = materializeReviewedOperationGraph({
    declaredOperationGraph: snapshot.declaredGraph,
    candidates: snapshot.inferenceCandidates,
    decisionSet: reviewDecisionSet,
  })

  return {
    ...snapshot,
    reviewDecisionSet,
    acceptedGraph: baseline.graph,
    reviewOutcomes: baseline.outcomes,
  }
}

function initialSession(snapshot: WorkspaceSnapshot): ReviewSessionState {
  return createInitialReviewSession({
    projectFingerprint: snapshot.reviewContext.projectFingerprint,
    sourceRevision: snapshot.reviewContext.sourceRevision,
    baselineRevisions: deriveBaselineRevisions(snapshot.reviewDecisionSet),
  })
}

describe('review session materialization', () => {
  test('reconstructs the stored baseline accepted graph and outcomes', async () => {
    const snapshot = await canonicalSnapshot()
    const materialization = materializeReviewSession(snapshot, initialSession(snapshot))

    expect(materialization.result.graph).toEqual(snapshot.acceptedGraph)
    expect(materialization.result.outcomes).toEqual(snapshot.reviewOutcomes)
    expect(materialization.draftDecisions).toEqual([])
  })

  test('Accept adds one inferred accepted edge from the declared graph', async () => {
    const snapshot = emptyBaseline(await canonicalSnapshot())
    const candidate = candidateBySource(snapshot, 'operation:post:/auth/login')
    const session = reviewSessionReducer(initialSession(snapshot), {
      type: 'accept-candidate',
      candidateId: candidate.id,
    })

    const materialization = materializeReviewSession(snapshot, session)
    const added = materialization.result.graph.edges.find(
      (edge) => edge.review?.candidateId === candidate.id,
    )

    expect(materialization.result.graph.edges).toHaveLength(snapshot.declaredGraph.edges.length + 1)
    expect(added).toMatchObject({ provenance: 'inferred', status: 'accepted' })
  })

  test('a higher Reject supersedes a draft Accept and removes its inferred edge', async () => {
    const snapshot = emptyBaseline(await canonicalSnapshot())
    const candidate = candidateBySource(snapshot, 'operation:post:/auth/login')
    let session = initialSession(snapshot)
    session = reviewSessionReducer(session, {
      type: 'accept-candidate',
      candidateId: candidate.id,
    })
    session = reviewSessionReducer(session, {
      type: 'reject-candidate',
      candidateId: candidate.id,
      reason: 'wrong-field',
    })

    const materialization = materializeReviewSession(snapshot, session)

    expect(materialization.result.graph).toEqual(snapshot.declaredGraph)
    expect(materialization.result.outcomes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ candidateId: candidate.id, state: 'superseded' }),
        expect.objectContaining({ candidateId: candidate.id, state: 'rejected' }),
      ]),
    )
  })

  test('Reject never removes a declared equivalent relationship', async () => {
    const snapshot = emptyBaseline(await canonicalSnapshot())
    const candidate = snapshot.inferenceCandidates.find(
      ({ sourceOperationKey, targetOperationKey }) =>
        sourceOperationKey === 'operation:post:/reservations' &&
        targetOperationKey === 'operation:get:/reservations/{id}',
    )
    if (!candidate) throw new Error('Missing declared-equivalent candidate')

    let session = initialSession(snapshot)
    session = reviewSessionReducer(session, {
      type: 'accept-candidate',
      candidateId: candidate.id,
    })
    session = reviewSessionReducer(session, {
      type: 'reject-candidate',
      candidateId: candidate.id,
      reason: 'duplicate',
    })

    const materialization = materializeReviewSession(snapshot, session)

    expect(materialization.result.graph.edges).toEqual(snapshot.declaredGraph.edges)
    expect(materialization.result.graph.edges[0]?.provenance).toBe('declared')
  })

  test('Undo returns the previous graph and outcome set', async () => {
    const snapshot = emptyBaseline(await canonicalSnapshot())
    const candidate = candidateBySource(snapshot, 'operation:post:/auth/login')
    const accepted = reviewSessionReducer(initialSession(snapshot), {
      type: 'accept-candidate',
      candidateId: candidate.id,
    })
    const undone = reviewSessionReducer(accepted, { type: 'undo-last-draft' })

    expect(materializeReviewSession(snapshot, undone).result).toEqual(
      materializeReviewSession(snapshot, initialSession(snapshot)).result,
    )
  })

  test('always starts from declaredGraph and leaves snapshot/session arrays untouched', async () => {
    const snapshot = await canonicalSnapshot()
    const session = initialSession(snapshot)
    const declaredEdges = snapshot.declaredGraph.edges
    const acceptedEdges = snapshot.acceptedGraph.edges
    const baselineDecisions = snapshot.reviewDecisionSet.decisions
    const draftIntents = session.draftIntents

    const poisonedSnapshot: WorkspaceSnapshot = {
      ...snapshot,
      acceptedGraph: {
        ...snapshot.acceptedGraph,
        edges: [
          ...snapshot.acceptedGraph.edges,
          {
            ...snapshot.acceptedGraph.edges[0]!,
            id: 'edge:accepted-graph-only-sentinel',
          },
        ],
      },
    }
    const result = materializeReviewSession(poisonedSnapshot, session)

    expect(
      result.result.graph.edges.some(({ id }) => id === 'edge:accepted-graph-only-sentinel'),
    ).toBe(false)
    expect(snapshot.declaredGraph.edges).toBe(declaredEdges)
    expect(snapshot.acceptedGraph.edges).toBe(acceptedEdges)
    expect(snapshot.reviewDecisionSet.decisions).toBe(baselineDecisions)
    expect(session.draftIntents).toBe(draftIntents)
  })

  test('materializes 1,000 candidates against 500 nodes within the 250 ms budget', async () => {
    const canonical = emptyBaseline(await canonicalSnapshot())
    const seed = candidateBySource(canonical, 'operation:post:/auth/login')
    const nodes = Array.from({ length: 500 }, (_, index) => ({
      ...canonical.declaredGraph.nodes[index % canonical.declaredGraph.nodes.length]!,
      id: `endpoint:synthetic:${String(index).padStart(4, '0')}`,
      operationKey: `operation:get:/synthetic/${String(index).padStart(4, '0')}`,
      path: `/synthetic/${index}`,
    }))
    const candidates = Array.from({ length: 1_000 }, (_, index) => ({
      ...seed,
      id: `candidate:synthetic:${String(index).padStart(4, '0')}`,
      fingerprint: `fingerprint:synthetic:${String(index).padStart(4, '0')}`,
      sourceOperationNodeId: nodes[index % nodes.length]!.id,
      targetOperationNodeId: nodes[(index + 1) % nodes.length]!.id,
      sourceOperationKey: nodes[index % nodes.length]!.operationKey,
      targetOperationKey: nodes[(index + 1) % nodes.length]!.operationKey,
    }))
    const snapshot: WorkspaceSnapshot = {
      ...canonical,
      apiDocument: { ...canonical.apiDocument, operations: [] },
      declaredGraph: { ...canonical.declaredGraph, nodes, edges: [] },
      acceptedGraph: { ...canonical.acceptedGraph, nodes, edges: [] },
      inferenceCandidates: candidates,
    }
    const session = initialSession(snapshot)

    const durations = Array.from({ length: 3 }, () => {
      const startedAt = performance.now()
      materializeReviewSession(snapshot, session)
      return performance.now() - startedAt
    })

    expect(Math.max(...durations)).toBeLessThan(250)
  })
})
