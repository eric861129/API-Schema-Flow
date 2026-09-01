import type { HttpMethod } from './http-method.js'
import type { NormalizedSchema } from './schema.js'
import type { SourcePointer } from './source-pointer.js'

export type ParameterLocation = 'path' | 'query' | 'querystring' | 'header' | 'cookie'

export interface NormalizedParameter {
  readonly name: string
  readonly location: ParameterLocation
  readonly required: boolean
  readonly deprecated: boolean
  readonly description?: string
  readonly schema?: NormalizedSchema
  readonly source: SourcePointer
}

export interface NormalizedMediaType {
  readonly mediaType: string
  readonly schema?: NormalizedSchema
  readonly example?: unknown
  readonly source: SourcePointer
}

export interface NormalizedRequestBody {
  readonly required: boolean
  readonly description?: string
  readonly content: readonly NormalizedMediaType[]
  readonly source: SourcePointer
}

export interface NormalizedResponse {
  readonly statusCode: string
  readonly description: string
  readonly content: readonly NormalizedMediaType[]
  readonly source: SourcePointer
}

export interface NormalizedSecurityRequirement {
  readonly requirementIndex: number
  readonly scheme: string
  readonly scopes: readonly string[]
}

export interface NormalizedServer {
  readonly url: string
  readonly description?: string
  readonly source: SourcePointer
}

export interface NormalizedOperation {
  readonly id: string
  readonly operationId?: string
  readonly method: HttpMethod
  readonly path: string
  readonly summary?: string
  readonly description?: string
  readonly tags: readonly string[]
  readonly deprecated: boolean
  readonly parameters: readonly NormalizedParameter[]
  readonly requestBody?: NormalizedRequestBody
  readonly responses: readonly NormalizedResponse[]
  readonly security: readonly NormalizedSecurityRequirement[]
  readonly servers: readonly NormalizedServer[]
  readonly source: SourcePointer
}
