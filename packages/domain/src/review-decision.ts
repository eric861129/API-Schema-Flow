import type { FlowEdge } from './flow-edge.js'
import type { FlowDataMapping } from './flow-value.js'

export const REVIEW_DECISION_SCHEMA_VERSION = '1.0' as const

export type ReviewDecisionAction = 'accept' | 'reject' | 'edit'
export type ReviewDecisionOutcomeState =
  'applied' | 'rejected' | 'stale' | 'orphaned' | 'superseded' | 'already-present' | 'invalid'

export interface ReviewDecision {
  readonly schemaVersion: typeof REVIEW_DECISION_SCHEMA_VERSION
  readonly id: string
  readonly candidateId: string
  readonly candidateFingerprint: string
  readonly ruleSetVersion: string
  readonly revision: number
  readonly action: ReviewDecisionAction
  readonly editedMapping?: FlowDataMapping
  readonly decidedAt?: string
}

export interface ReviewDecisionSet {
  readonly schemaVersion: typeof REVIEW_DECISION_SCHEMA_VERSION
  readonly revision: number
  readonly decisions: readonly ReviewDecision[]
  readonly manualEdges: readonly FlowEdge[]
}

export interface ReviewDecisionOutcome {
  readonly decisionId: string
  readonly candidateId: string
  readonly state: ReviewDecisionOutcomeState
  readonly edgeId?: string
  readonly reason?: string
}
