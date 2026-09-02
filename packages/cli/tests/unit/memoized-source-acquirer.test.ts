import { describe, expect, test, vi } from 'vitest'

import {
  createSourceBudget,
  createSourceRetrievalPolicy,
  type SourceAcquirer,
} from '@api-schema-flow/source-loader'

import { createMemoizedSourceAcquirer } from '../../src/index.js'

describe('memoized CLI source acquisition', () => {
  test('reuses the entry source while accounting independently for each budget', async () => {
    const source = {
      uri: 'file:///workspace/openapi.yaml',
      contents: 'openapi: 3.1.0\n',
      byteLength: 15,
    }
    const acquire = vi.fn(async () => ({ source, diagnostics: [] }))
    const base: SourceAcquirer = {
      acquire,
      resolveLocation: (reference, parentUri) => ({
        kind: 'url',
        url: new URL(reference, parentUri).href,
      }),
    }
    const memoized = createMemoizedSourceAcquirer(base)
    const policy = createSourceRetrievalPolicy()
    const firstBudget = createSourceBudget(policy)
    const secondBudget = createSourceBudget(policy)
    const location = { kind: 'file' as const, path: '/workspace/openapi.yaml' }

    expect(await memoized.acquire(location, { policy, budget: firstBudget, depth: 0 })).toEqual({
      source,
      diagnostics: [],
    })
    expect(await memoized.acquire(location, { policy, budget: firstBudget, depth: 0 })).toEqual({
      source,
      diagnostics: [],
    })
    expect(await memoized.acquire(location, { policy, budget: secondBudget, depth: 0 })).toEqual({
      source,
      diagnostics: [],
    })

    expect(acquire).toHaveBeenCalledTimes(1)
    expect(firstBudget.documentCount).toBe(0)
    expect(secondBudget.documentCount).toBe(1)
    expect(memoized.resolveLocation?.('./child.yaml', source.uri)).toEqual({
      kind: 'url',
      url: 'file:///workspace/child.yaml',
    })
  })
})
