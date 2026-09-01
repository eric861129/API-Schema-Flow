import { hasDiagnosticErrors, sortDiagnostics } from '@api-schema-flow/diagnostics'
import type { SourceDocument } from '@api-schema-flow/source-loader'

import { normalizeOpenApiDocument, type NormalizeOpenApiResult } from './normalize-document.js'
import type { OpenApiParserAdapter } from './parser-adapter.js'
import { ScalarOpenApiParserAdapter } from './scalar-parser-adapter.js'

export async function processOpenApi(
  source: SourceDocument,
  adapter: OpenApiParserAdapter = new ScalarOpenApiParserAdapter(),
): Promise<NormalizeOpenApiResult> {
  const parsed = await adapter.parse(source)
  if (!parsed.document || hasDiagnosticErrors(parsed.diagnostics)) {
    return { diagnostics: sortDiagnostics(parsed.diagnostics) }
  }

  const normalized = normalizeOpenApiDocument(parsed.document, source)
  return {
    ...(normalized.document === undefined ? {} : { document: normalized.document }),
    diagnostics: sortDiagnostics([...parsed.diagnostics, ...normalized.diagnostics]),
  }
}
