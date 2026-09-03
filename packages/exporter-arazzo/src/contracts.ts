import type {
  EndpointFlowNode,
  FlowGraph,
  NormalizedApiDocument,
  NormalizedOperation,
} from '@api-schema-flow/domain'
import type { Diagnostic } from '@api-schema-flow/diagnostics'
import type { FlowOpenApiSource } from '@api-schema-flow/flow'
import type { NormalizedArazzoDocument } from '@api-schema-flow/arazzo'

export const ARAZZO_WORKFLOW_PLAN_SCHEMA_VERSION = '1.0' as const

export interface ArazzoWorkflowSourceDescriptionPlan {
  readonly sourceId: string
  readonly name: string
  readonly url: string
}

export interface ArazzoWorkflowStepPlan {
  readonly stepId: string
  readonly operationNodeId: string
  readonly description?: string
}

export interface ArazzoWorkflowPlan {
  readonly schemaVersion: typeof ARAZZO_WORKFLOW_PLAN_SCHEMA_VERSION
  readonly workflowId: string
  readonly summary?: string
  readonly description?: string
  readonly sourceDescriptions: readonly ArazzoWorkflowSourceDescriptionPlan[]
  readonly steps: readonly ArazzoWorkflowStepPlan[]
}

export interface ValidateArazzoWorkflowPlanInput {
  readonly workflowPlan: ArazzoWorkflowPlan
  readonly acceptedOperationGraph: FlowGraph
}

export interface ValidateArazzoWorkflowPlanResult {
  readonly workflowPlan?: ArazzoWorkflowPlan
  readonly diagnostics: readonly Diagnostic[]
}

export interface BoundWorkflowStep {
  readonly stepId: string
  readonly description?: string
  readonly node: EndpointFlowNode
  readonly operation: NormalizedOperation
  readonly source: FlowOpenApiSource
  readonly sourceDescription: ArazzoWorkflowSourceDescriptionPlan
}

export interface BindWorkflowPlanOperationsInput {
  readonly workflowPlan: ArazzoWorkflowPlan
  readonly acceptedOperationGraph: FlowGraph
  readonly openApiSources: readonly FlowOpenApiSource[]
}

export interface BindWorkflowPlanOperationsResult {
  readonly steps: readonly BoundWorkflowStep[]
  readonly diagnostics: readonly Diagnostic[]
}

export interface ProjectedArazzoParameter {
  readonly name: string
  readonly in: 'path' | 'query' | 'header' | 'cookie'
  readonly value: string
}

export interface ProjectedArazzoRequestBody {
  readonly contentType: 'application/json'
  readonly payload: Readonly<Record<string, unknown>>
}

export interface ProjectedArazzoStep {
  readonly stepId: string
  readonly description?: string
  readonly outputs: Readonly<Record<string, string>>
  readonly parameters: readonly ProjectedArazzoParameter[]
  readonly requestBody?: ProjectedArazzoRequestBody
  readonly dependsOn: readonly string[]
}

export interface ProjectAcceptedMappingsInput {
  readonly workflowPlan: ArazzoWorkflowPlan
  readonly acceptedOperationGraph: FlowGraph
  readonly boundSteps: readonly BoundWorkflowStep[]
}

export interface ProjectAcceptedMappingsResult {
  readonly steps: readonly ProjectedArazzoStep[]
  readonly diagnostics: readonly Diagnostic[]
}

export interface ExportArazzoInput {
  readonly title: string
  readonly version: string
  readonly format: 'yaml' | 'json'
  readonly workflowPlan: ArazzoWorkflowPlan
  readonly openApiSources: readonly FlowOpenApiSource[]
  readonly acceptedOperationGraph: FlowGraph
}

export interface ArazzoExportArtifact {
  readonly fileName: string
  readonly mediaType: 'application/yaml' | 'application/json'
  readonly contents: string
  readonly contentHash: string
  readonly document?: NormalizedArazzoDocument
  readonly diagnostics: readonly Diagnostic[]
}

export interface BoundOperationIndexEntry {
  readonly sourceId: string
  readonly document: NormalizedApiDocument
  readonly operations: readonly NormalizedOperation[]
}
