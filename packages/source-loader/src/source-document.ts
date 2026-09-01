import { DIAGNOSTIC_CODES, type Diagnostic } from '@api-schema-flow/diagnostics'

export const DEFAULT_SOURCE_SIZE_LIMIT_BYTES = 5 * 1024 * 1024

export interface SourceDocument {
  readonly uri: string
  readonly contents: string
  readonly mediaType?: string
  readonly byteLength: number
}

export interface CreateSourceDocumentInput {
  readonly uri: string
  readonly contents: string
  readonly mediaType?: string
  readonly maxBytes?: number
}

export interface CreateSourceDocumentResult {
  readonly source?: SourceDocument
  readonly diagnostics: readonly Diagnostic[]
}

export function createSourceDocument(input: CreateSourceDocumentInput): CreateSourceDocumentResult {
  const byteLength = new TextEncoder().encode(input.contents).byteLength

  if (input.contents.trim().length === 0) {
    return {
      diagnostics: [
        {
          code: DIAGNOSTIC_CODES.SOURCE_EMPTY,
          severity: 'error',
          message: 'Source document is empty.',
          source: { uri: input.uri, pointer: '#' },
        },
      ],
    }
  }

  const maxBytes = input.maxBytes ?? DEFAULT_SOURCE_SIZE_LIMIT_BYTES
  if (byteLength > maxBytes) {
    return {
      diagnostics: [
        {
          code: DIAGNOSTIC_CODES.SOURCE_TOO_LARGE,
          severity: 'error',
          message: `Source document is ${byteLength} bytes; the limit is ${maxBytes} bytes.`,
          source: { uri: input.uri, pointer: '#' },
          details: { byteLength, maxBytes },
        },
      ],
    }
  }

  const source: SourceDocument = {
    uri: input.uri,
    contents: input.contents,
    byteLength,
    ...(input.mediaType === undefined ? {} : { mediaType: input.mediaType }),
  }

  return { source, diagnostics: [] }
}
