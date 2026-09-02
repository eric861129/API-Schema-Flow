import { hasDiagnosticErrors, sortDiagnostics, type Diagnostic } from '@api-schema-flow/diagnostics'
import type { SourceDocument } from '@api-schema-flow/source-loader'

import { normalizeArazzoDocument } from './normalize-arazzo.js'
import { parseArazzoSource } from './parse-arazzo.js'
import { validateArazzoDocument } from './semantic-validation.js'
import { resolveSourceDescriptionUris } from './source-resolution.js'
import { analyzeArazzoSupport, type ArazzoSupportReport } from './support-analysis.js'
import type { NormalizedArazzoDocument } from './model.js'

export interface ProcessArazzoResult {
  readonly document?: NormalizedArazzoDocument
  readonly support?: ArazzoSupportReport
  readonly diagnostics: readonly Diagnostic[]
}

export function processArazzoSource(source: SourceDocument): ProcessArazzoResult {
  const parsed = parseArazzoSource(source)
  if (!parsed.document || hasDiagnosticErrors(parsed.diagnostics)) {
    return { diagnostics: sortDiagnostics(parsed.diagnostics) }
  }

  const normalized = normalizeArazzoDocument(parsed.document, source)
  if (!normalized.document) {
    return { diagnostics: sortDiagnostics([...parsed.diagnostics, ...normalized.diagnostics]) }
  }

  const sourceResolution = resolveSourceDescriptionUris(normalized.document, source.uri)
  const document: NormalizedArazzoDocument = {
    ...normalized.document,
    sourceDescriptions: sourceResolution.sources,
  }
  const semanticDiagnostics = validateArazzoDocument(document)
  const diagnostics = sortDiagnostics([
    ...parsed.diagnostics,
    ...normalized.diagnostics,
    ...sourceResolution.diagnostics,
    ...semanticDiagnostics,
  ])
  const support = analyzeArazzoSupport(document)

  return { document, support, diagnostics }
}
