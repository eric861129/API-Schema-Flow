import type { NormalizedOperation, NormalizedServer } from './operation.js'
import type { NormalizedComponentSchema } from './schema.js'

export interface NormalizedApiInfo {
  readonly title: string
  readonly version: string
  readonly description?: string
}

export interface NormalizedApiDocument {
  readonly schemaVersion: '1.0'
  readonly sourceUri: string
  readonly openapiVersion: string
  readonly compatibilityMode: boolean
  readonly info: NormalizedApiInfo
  readonly tags: readonly string[]
  readonly servers: readonly NormalizedServer[]
  readonly operations: readonly NormalizedOperation[]
  readonly componentSchemas: readonly NormalizedComponentSchema[]
}
