import { DIAGNOSTIC_CODES, type Diagnostic } from '@api-schema-flow/diagnostics'
import type { SourceDocument } from '@api-schema-flow/source-loader'
import { normalize } from '@scalar/openapi-parser'

import { isRecord, type UnknownRecord } from './openapi-like.js'

export interface ParseStructuredDocumentResult {
  readonly document?: UnknownRecord
  readonly diagnostics: readonly Diagnostic[]
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (error !== null && typeof error === 'object' && 'message' in error) {
    const message = Reflect.get(error, 'message')
    if (typeof message === 'string') return message
  }
  return String(error)
}

export function parseStructuredDocument(
  source: SourceDocument,
): ParseStructuredDocumentResult {
  try {
    const parsed = normalize(source.contents)
    if (isRecord(parsed)) return { document: parsed, diagnostics: [] }
    return {
      diagnostics: [
        {
          code: DIAGNOSTIC_CODES.OPENAPI_PARSE_FAILED,
          severity: 'error',
          message: 'Source document must contain a JSON or YAML object.',
          source: { uri: source.uri, pointer: '#' },
        },
      ],
    }
  } catch (error) {
    return {
      diagnostics: [
        {
          code: DIAGNOSTIC_CODES.OPENAPI_PARSE_FAILED,
          severity: 'error',
          message: errorMessage(error),
          source: { uri: source.uri, pointer: '#' },
        },
      ],
    }
  }
}
