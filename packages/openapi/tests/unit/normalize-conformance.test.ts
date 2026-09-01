import { describe, expect, test } from 'vitest'

import { normalizeOpenApiDocument } from '../../src/index.js'

const source = {
  uri: 'memory://conformance.yaml',
  contents: 'openapi: 3.2.0\n',
  byteLength: 15,
} as const

function createDocument(paths: Record<string, unknown>, openapi = '3.1.0') {
  return {
    openapi,
    info: { title: 'Conformance API', version: '1.0.0' },
    paths,
  }
}

describe('OpenAPI normalization conformance', () => {
  test('retains duplicate operationId operations and emits an ambiguity error', () => {
    const result = normalizeOpenApiDocument(
      createDocument({
        '/first': {
          get: {
            operationId: 'sharedOperation',
            responses: { '200': { description: 'OK' } },
          },
        },
        '/second': {
          post: {
            operationId: 'sharedOperation',
            responses: { '201': { description: 'Created' } },
          },
        },
      }),
      source,
    )

    expect(result.document?.operations).toHaveLength(2)
    expect(result.document?.operations.map(({ id }) => id)).toEqual([
      'operation:get:/first',
      'operation:post:/second',
    ])
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: 'ASF-OAS-1005', severity: 'error' }),
    ])
  })

  test('merges header parameters case-insensitively and keeps the operation override', () => {
    const result = normalizeOpenApiDocument(
      createDocument({
        '/items': {
          parameters: [
            {
              name: 'X-Trace-Id',
              in: 'header',
              description: 'Path-level value.',
              schema: { type: 'string' },
            },
          ],
          get: {
            parameters: [
              {
                name: 'x-trace-id',
                in: 'header',
                description: 'Operation-level value.',
                schema: { type: 'string' },
              },
            ],
            responses: { '200': { description: 'OK' } },
          },
        },
      }),
      source,
    )

    expect(result.diagnostics).toEqual([])
    expect(result.document?.operations[0]?.parameters).toEqual([
      expect.objectContaining({
        name: 'x-trace-id',
        location: 'header',
        description: 'Operation-level value.',
      }),
    ])
  })

  test('retains query and querystring parameters while warning about their name conflict', () => {
    const result = normalizeOpenApiDocument(
      createDocument(
        {
          '/search': {
            get: {
              parameters: [
                {
                  name: 'filter',
                  in: 'query',
                  schema: { type: 'string' },
                },
                {
                  name: 'filter',
                  in: 'querystring',
                  schema: { type: 'string' },
                },
              ],
              responses: { '200': { description: 'OK' } },
            },
          },
        },
        '3.2.0',
      ),
      source,
    )

    expect(result.document?.operations[0]?.parameters.map(({ location }) => location)).toEqual([
      'query',
      'querystring',
    ])
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: 'ASF-OAS-2001', severity: 'warning' }),
      expect.objectContaining({ code: 'ASF-OAS-2002', severity: 'warning' }),
    ])
  })
})
