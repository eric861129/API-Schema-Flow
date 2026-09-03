export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options' | 'trace'

export interface SourcePointer {
  readonly uri: string
  readonly pointer: string
}
export interface SchemaValue {
  readonly type?: string
  readonly format?: string
  readonly properties?: Readonly<Record<string, SchemaValue>>
  readonly items?: SchemaValue
  readonly required?: readonly string[]
  readonly readOnly?: boolean
  readonly writeOnly?: boolean
}
export interface ParameterValue {
  readonly name: string
  readonly location: string
  readonly required: boolean
  readonly schema?: SchemaValue
  readonly source?: SourcePointer
}
export interface MediaValue {
  readonly mediaType: string
  readonly schema?: SchemaValue
}
export interface ResponseValue {
  readonly statusCode: string
  readonly description?: string
  readonly mediaTypes: readonly MediaValue[]
  readonly headers: readonly unknown[]
  readonly links: readonly unknown[]
}
export interface OperationValue {
  readonly id: string
  readonly method: HttpMethod
  readonly path: string
  readonly operationId?: string
  readonly summary?: string
  readonly tags: readonly string[]
  readonly parameters: readonly ParameterValue[]
  readonly requestBody?: { readonly required: boolean; readonly mediaTypes: readonly MediaValue[] }
  readonly responses: readonly ResponseValue[]
  readonly security: readonly unknown[]
  readonly source: SourcePointer
}
export interface EndpointNodeValue {
  readonly kind: 'endpoint'
  readonly id: string
  readonly operationKey: string
  readonly source: SourcePointer
}
export interface MappingValue {
  readonly id: string
  readonly source: Readonly<Record<string, unknown>>
  readonly target: Readonly<Record<string, unknown>>
}
export interface EdgeReviewValue {
  readonly action: 'accept' | 'edit'
  readonly candidateId: string
  readonly evidenceRuleIds: readonly string[]
}
export interface EdgeValue {
  readonly id: string
  readonly kind: string
  readonly sourceNodeId: string
  readonly targetNodeId: string
  readonly provenance: 'declared' | 'inferred' | 'manual'
  readonly status: 'accepted'
  readonly mappings: readonly MappingValue[]
  readonly sourceStandardRefs: readonly unknown[]
  readonly review?: EdgeReviewValue
}
export interface DiagnosticValue {
  readonly code: string
  readonly severity: 'info' | 'warning' | 'error'
  readonly message: string
  readonly source?: SourcePointer
}
export interface WorkspaceSnapshot {
  readonly schemaVersion: '1.0'
  readonly project: {
    readonly name: string
    readonly sourceName: string
    readonly sourceUri: string
    readonly openapiVersion: string
  }
  readonly apiDocument: { readonly operations: readonly OperationValue[] }
  readonly acceptedGraph: {
    readonly id: string
    readonly nodes: readonly EndpointNodeValue[]
    readonly edges: readonly EdgeValue[]
  }
  readonly inferenceCandidates: readonly unknown[]
  readonly reviewOutcomes: readonly unknown[]
  readonly diagnostics: readonly DiagnosticValue[]
}
export type SelectedElement = { readonly kind: 'node' | 'edge'; readonly id: string } | null
