import type {
  FlowGraph,
  InferenceCandidate,
  ReviewDecision,
  ReviewDecisionOutcome,
  ReviewDecisionSet,
} from '@api-schema-flow/domain'
import type { Diagnostic } from '@api-schema-flow/diagnostics'

export interface ParseReviewDecisionSetResult {
  readonly decisionSet?: ReviewDecisionSet
  readonly diagnostics: readonly Diagnostic[]
}

export interface ResolveReviewDecisionsInput {
  readonly candidates: readonly InferenceCandidate[]
  readonly decisionSet: ReviewDecisionSet
}

export interface ResolveReviewDecisionsResult {
  readonly active: readonly ReviewDecision[]
  readonly outcomes: readonly ReviewDecisionOutcome[]
  readonly diagnostics: readonly Diagnostic[]
}

export interface MaterializeReviewedGraphInput {
  readonly declaredOperationGraph: FlowGraph
  readonly candidates: readonly InferenceCandidate[]
  readonly decisionSet: ReviewDecisionSet
}

export interface ReviewMaterializationMetrics {
  readonly appliedCount: number
  readonly rejectedCount: number
  readonly staleCount: number
  readonly orphanedCount: number
  readonly supersededCount: number
  readonly alreadyPresentCount: number
}

export interface MaterializeReviewedGraphResult {
  readonly graph: FlowGraph
  readonly outcomes: readonly ReviewDecisionOutcome[]
  readonly metrics: ReviewMaterializationMetrics
  readonly diagnostics: readonly Diagnostic[]
}
