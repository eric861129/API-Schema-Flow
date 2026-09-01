import {
  createSourceDocument,
  createSourceRetrievalPolicy,
  type createSourceBudget,
} from '@api-schema-flow/source-loader'
import { describe, expect, test } from 'vitest'

import * as openApi from '../../src/index.js'

const loadOpenApiSourceGraph = Reflect.get(openApi, 'loadOpenApiSourceGraph') as
  | ((options: Record<string, unknown>) => Promise<{
      graph?: {
        entryUri: string
        fingerprint: string
        documents: readonly { source: { uri: string } }[]
        references: readonly { raw: string; resolved?: { uri: string; pointer: string } }[]
      }
      diagnostics: readonly { code: string }[]
    }>)
  | undefined

function createMemoryAcquirer(externalDocuments: Readonly<Record<string, string>>) {
  const calls = new Map<string, number>()
  return {
    calls,
    acquirer: {
      resolveLocation(reference: string, parentUri: string) {
        return { kind: 'url' as const, url: new URL(reference, parentUri).href }
      },
      async acquire(location: Record<string, unknown>, context: Record<string, unknown>) {
        const uri =
          location.kind === 'inline' ? String(location.uri) : String(location.url ?? location.path)
        calls.set(uri, (calls.get(uri) ?? 0) + 1)

        const budget = context.budget as ReturnType<typeof createSourceBudget>
        const depthDiagnostics = budget.checkReferenceDepth(uri, Number(context.depth ?? 0))
        if (depthDiagnostics.length > 0) return { diagnostics: depthDiagnostics }

        const contents =
          location.kind === 'inline' ? String(location.content) : externalDocuments[uri]
        if (contents === undefined) {
          return {
            diagnostics: [
              {
                code: 'ASF-SRC-1011',
                severity: 'error' as const,
                message: 'Missing memory source.',
                source: { uri, pointer: '#' },
              },
            ],
          }
        }

        const created = createSourceDocument({ uri, contents })
        if (created.source === undefined) return created
        const budgetDiagnostics = budget.consumeDocument(uri, created.source.byteLength)
        return budgetDiagnostics.length > 0 ? { diagnostics: budgetDiagnostics } : created
      },
    },
  }
}

function entryDocument(reference: string) {
  return JSON.stringify({
    openapi: '3.1.0',
    info: { title: 'Reference API', version: '1.0.0' },
    paths: {},
    components: {
      schemas: {
        Reservation: { $ref: reference },
        ReservationCopy: { $ref: reference },
      },
    },
  })
}

describe('OpenAPI source graph', () => {
  test('loads each external document once and preserves cycles deterministically', async () => {
    expect(loadOpenApiSourceGraph).toEqual(expect.any(Function))
    if (typeof loadOpenApiSourceGraph !== 'function') return

    const externalUri = 'https://example.test/components.json'
    const externalContents = JSON.stringify({
      components: {
        schemas: {
          Reservation: {
            type: 'object',
            properties: {
              root: { $ref: './openapi.json#/components/schemas/Reservation' },
            },
          },
        },
      },
    })
    const firstMemory = createMemoryAcquirer({ [externalUri]: externalContents })
    const policy = createSourceRetrievalPolicy({ maxReferenceDepth: 4 })
    const first = await loadOpenApiSourceGraph({
      location: {
        kind: 'inline',
        uri: 'https://example.test/openapi.json',
        content: entryDocument('./components.json#/components/schemas/Reservation'),
      },
      acquirer: firstMemory.acquirer,
      policy,
    })

    expect(first.diagnostics).toEqual([])
    expect(first.graph?.entryUri).toBe('https://example.test/openapi.json')
    expect(first.graph?.documents.map(({ source }) => source.uri)).toEqual([
      'https://example.test/components.json',
      'https://example.test/openapi.json',
    ])
    expect(first.graph?.references).toHaveLength(3)
    expect(first.graph?.references.every(({ resolved }) => resolved !== undefined)).toBe(true)
    expect(firstMemory.calls.get(externalUri)).toBe(1)
    expect(first.graph?.fingerprint).toMatch(/^[a-f0-9]{64}$/)

    const secondMemory = createMemoryAcquirer({ [externalUri]: externalContents })
    const second = await loadOpenApiSourceGraph({
      location: {
        kind: 'inline',
        uri: 'https://example.test/openapi.json',
        content: entryDocument('./components.json#/components/schemas/Reservation'),
      },
      acquirer: secondMemory.acquirer,
      policy,
    })

    expect(second.graph).toEqual(first.graph)
  })

  test('retains an unresolved reference and emits a stable missing-target diagnostic', async () => {
    expect(loadOpenApiSourceGraph).toEqual(expect.any(Function))
    if (typeof loadOpenApiSourceGraph !== 'function') return

    const memory = createMemoryAcquirer({})
    const result = await loadOpenApiSourceGraph({
      location: {
        kind: 'inline',
        uri: 'https://example.test/openapi.json',
        content: entryDocument('#/components/schemas/Missing'),
      },
      acquirer: memory.acquirer,
      policy: createSourceRetrievalPolicy(),
    })

    expect(result.graph?.references).toHaveLength(2)
    expect(result.graph?.references.every(({ resolved }) => resolved === undefined)).toBe(true)
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: 'ASF-OAS-1006' }),
      expect.objectContaining({ code: 'ASF-OAS-1006' }),
    ])
  })

  test('propagates the reference-depth budget diagnostic', async () => {
    expect(loadOpenApiSourceGraph).toEqual(expect.any(Function))
    if (typeof loadOpenApiSourceGraph !== 'function') return

    const externalUri = 'https://example.test/components.json'
    const memory = createMemoryAcquirer({
      [externalUri]: JSON.stringify({
        components: { schemas: { Reservation: { type: 'object' } } },
      }),
    })
    const result = await loadOpenApiSourceGraph({
      location: {
        kind: 'inline',
        uri: 'https://example.test/openapi.json',
        content: entryDocument('./components.json#/components/schemas/Reservation'),
      },
      acquirer: memory.acquirer,
      policy: createSourceRetrievalPolicy({ maxReferenceDepth: 0 }),
    })

    expect(result.graph?.documents).toHaveLength(1)
    expect(result.diagnostics).toEqual([expect.objectContaining({ code: 'ASF-SRC-1013' })])
  })
})
