import type {
  FlowGraph,
  FlowValueSelector,
  FlowValueTarget,
  HttpMethod,
  SourcePointer,
} from '@api-schema-flow/domain'
import type { Diagnostic } from '@api-schema-flow/diagnostics'
import type { FlowOpenApiSource } from '@api-schema-flow/flow'

export interface InferenceConfig {
  readonly minimumConfidence: number
  readonly topKPerTarget: number
  readonly maxCandidates: number
  readonly maxPairs: number
  readonly maxSchemaDepth: number
  readonly maxElapsedMs: number
  readonly includeLowConfidence: boolean
}

export interface ResolvedInferenceConfig {
  readonly config?: InferenceConfig
  readonly diagnostics: readonly Diagnostic[]
}

export interface NormalizedInferenceName {
  readonly original: string
  readonly tokens: readonly string[]
  readonly signature: string
  readonly genericId: boolean
  readonly secretLike: boolean
}

interface InferenceFieldBase {
  readonly sourceId: string
  readonly operationNodeId: string
  readonly operationKey: string
  readonly operationId?: string
  readonly method: HttpMethod
  readonly path: string
  readonly tags: readonly string[]
  readonly name: string
  readonly normalizedName: NormalizedInferenceName
  readonly schemaTypes: readonly string[]
  readonly format?: string
  readonly sourcePointer: SourcePointer
  readonly resourceKey: string
  readonly readOnly: boolean
  readonly writeOnly: boolean
  readonly required: boolean
  readonly arrayDepth: number
  readonly variant: boolean
}

export interface InferenceSourceField extends InferenceFieldBase {
  readonly selector: FlowValueSelector
  readonly statusCode: string
}

export interface InferenceTargetField extends InferenceFieldBase {
  readonly target: FlowValueTarget
  readonly securityTarget: boolean
  readonly bearerTarget: boolean
}

export interface InferenceFieldExtractionResult<TField> {
  readonly fields: readonly TField[]
  readonly diagnostics: readonly Diagnostic[]
}

export interface InferencePair {
  readonly source: InferenceSourceField
  readonly target: InferenceTargetField
}

export interface InferFlowCandidatesInput {
  readonly openApiSources: readonly FlowOpenApiSource[]
  readonly declaredOperationGraph: FlowGraph
  readonly config?: Partial<InferenceConfig>
}

export interface InferenceOperationIndex {
  readonly sourceFields: readonly InferenceSourceField[]
  readonly targetFields: readonly InferenceTargetField[]
  readonly diagnostics: readonly Diagnostic[]
}
