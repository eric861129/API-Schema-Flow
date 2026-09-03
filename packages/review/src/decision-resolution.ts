import type {
  InferenceCandidate,
  ReviewDecision,
  ReviewDecisionOutcome,
} from '@api-schema-flow/domain'
import { DIAGNOSTIC_CODES, sortDiagnostics, type Diagnostic } from '@api-schema-flow/diagnostics'
import { canonicalizeJson } from '@api-schema-flow/flow'

import type { ResolveReviewDecisionsInput, ResolveReviewDecisionsResult } from './contracts.js'

function outcome(
  decision: ReviewDecision,
  state: ReviewDecisionOutcome['state'],
  reason?: string,
): ReviewDecisionOutcome {
  return {
    decisionId: decision.id,
    candidateId: decision.candidateId,
    state,
    ...(reason === undefined ? {} : { reason }),
  }
}

function decisionSemantics(decision: ReviewDecision): string {
  return canonicalizeJson({
    id: decision.id,
    candidateId: decision.candidateId,
    candidateFingerprint: decision.candidateFingerprint,
    ruleSetVersion: decision.ruleSetVersion,
    revision: decision.revision,
    action: decision.action,
    ...(decision.editedMapping === undefined ? {} : { editedMapping: decision.editedMapping }),
  })
}

function candidateIndex(
  candidates: readonly InferenceCandidate[],
): Map<string, InferenceCandidate> {
  return new Map(
    [...candidates]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((candidate) => [candidate.id, candidate]),
  )
}

export function resolveReviewDecisions(
  input: ResolveReviewDecisionsInput,
): ResolveReviewDecisionsResult {
  const diagnostics: Diagnostic[] = []
  const outcomes: ReviewDecisionOutcome[] = []
  const active: ReviewDecision[] = []
  const candidates = candidateIndex(input.candidates)
  const groups = new Map<string, ReviewDecision[]>()

  for (const decision of input.decisionSet.decisions) {
    const group = groups.get(decision.candidateId) ?? []
    group.push(decision)
    groups.set(decision.candidateId, group)
  }

  for (const [candidateId, group] of [...groups.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    const highestRevision = Math.max(...group.map(({ revision }) => revision))
    const lower = group.filter(({ revision }) => revision < highestRevision)
    for (const decision of lower) {
      outcomes.push(outcome(decision, 'superseded', `Superseded by revision ${highestRevision}.`))
    }

    const highest = group.filter(({ revision }) => revision === highestRevision)
    const unique = new Map(highest.map((decision) => [decisionSemantics(decision), decision]))
    if (unique.size > 1) {
      for (const decision of [...unique.values()].sort((left, right) =>
        left.id.localeCompare(right.id),
      )) {
        outcomes.push(
          outcome(decision, 'invalid', 'Conflicting decisions share the highest revision.'),
        )
      }
      diagnostics.push({
        code: DIAGNOSTIC_CODES.REVIEW_DECISION_CONFLICT,
        severity: 'error',
        message: `Candidate "${candidateId}" has conflicting review decisions at revision ${highestRevision}.`,
        details: { candidateId, revision: highestRevision },
      })
      continue
    }

    const decision = [...unique.values()][0]!
    const candidate = candidates.get(candidateId)
    if (candidate === undefined) {
      outcomes.push(outcome(decision, 'orphaned', 'The reviewed candidate is not present.'))
      diagnostics.push({
        code: DIAGNOSTIC_CODES.REVIEW_DECISION_ORPHANED,
        severity: 'warning',
        message: `Review decision "${decision.id}" references an absent candidate.`,
        details: { candidateId },
      })
      continue
    }
    if (
      candidate.fingerprint !== decision.candidateFingerprint ||
      candidate.ruleSetVersion !== decision.ruleSetVersion
    ) {
      outcomes.push(
        outcome(decision, 'stale', 'Candidate fingerprint or rule-set version changed.'),
      )
      diagnostics.push({
        code: DIAGNOSTIC_CODES.REVIEW_DECISION_STALE,
        severity: 'warning',
        message: `Review decision "${decision.id}" is stale for the current candidate.`,
        details: { candidateId },
      })
      continue
    }
    active.push(decision)
  }

  return {
    active: active.sort((left, right) => left.candidateId.localeCompare(right.candidateId)),
    outcomes: outcomes.sort(
      (left, right) =>
        left.candidateId.localeCompare(right.candidateId) ||
        left.decisionId.localeCompare(right.decisionId) ||
        left.state.localeCompare(right.state),
    ),
    diagnostics: sortDiagnostics(diagnostics),
  }
}
