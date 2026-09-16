import {
  REVIEW_DECISION_SCHEMA_VERSION,
  type InferenceCandidate,
  type ReviewDecision,
  type ReviewDecisionSet,
} from '@api-schema-flow/domain'
import { createReviewDecisionId } from '@api-schema-flow/review/browser'

import type { ReviewIntent } from './review-session'

export function deriveBaselineRevisions(
  decisionSet: ReviewDecisionSet,
): Readonly<Record<string, number>> {
  const revisions = new Map<string, number>()

  for (const decision of decisionSet.decisions) {
    revisions.set(
      decision.candidateId,
      Math.max(revisions.get(decision.candidateId) ?? 0, decision.revision),
    )
  }

  return Object.fromEntries(
    [...revisions.entries()].sort(([left], [right]) => left.localeCompare(right)),
  )
}

export function createReviewDecisionFromIntent(
  intent: ReviewIntent,
  candidate: InferenceCandidate,
): ReviewDecision {
  if (intent.candidateId !== candidate.id) {
    throw new Error(
      `Review intent candidate "${intent.candidateId}" does not match "${candidate.id}".`,
    )
  }

  const semanticDecision = {
    schemaVersion: REVIEW_DECISION_SCHEMA_VERSION,
    candidateId: candidate.id,
    candidateFingerprint: candidate.fingerprint,
    ruleSetVersion: candidate.ruleSetVersion,
    revision: intent.revision,
    action: intent.action,
  } as const

  return {
    ...semanticDecision,
    id: createReviewDecisionId(semanticDecision),
  }
}
