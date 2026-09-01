import type { Diagnostic } from '@api-schema-flow/diagnostics'
import type { SourceDocument } from '@api-schema-flow/source-loader'

export interface OpenApiParserResult {
  readonly document?: unknown
  readonly diagnostics: readonly Diagnostic[]
}

export interface OpenApiParserAdapter {
  parse(source: SourceDocument): Promise<OpenApiParserResult>
}
