import type { NormalizedApiDocument } from './document.js'
import { FLOW_GRAPH_SCHEMA_VERSION, type FlowGraph } from './flow-graph.js'
import type { InferenceCandidate } from './inference.js'
import {
  REVIEW_DECISION_SCHEMA_VERSION,
  type ReviewDecisionOutcome,
  type ReviewDecisionSet,
} from './review-decision.js'
import type { ReadOnlyWorkspaceProject } from './workspace-snapshot.js'

export const REVIEW_WORKSPACE_SNAPSHOT_SCHEMA_VERSION = '1.1' as const

export interface ReviewWorkspaceContext {
  readonly projectFingerprint: string
  readonly sourceRevision: string
}

export interface ReviewWorkspaceSnapshot<TDiagnostic = unknown> {
  readonly schemaVersion: typeof REVIEW_WORKSPACE_SNAPSHOT_SCHEMA_VERSION
  readonly generatedBy: {
    readonly package: 'api-schema-flow'
    readonly milestone: 'M3-B1'
  }
  readonly project: ReadOnlyWorkspaceProject
  readonly reviewContext: ReviewWorkspaceContext
  readonly apiDocument: NormalizedApiDocument
  readonly declaredGraph: FlowGraph
  readonly acceptedGraph: FlowGraph
  readonly inferenceCandidates: readonly InferenceCandidate[]
  readonly reviewDecisionSet: ReviewDecisionSet
  readonly reviewOutcomes: readonly ReviewDecisionOutcome[]
  readonly diagnostics: readonly TDiagnostic[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isDeterministicContextString(value: unknown): value is string {
  return isNonEmptyString(value) && value === value.trim()
}

function isProject(value: unknown): value is ReadOnlyWorkspaceProject {
  return (
    isRecord(value) &&
    isNonEmptyString(value.name) &&
    isNonEmptyString(value.sourceName) &&
    isNonEmptyString(value.sourceUri) &&
    isNonEmptyString(value.openapiVersion)
  )
}

function isApiDocument(value: unknown): value is NormalizedApiDocument {
  if (!isRecord(value) || !isRecord(value.info)) return false

  return (
    value.schemaVersion === '1.0' &&
    isNonEmptyString(value.sourceUri) &&
    isNonEmptyString(value.openapiVersion) &&
    typeof value.compatibilityMode === 'boolean' &&
    isNonEmptyString(value.info.title) &&
    isNonEmptyString(value.info.version) &&
    Array.isArray(value.tags) &&
    Array.isArray(value.servers) &&
    Array.isArray(value.operations) &&
    Array.isArray(value.componentSchemas)
  )
}

function isOperationTopologyGraph(value: unknown): value is FlowGraph {
  return (
    isRecord(value) &&
    value.schemaVersion === FLOW_GRAPH_SCHEMA_VERSION &&
    value.kind === 'operation-topology' &&
    isNonEmptyString(value.id) &&
    Array.isArray(value.sourceIds) &&
    Array.isArray(value.nodes) &&
    Array.isArray(value.edges)
  )
}

function isReviewDecisionSet(value: unknown): value is ReviewDecisionSet {
  return (
    isRecord(value) &&
    value.schemaVersion === REVIEW_DECISION_SCHEMA_VERSION &&
    Number.isInteger(value.revision) &&
    typeof value.revision === 'number' &&
    value.revision >= 0 &&
    Array.isArray(value.decisions) &&
    Array.isArray(value.manualEdges)
  )
}

export function isReviewWorkspaceSnapshot(value: unknown): value is ReviewWorkspaceSnapshot {
  if (!isRecord(value) || value.schemaVersion !== REVIEW_WORKSPACE_SNAPSHOT_SCHEMA_VERSION) {
    return false
  }

  const generatedBy = value.generatedBy
  const reviewContext = value.reviewContext

  return (
    isRecord(generatedBy) &&
    generatedBy.package === 'api-schema-flow' &&
    generatedBy.milestone === 'M3-B1' &&
    isProject(value.project) &&
    isRecord(reviewContext) &&
    isDeterministicContextString(reviewContext.projectFingerprint) &&
    isDeterministicContextString(reviewContext.sourceRevision) &&
    isApiDocument(value.apiDocument) &&
    isOperationTopologyGraph(value.declaredGraph) &&
    isOperationTopologyGraph(value.acceptedGraph) &&
    Array.isArray(value.inferenceCandidates) &&
    isReviewDecisionSet(value.reviewDecisionSet) &&
    Array.isArray(value.reviewOutcomes) &&
    Array.isArray(value.diagnostics)
  )
}
