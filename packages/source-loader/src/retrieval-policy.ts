import { DIAGNOSTIC_CODES, type Diagnostic } from '@api-schema-flow/diagnostics'

export type SourceRetrievalMode = 'local-cli' | 'ci' | 'browser'

export interface SourceRetrievalPolicy {
  readonly version: 1
  readonly mode: SourceRetrievalMode
  readonly allowedFileRoots: readonly string[]
  readonly allowHttp: boolean
  readonly allowPrivateNetwork: boolean
  readonly maxDocumentBytes: number
  readonly maxTotalBytes: number
  readonly maxDocuments: number
  readonly maxReferenceDepth: number
  readonly maxRedirects: number
  readonly timeoutMs: number
}

export const DEFAULT_SOURCE_RETRIEVAL_POLICY: SourceRetrievalPolicy = Object.freeze({
  version: 1,
  mode: 'local-cli',
  allowedFileRoots: Object.freeze([]),
  allowHttp: false,
  allowPrivateNetwork: false,
  maxDocumentBytes: 5 * 1024 * 1024,
  maxTotalBytes: 20 * 1024 * 1024,
  maxDocuments: 32,
  maxReferenceDepth: 16,
  maxRedirects: 3,
  timeoutMs: 10_000,
})

export function createSourceRetrievalPolicy(
  overrides: Partial<SourceRetrievalPolicy> = {},
): SourceRetrievalPolicy {
  return Object.freeze({
    ...DEFAULT_SOURCE_RETRIEVAL_POLICY,
    ...overrides,
    version: 1,
    allowedFileRoots: Object.freeze([
      ...(overrides.allowedFileRoots ?? DEFAULT_SOURCE_RETRIEVAL_POLICY.allowedFileRoots),
    ]),
  })
}

export interface SourceBudget {
  readonly documentCount: number
  readonly totalBytes: number
  consumeDocument(uri: string, byteLength: number): readonly Diagnostic[]
  checkReferenceDepth(uri: string, depth: number): readonly Diagnostic[]
}

function budgetDiagnostic(
  code: string,
  message: string,
  uri: string,
  details: Readonly<Record<string, unknown>>,
): Diagnostic {
  return {
    code,
    severity: 'error',
    message,
    source: { uri, pointer: '#' },
    details,
  }
}

export function createSourceBudget(policy: SourceRetrievalPolicy): SourceBudget {
  let documentCount = 0
  let totalBytes = 0

  return {
    get documentCount() {
      return documentCount
    },
    get totalBytes() {
      return totalBytes
    },
    consumeDocument(uri, byteLength) {
      if (documentCount + 1 > policy.maxDocuments) {
        return [
          budgetDiagnostic(
            DIAGNOSTIC_CODES.SOURCE_DOCUMENT_LIMIT,
            `Source document limit of ${policy.maxDocuments} was exceeded.`,
            uri,
            { documentCount, maxDocuments: policy.maxDocuments },
          ),
        ]
      }

      if (totalBytes + byteLength > policy.maxTotalBytes) {
        return [
          budgetDiagnostic(
            DIAGNOSTIC_CODES.SOURCE_TOTAL_SIZE_LIMIT,
            `Source graph byte limit of ${policy.maxTotalBytes} was exceeded.`,
            uri,
            { byteLength, totalBytes, maxTotalBytes: policy.maxTotalBytes },
          ),
        ]
      }

      documentCount += 1
      totalBytes += byteLength
      return []
    },
    checkReferenceDepth(uri, depth) {
      if (depth <= policy.maxReferenceDepth) return []
      return [
        budgetDiagnostic(
          DIAGNOSTIC_CODES.SOURCE_REFERENCE_DEPTH,
          `Reference depth ${depth} exceeds the limit of ${policy.maxReferenceDepth}.`,
          uri,
          { depth, maxReferenceDepth: policy.maxReferenceDepth },
        ),
      ]
    },
  }
}
