import { sortDiagnostics, type Diagnostic } from '@api-schema-flow/diagnostics'

import type { NormalizedArazzoDocument, NormalizedArazzoSourceDescription } from './model.js'

export interface ResolveArazzoBaseUriResult {
  readonly baseUri?: string
  readonly diagnostics: readonly Diagnostic[]
}

export interface ResolveArazzoSourcesResult extends ResolveArazzoBaseUriResult {
  readonly sources: readonly NormalizedArazzoSourceDescription[]
}

function uriDiagnostic(
  document: NormalizedArazzoDocument,
  message: string,
  details: Readonly<Record<string, unknown>>,
): Diagnostic {
  return {
    code: 'ASF-ARZ-1013',
    severity: 'error',
    message,
    source: document.source,
    details,
  }
}

export function resolveArazzoBaseUri(
  document: NormalizedArazzoDocument,
  retrievalUri: string,
): ResolveArazzoBaseUriResult {
  try {
    const retrieval = new URL(retrievalUri)
    const resolved = document.self ? new URL(document.self, retrieval) : retrieval
    if (resolved.hash.length > 0) {
      return {
        diagnostics: [
          uriDiagnostic(document, 'Arazzo $self must not contain a URI fragment.', {
            self: document.self ?? retrievalUri,
          }),
        ],
      }
    }
    return { baseUri: resolved.href, diagnostics: [] }
  } catch (error) {
    return {
      diagnostics: [
        uriDiagnostic(document, 'Arazzo base URI could not be resolved.', {
          retrievalUri,
          ...(document.self === undefined ? {} : { self: document.self }),
          reason: error instanceof Error ? error.message : String(error),
        }),
      ],
    }
  }
}

export function resolveSourceDescriptionUris(
  document: NormalizedArazzoDocument,
  retrievalUri: string,
): ResolveArazzoSourcesResult {
  const base = resolveArazzoBaseUri(document, retrievalUri)
  if (!base.baseUri) {
    return {
      sources: document.sourceDescriptions,
      diagnostics: base.diagnostics,
    }
  }

  const diagnostics: Diagnostic[] = [...base.diagnostics]
  const sources = document.sourceDescriptions.map((sourceDescription) => {
    try {
      const resolved = new URL(sourceDescription.url, base.baseUri)
      return { ...sourceDescription, resolvedUri: resolved.href }
    } catch (error) {
      diagnostics.push({
        code: 'ASF-ARZ-1013',
        severity: 'error',
        message: `Source Description "${sourceDescription.name}" URL could not be resolved.`,
        source: sourceDescription.source,
        details: {
          name: sourceDescription.name,
          url: sourceDescription.url,
          baseUri: base.baseUri,
          reason: error instanceof Error ? error.message : String(error),
        },
      })
      return sourceDescription
    }
  })

  return {
    baseUri: base.baseUri,
    sources,
    diagnostics: sortDiagnostics(diagnostics),
  }
}
