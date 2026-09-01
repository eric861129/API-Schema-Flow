import { describe, expect, test } from 'vitest'

import { normalizeOpenApiDocument } from '../../src/index.js'

const source = {
  uri: 'memory://links.yaml',
  contents: 'openapi: 3.1.0\n',
  byteLength: 15,
} as const

const document = {
  openapi: '3.1.0',
  info: { title: 'Link API', version: '1.0.0' },
  paths: {
    '/reservations': {
      post: {
        operationId: 'createReservation',
        responses: {
          '201': {
            description: 'Created',
            links: {
              ByOperationId: {
                operationId: 'getReservation',
                description: 'Fetch the created reservation.',
                parameters: {
                  id: '$response.body#/id',
                  'query.trace': '$request.header.X-Trace',
                },
                requestBody: {
                  reservationId: '$response.body#/id',
                },
              },
              ByOperationRef: {
                operationRef: '#/paths/~1reservations~1{id}/get',
              },
            },
          },
        },
      },
    },
    '/reservations/{id}': {
      get: {
        operationId: 'getReservation',
        responses: {
          '200': { description: 'Found' },
        },
      },
    },
  },
}

describe('OpenAPI Link normalization', () => {
  test('normalizes mappings and resolves operationRef and unique operationId targets', () => {
    const result = normalizeOpenApiDocument(document, source)
    const response = result.document?.operations
      .find(({ operationId }) => operationId === 'createReservation')
      ?.responses.find(({ statusCode }) => statusCode === '201')

    expect(result.diagnostics).toEqual([])
    expect(response?.links).toEqual([
      {
        name: 'ByOperationId',
        description: 'Fetch the created reservation.',
        target: { type: 'operationId', operationId: 'getReservation' },
        resolvedOperationKey: 'operation:get:/reservations/{id}',
        parameters: [
          { target: 'id', expression: '$response.body#/id' },
          { target: 'query.trace', expression: '$request.header.X-Trace' },
        ],
        requestBody: { reservationId: '$response.body#/id' },
        source: {
          uri: source.uri,
          pointer: '#/paths/~1reservations/post/responses/201/links/ByOperationId',
        },
      },
      {
        name: 'ByOperationRef',
        target: {
          type: 'operationRef',
          operationRef: '#/paths/~1reservations~1{id}/get',
        },
        resolvedOperationKey: 'operation:get:/reservations/{id}',
        parameters: [],
        source: {
          uri: source.uri,
          pointer: '#/paths/~1reservations/post/responses/201/links/ByOperationRef',
        },
      },
    ])
  })

  test('preserves an unresolved Link and emits a stable target diagnostic', () => {
    const result = normalizeOpenApiDocument(
      {
        ...document,
        paths: {
          ...document.paths,
          '/reservations': {
            post: {
              ...document.paths['/reservations'].post,
              responses: {
                '201': {
                  description: 'Created',
                  links: {
                    Missing: {
                      operationRef: '#/paths/~1missing/get',
                    },
                  },
                },
              },
            },
          },
        },
      },
      source,
    )

    const link = result.document?.operations[0]?.responses[0]?.links[0]
    expect(link).toMatchObject({
      name: 'Missing',
      target: { type: 'operationRef', operationRef: '#/paths/~1missing/get' },
    })
    expect(link).not.toHaveProperty('resolvedOperationKey')
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: 'ASF-OAS-1007', severity: 'error' }),
    ])
  })
})
