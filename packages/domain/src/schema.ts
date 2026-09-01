import type { SourcePointer } from './source-pointer.js'

export interface NormalizedSchema {
  readonly source: SourcePointer
  readonly ref?: string
  readonly resolvedRef?: SourcePointer
  readonly types: readonly string[]
  readonly format?: string
  readonly title?: string
  readonly description?: string
  readonly required: readonly string[]
  readonly properties: Readonly<Record<string, NormalizedSchema>>
  readonly items?: NormalizedSchema
  readonly enumValues: readonly unknown[]
  readonly example?: unknown
  readonly defaultValue?: unknown
  readonly allOf: readonly NormalizedSchema[]
  readonly anyOf: readonly NormalizedSchema[]
  readonly oneOf: readonly NormalizedSchema[]
  readonly additionalProperties?: boolean | NormalizedSchema
  readonly nullable: boolean
  readonly readOnly: boolean
  readonly writeOnly: boolean
  readonly deprecated: boolean
}

export interface NormalizedComponentSchema {
  readonly name: string
  readonly schema: NormalizedSchema
  readonly source: SourcePointer
}
