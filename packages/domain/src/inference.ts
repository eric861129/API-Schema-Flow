import type { FlowDataMapping } from './flow-value.js'
import type { SourcePointer } from './source-pointer.js'

export const INFERENCE_SCHEMA_VERSION = '1.0' as const
export const INFERRED_FLOW_PROVENANCE = 'inferred' as const
export const CANDIDATE_FLOW_STATUS = 'candidate' as const

export type InferenceEvidenceKind = 'positive' | 'penalty' | 'blocker'
export type InferenceConfidenceBand = 'high' | 'medium' | 'low'

export interface InferenceEvidence {
  readonly ruleId: string
  readonly kind: InferenceEvidenceKind
  readonly weight: number
  readonly message: string
  readonly sourcePointers: readonly SourcePointer[]
}

export interface InferenceCandidate {
  readonly schemaVersion: typeof INFERENCE_SCHEMA_VERSION
  readonly id: string
  readonly fingerprint: string
  readonly ruleSetVersion: string
  readonly sourceOperationNodeId: string
  readonly targetOperationNodeId: string
  readonly sourceOperationKey: string
  readonly targetOperationKey: string
  readonly mapping: FlowDataMapping
  readonly score: number
  readonly confidence: number
  readonly band: InferenceConfidenceBand
  readonly evidence: readonly InferenceEvidence[]
  readonly blockers: readonly InferenceEvidence[]
  readonly provenance: typeof INFERRED_FLOW_PROVENANCE
  readonly status: typeof CANDIDATE_FLOW_STATUS
}

export interface InferenceMetrics {
  readonly sourceFieldCount: number
  readonly targetFieldCount: number
  readonly generatedPairCount: number
  readonly blockedPairCount: number
  readonly suppressedDeclaredCount: number
  readonly emittedCandidateCount: number
  readonly highConfidenceCount: number
  readonly mediumConfidenceCount: number
  readonly lowConfidenceCount: number
  readonly truncated: boolean
  readonly elapsedMs: number
}

export interface InferenceReport<TDiagnostic = unknown> {
  readonly schemaVersion: typeof INFERENCE_SCHEMA_VERSION
  readonly ruleSetVersion: string
  readonly candidates: readonly InferenceCandidate[]
  readonly metrics: InferenceMetrics
  readonly diagnostics: readonly TDiagnostic[]
}
