import { describe, expect, test } from 'vitest'

import * as sourceLoader from '../../src/index.js'

// These contract tests intentionally precede the M1-B retrieval implementation.
const sourceLoaderExports = sourceLoader as unknown as Record<string, unknown>

describe('source retrieval policy', () => {
  test('uses secure deterministic defaults', () => {
    const policy = sourceLoaderExports.DEFAULT_SOURCE_RETRIEVAL_POLICY

    expect(policy).toBeDefined()
    if (policy === undefined || policy === null || typeof policy !== 'object') return

    expect(policy).toMatchObject({
      version: 1,
      mode: 'local-cli',
      allowedFileRoots: [],
      allowHttp: false,
      allowPrivateNetwork: false,
      maxDocumentBytes: 5 * 1024 * 1024,
      maxTotalBytes: 20 * 1024 * 1024,
      maxDocuments: 32,
      maxReferenceDepth: 16,
      maxRedirects: 3,
      timeoutMs: 10_000,
    })
  })

  test('tracks document and total-byte budgets without throwing', () => {
    const createSourceRetrievalPolicy = sourceLoaderExports.createSourceRetrievalPolicy
    const createSourceBudget = sourceLoaderExports.createSourceBudget

    expect(createSourceRetrievalPolicy).toEqual(expect.any(Function))
    expect(createSourceBudget).toEqual(expect.any(Function))
    if (
      typeof createSourceRetrievalPolicy !== 'function' ||
      typeof createSourceBudget !== 'function'
    ) {
      return
    }

    const policy = createSourceRetrievalPolicy({
      maxDocuments: 1,
      maxTotalBytes: 4,
      maxReferenceDepth: 1,
    }) as object
    const budget = createSourceBudget(policy) as {
      readonly documentCount: number
      readonly totalBytes: number
      consumeDocument(uri: string, byteLength: number): readonly { code: string }[]
      checkReferenceDepth(uri: string, depth: number): readonly { code: string }[]
    }

    expect(budget.consumeDocument('memory://first', 4)).toEqual([])
    expect(budget.documentCount).toBe(1)
    expect(budget.totalBytes).toBe(4)
    expect(budget.consumeDocument('memory://second', 1)).toEqual([
      expect.objectContaining({ code: 'ASF-SRC-1006' }),
    ])
    expect(budget.checkReferenceDepth('memory://nested', 2)).toEqual([
      expect.objectContaining({ code: 'ASF-SRC-1013' }),
    ])
  })
})
