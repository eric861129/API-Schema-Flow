import type { NormalizedApiDocument } from './document.js'
import type { FlowGraph } from './flow-graph.js'
import type { InferenceCandidate } from './inference.js'
import type { ReviewDecisionOutcome } from './review-decision.js'

export const READ_ONLY_WORKSPACE_SNAPSHOT_SCHEMA_VERSION = '1.0' as const

export interface ReadOnlyWorkspaceProject {
  readonly name: string
  readonly sourceName: string
  readonly sourceUri: string
  readonly openapiVersion: string
}

export interface ReadOnlyWorkspaceSnapshot<TDiagnostic = unknown> {
  readonly schemaVersion: typeof READ_ONLY_WORKSPACE_SNAPSHOT_SCHEMA_VERSION
  readonly generatedBy: {
    readonly package: 'api-schema-flow'
    readonly milestone: 'M3-A'
  }
  readonly project: ReadOnlyWorkspaceProject
  readonly apiDocument: NormalizedApiDocument
  readonly acceptedGraph: FlowGraph
  readonly inferenceCandidates: readonly InferenceCandidate[]
  readonly reviewOutcomes: readonly ReviewDecisionOutcome[]
  readonly diagnostics: readonly TDiagnostic[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function isReadOnlyWorkspaceSnapshot(value: unknown): value is ReadOnlyWorkspaceSnapshot {
  if (!isRecord(value) || value.schemaVersion !== READ_ONLY_WORKSPACE_SNAPSHOT_SCHEMA_VERSION) {
    return false
  }

  const generatedBy = value.generatedBy
  const project = value.project
  const apiDocument = value.apiDocument
  const acceptedGraph = value.acceptedGraph

  return (
    isRecord(generatedBy) &&
    generatedBy.package === 'api-schema-flow' &&
    generatedBy.milestone === 'M3-A' &&
    isRecord(project) &&
    typeof project.name === 'string' &&
    typeof project.sourceName === 'string' &&
    typeof project.sourceUri === 'string' &&
    typeof project.openapiVersion === 'string' &&
    isRecord(apiDocument) &&
    Array.isArray(apiDocument.operations) &&
    Array.isArray(apiDocument.componentSchemas) &&
    isRecord(acceptedGraph) &&
    acceptedGraph.schemaVersion === '1.0' &&
    Array.isArray(acceptedGraph.nodes) &&
    Array.isArray(acceptedGraph.edges) &&
    Array.isArray(value.inferenceCandidates) &&
    Array.isArray(value.reviewOutcomes) &&
    Array.isArray(value.diagnostics)
  )
}
