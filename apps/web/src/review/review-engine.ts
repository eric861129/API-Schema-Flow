import type { InferenceCandidate, ReviewDecision, ReviewDecisionSet } from '@api-schema-flow/domain'
import {
  canonicalizeDecisionSet,
  materializeReviewedOperationGraph,
  type MaterializeReviewedGraphResult,
} from '@api-schema-flow/review/browser'

import type { WorkspaceSnapshot } from '../data/types'
import { createReviewDecisionFromIntent } from './decision-factory'
import type { ReviewSessionState } from './review-session'

export interface ReviewSessionMaterialization {
  readonly decisionSet: ReviewDecisionSet
  readonly draftDecisions: readonly ReviewDecision[]
  readonly result: MaterializeReviewedGraphResult
}

function candidateIndex(
  candidates: readonly InferenceCandidate[],
): ReadonlyMap<string, InferenceCandidate> {
  return new Map(
    [...candidates]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((candidate) => [candidate.id, candidate]),
  )
}

export function materializeReviewSession(
  snapshot: WorkspaceSnapshot,
  session: ReviewSessionState,
): ReviewSessionMaterialization {
  const candidates = candidateIndex(snapshot.inferenceCandidates)
  const draftDecisions = session.draftIntents.map((intent) => {
    const candidate = candidates.get(intent.candidateId)
    if (!candidate) {
      throw new Error(`Review intent references unknown candidate "${intent.candidateId}".`)
    }
    return createReviewDecisionFromIntent(intent, candidate)
  })
  const draftRevisions = draftDecisions.map(({ revision }) => revision)
  const decisionSet = canonicalizeDecisionSet({
    schemaVersion: '1.0',
    revision: Math.max(snapshot.reviewDecisionSet.revision, 0, ...draftRevisions),
    decisions: [...snapshot.reviewDecisionSet.decisions, ...draftDecisions],
    manualEdges: snapshot.reviewDecisionSet.manualEdges,
  })

  return {
    decisionSet,
    draftDecisions,
    result: materializeReviewedOperationGraph({
      declaredOperationGraph: snapshot.declaredGraph,
      candidates: snapshot.inferenceCandidates,
      decisionSet,
    }),
  }
}
