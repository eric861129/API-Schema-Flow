import type { SourcePointer } from '@api-schema-flow/domain'
import {
  DIAGNOSTIC_CODES,
  hasDiagnosticErrors,
  sortDiagnostics,
  type Diagnostic,
} from '@api-schema-flow/diagnostics'
import {
  DEFAULT_SOURCE_RETRIEVAL_POLICY,
  type SourceAcquirer,
  type SourceDocument,
  type SourceLocation,
  type SourceRetrievalPolicy,
} from '@api-schema-flow/source-loader'

import { normalizeOpenApiDocument, type NormalizeOpenApiResult } from './normalize-document.js'
import type { OpenApiParserAdapter } from './parser-adapter.js'
import { loadOpenApiSourceGraph, type OpenApiReference } from './reference-graph.js'
import { ScalarOpenApiParserAdapter } from './scalar-parser-adapter.js'

export interface ProcessOpenApiLocationOptions {
  readonly acquirer: SourceAcquirer
  readonly policy?: SourceRetrievalPolicy
  readonly adapter?: OpenApiParserAdapter
}

function referenceKey(reference: string, source: SourcePointer): string {
  return `${source.uri}\n${source.pointer}\n${reference}`
}

function referenceResolver(references: readonly OpenApiReference[]) {
  const resolvedReferences = new Map(
    references.flatMap((reference) =>
      reference.resolved === undefined
        ? []
        : [[referenceKey(reference.raw, reference.source), reference.resolved] as const],
    ),
  )

  return (reference: string, source: SourcePointer): SourcePointer | undefined =>
    resolvedReferences.get(referenceKey(reference, source))
}

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

export async function processOpenApiLocation(
  location: SourceLocation,
  options: ProcessOpenApiLocationOptions,
): Promise<NormalizeOpenApiResult> {
  const graphResult = await loadOpenApiSourceGraph({
    location,
    acquirer: options.acquirer,
    policy: options.policy ?? DEFAULT_SOURCE_RETRIEVAL_POLICY,
  })
  if (graphResult.graph === undefined) {
    return { diagnostics: sortDiagnostics(graphResult.diagnostics) }
  }

  const entry = graphResult.graph.documents.find(
    ({ source }) => source.uri === graphResult.graph?.entryUri,
  )
  if (entry === undefined) {
    const diagnostic: Diagnostic = {
      code: DIAGNOSTIC_CODES.INTERNAL_UNEXPECTED,
      severity: 'error',
      message: 'OpenAPI source graph does not contain its entry document.',
      source: { uri: graphResult.graph.entryUri, pointer: '#' },
    }
    return { diagnostics: sortDiagnostics([...graphResult.diagnostics, diagnostic]) }
  }

  const adapter = options.adapter ?? new ScalarOpenApiParserAdapter()
  const parsed = await adapter.parse(entry.source)
  if (!parsed.document || hasDiagnosticErrors(parsed.diagnostics)) {
    return {
      diagnostics: sortDiagnostics([...graphResult.diagnostics, ...parsed.diagnostics]),
    }
  }

  const normalized = normalizeOpenApiDocument(parsed.document, entry.source, {
    resolveReference: referenceResolver(graphResult.graph.references),
  })
  const document =
    normalized.document === undefined
      ? undefined
      : {
          ...normalized.document,
          fingerprint: graphResult.graph.fingerprint,
          sourceCount: graphResult.graph.documents.length,
          referenceCount: graphResult.graph.references.length,
        }

  return {
    ...(document === undefined ? {} : { document }),
    diagnostics: sortDiagnostics([
      ...graphResult.diagnostics,
      ...parsed.diagnostics,
      ...normalized.diagnostics,
    ]),
  }
}
