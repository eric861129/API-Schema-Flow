import type { NormalizedArazzoDocument, NormalizedArazzoValue } from '@api-schema-flow/arazzo'
import type {
  FlowEdge,
  FlowGraph,
  FlowNode,
  FlowValueSelector,
  FlowValueTransform,
  NormalizedApiDocument,
  SourcePointer,
} from '@api-schema-flow/domain'
import type { Diagnostic } from '@api-schema-flow/diagnostics'

export interface FlowOpenApiSource {
  readonly sourceId: string
  readonly sourceName?: string
  readonly document: NormalizedApiDocument
}

export interface FlowArazzoSource {
  readonly sourceId: string
  readonly retrievalUri: string
  readonly document: NormalizedArazzoDocument
}

export interface BuildDeclaredFlowGraphsInput {
  readonly openApiSources: readonly FlowOpenApiSource[]
  readonly arazzoSources?: readonly FlowArazzoSource[]
}

export interface DeclaredFlowProjection {
  readonly operationGraph: FlowGraph
  readonly workflowGraphs: readonly FlowGraph[]
  readonly diagnostics: readonly Diagnostic[]
}

export interface FlowProjectionFragment {
  readonly nodes: readonly FlowNode[]
  readonly edges: readonly FlowEdge[]
  readonly diagnostics: readonly Diagnostic[]
}

export interface ArazzoStepOutputUse {
  readonly stepId: string
  readonly outputName: string
  readonly source: SourcePointer
  readonly transform?: FlowValueTransform
}

export interface TargetedArazzoStepOutputUse extends ArazzoStepOutputUse {
  readonly targetPointer: string
}

export interface ResolvedArazzoOutputSelector {
  readonly selector?: FlowValueSelector
  readonly transform?: FlowValueTransform
  readonly sourcePointers: readonly SourcePointer[]
  readonly diagnostics: readonly Diagnostic[]
}

export interface ArazzoWorkflowGraphFragment extends FlowProjectionFragment {
  readonly sourceId: string
  readonly workflowId: string
  readonly title: string
}

export interface ArazzoProjectionResult {
  readonly workflowFragments: readonly ArazzoWorkflowGraphFragment[]
  readonly operationEdges: readonly FlowEdge[]
  readonly diagnostics: readonly Diagnostic[]
}

export interface CollectedArazzoValueUse {
  readonly value: NormalizedArazzoValue
  readonly use: ArazzoStepOutputUse
  readonly targetPointer: string
}
