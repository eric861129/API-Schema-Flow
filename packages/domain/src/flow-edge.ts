import type { SourcePointer } from './source-pointer.js'
import type { FlowDataMapping } from './flow-value.js'

export const DECLARED_FLOW_PROVENANCE = 'declared' as const
export const ACCEPTED_FLOW_STATUS = 'accepted' as const

export type FlowEdgeKind = 'control' | 'dependency' | 'data'
export type FlowEdgeProvenance = 'declared' | 'manual' | 'inferred' | 'observed'
export type FlowEdgeStatus = 'accepted' | 'candidate' | 'rejected'
export type SourceStandard = 'openapi-link' | 'arazzo'

export interface SourceStandardRef {
  readonly standard: SourceStandard
  readonly source: SourcePointer
}

export interface FlowEdge {
  readonly id: string
  readonly kind: FlowEdgeKind
  readonly sourceNodeId: string
  readonly targetNodeId: string
  readonly provenance: FlowEdgeProvenance
  readonly status: FlowEdgeStatus
  readonly mappings: readonly FlowDataMapping[]
  readonly sourceStandardRefs: readonly SourceStandardRef[]
}
