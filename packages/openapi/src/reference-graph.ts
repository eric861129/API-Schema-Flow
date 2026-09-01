import { createSourcePointer, type SourcePointer } from '@api-schema-flow/domain'
import { DIAGNOSTIC_CODES, sortDiagnostics, type Diagnostic } from '@api-schema-flow/diagnostics'
import {
  DEFAULT_SOURCE_RETRIEVAL_POLICY,
  createSourceBudget,
  type SourceAcquirer,
  type SourceDocument,
  type SourceLocation,
  type SourceRetrievalPolicy,
} from '@api-schema-flow/source-loader'

import { fingerprintSources } from './fingerprint.js'
import { resolveJsonPointer } from './json-pointer.js'
import { isRecord, sortedRecordEntries, type UnknownRecord } from './openapi-like.js'
import { parseStructuredDocument } from './parse-structured-document.js'

export interface OpenApiSourceGraphDocument {
  readonly source: SourceDocument
  readonly document: UnknownRecord
}

export interface OpenApiReference {
  readonly raw: string
  readonly source: SourcePointer
  readonly targetUri: string
  readonly targetPointer: string
  readonly resolved?: SourcePointer
}

export interface OpenApiSourceGraph {
  readonly entryUri: string
  readonly fingerprint: string
  readonly documents: readonly OpenApiSourceGraphDocument[]
  readonly references: readonly OpenApiReference[]
}

export interface LoadOpenApiSourceGraphOptions {
  readonly location: SourceLocation
  readonly acquirer: SourceAcquirer
  readonly policy?: SourceRetrievalPolicy
}

export interface LoadOpenApiSourceGraphResult {
  readonly graph?: OpenApiSourceGraph
  readonly diagnostics: readonly Diagnostic[]
}

interface ReferenceTarget {
  readonly targetUri: string
  readonly targetPointer: string
  readonly documentReference: string
}

function compareReferences(left: OpenApiReference, right: OpenApiReference): number {
  return (
    left.source.uri.localeCompare(right.source.uri) ||
    left.source.pointer.localeCompare(right.source.pointer) ||
    left.raw.localeCompare(right.raw)
  )
}

function missingReferenceDiagnostic(
  reference: string,
  source: SourcePointer,
  reason: string,
): Diagnostic {
  return {
    code: DIAGNOSTIC_CODES.OPENAPI_REFERENCE_TARGET_MISSING,
    severity: 'error',
    message: `OpenAPI reference target could not be resolved: ${reason}`,
    source,
    details: { reference },
  }
}

function resolveReferenceTarget(reference: string, parentUri: string): ReferenceTarget | undefined {
  try {
    const resolved = new URL(reference, parentUri)
    const targetPointer = resolved.hash === '' ? '#' : resolved.hash
    resolved.hash = ''
    const hashIndex = reference.indexOf('#')
    return {
      targetUri: resolved.href,
      targetPointer,
      documentReference: hashIndex === -1 ? reference : reference.slice(0, hashIndex),
    }
  } catch {
    return undefined
  }
}

function fallbackLocation(targetUri: string): SourceLocation {
  return { kind: 'url', url: targetUri }
}

export async function loadOpenApiSourceGraph(
  options: LoadOpenApiSourceGraphOptions,
): Promise<LoadOpenApiSourceGraphResult> {
  const policy = options.policy ?? DEFAULT_SOURCE_RETRIEVAL_POLICY
  const budget = createSourceBudget(policy)
  const diagnostics: Diagnostic[] = []
  const documents = new Map<string, OpenApiSourceGraphDocument>()
  const aliases = new Map<string, string>()
  const attemptedDocuments = new Set<string>()
  const failedDocuments = new Set<string>()
  const references: OpenApiReference[] = []

  const canonicalUri = (uri: string): string => aliases.get(uri) ?? uri

  const acquireDocument = async (
    location: SourceLocation,
    depth: number,
    requestedUri?: string,
  ): Promise<OpenApiSourceGraphDocument | undefined> => {
    const acquired = await options.acquirer.acquire(location, { policy, budget, depth })
    diagnostics.push(...acquired.diagnostics)
    if (acquired.source === undefined) {
      if (requestedUri !== undefined) failedDocuments.add(requestedUri)
      return undefined
    }

    if (requestedUri !== undefined && requestedUri !== acquired.source.uri) {
      aliases.set(requestedUri, acquired.source.uri)
    }
    const existing = documents.get(acquired.source.uri)
    if (existing !== undefined) return existing

    const parsed = parseStructuredDocument(acquired.source)
    diagnostics.push(...parsed.diagnostics)
    if (parsed.document === undefined) {
      failedDocuments.add(acquired.source.uri)
      return undefined
    }

    const graphDocument = { source: acquired.source, document: parsed.document }
    documents.set(acquired.source.uri, graphDocument)
    await walkDocument(graphDocument, depth)
    return graphDocument
  }

  const ensureDocument = async (
    target: ReferenceTarget,
    parentUri: string,
    depth: number,
  ): Promise<OpenApiSourceGraphDocument | undefined> => {
    const resolvedTargetUri = canonicalUri(target.targetUri)
    const existing = documents.get(resolvedTargetUri)
    if (existing !== undefined) return existing
    if (failedDocuments.has(target.targetUri) || attemptedDocuments.has(target.targetUri)) {
      return undefined
    }

    attemptedDocuments.add(target.targetUri)
    let location: SourceLocation
    try {
      location =
        options.acquirer.resolveLocation?.(target.documentReference, parentUri) ??
        fallbackLocation(target.targetUri)
    } catch (error) {
      failedDocuments.add(target.targetUri)
      diagnostics.push({
        code: DIAGNOSTIC_CODES.OPENAPI_REFERENCE_TARGET_MISSING,
        severity: 'error',
        message: 'OpenAPI reference document location is invalid.',
        source: { uri: parentUri, pointer: '#' },
        details: { reason: error instanceof Error ? error.message : String(error) },
      })
      return undefined
    }

    return acquireDocument(location, depth, target.targetUri)
  }

  const handleReference = async (
    raw: string,
    source: SourcePointer,
    declaringDocument: OpenApiSourceGraphDocument,
    depth: number,
  ): Promise<void> => {
    const target = resolveReferenceTarget(raw, declaringDocument.source.uri)
    if (target === undefined) {
      references.push({
        raw,
        source,
        targetUri: declaringDocument.source.uri,
        targetPointer: '#',
      })
      diagnostics.push(missingReferenceDiagnostic(raw, source, 'invalid reference URI'))
      return
    }

    let targetDocument = documents.get(canonicalUri(target.targetUri))
    if (targetDocument === undefined && target.targetUri !== declaringDocument.source.uri) {
      targetDocument = await ensureDocument(target, declaringDocument.source.uri, depth + 1)
    }
    if (targetDocument === undefined && target.targetUri === declaringDocument.source.uri) {
      targetDocument = declaringDocument
    }

    if (targetDocument === undefined) {
      references.push({ raw, source, targetUri: target.targetUri, targetPointer: target.targetPointer })
      return
    }

    const resolution = resolveJsonPointer(targetDocument.document, target.targetPointer)
    if (!resolution.found) {
      references.push({ raw, source, targetUri: target.targetUri, targetPointer: target.targetPointer })
      diagnostics.push(missingReferenceDiagnostic(raw, source, resolution.reason))
      return
    }

    references.push({
      raw,
      source,
      targetUri: target.targetUri,
      targetPointer: target.targetPointer,
      resolved: { uri: targetDocument.source.uri, pointer: target.targetPointer },
    })
  }

  async function walkValue(
    value: unknown,
    tokens: readonly string[],
    declaringDocument: OpenApiSourceGraphDocument,
    depth: number,
  ): Promise<void> {
    if (Array.isArray(value)) {
      for (const [index, entry] of value.entries()) {
        await walkValue(entry, [...tokens, String(index)], declaringDocument, depth)
      }
      return
    }
    if (!isRecord(value)) return

    for (const [key, child] of sortedRecordEntries(value)) {
      const childTokens = [...tokens, key]
      if (key === '$ref' && typeof child === 'string') {
        await handleReference(
          child,
          createSourcePointer(declaringDocument.source.uri, childTokens),
          declaringDocument,
          depth,
        )
      } else {
        await walkValue(child, childTokens, declaringDocument, depth)
      }
    }
  }

  async function walkDocument(
    document: OpenApiSourceGraphDocument,
    depth: number,
  ): Promise<void> {
    await walkValue(document.document, [], document, depth)
  }

  const entry = await acquireDocument(options.location, 0)
  if (entry === undefined) return { diagnostics: sortDiagnostics(diagnostics) }

  const graphDocuments = [...documents.values()].sort((left, right) =>
    left.source.uri.localeCompare(right.source.uri),
  )
  const graphReferences = references.sort(compareReferences)
  const fingerprint = await fingerprintSources(graphDocuments.map(({ source }) => source))

  return {
    graph: {
      entryUri: entry.source.uri,
      fingerprint,
      documents: graphDocuments,
      references: graphReferences,
    },
    diagnostics: sortDiagnostics(diagnostics),
  }
}
