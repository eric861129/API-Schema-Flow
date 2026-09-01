import { describe, expect, test } from 'vitest'

import { normalizeOpenApiDocument } from '../../src/index.js'

const source = {
  uri: 'memory://link-red-contract.yaml',
  contents: 'openapi: 3.1.0\n',
  byteLength: 15,
} as const

describe('OpenAPI Link unresolved contract', () => {
  test('preserves an unresolved Link without throwing and emits a stable diagnostic', () => {
    const result = normalizeOpenApiDocument(
      {
        openapi: '3.1.0',
        info: { title: 'Link API', version: '1.0.0' },
        paths: {
          '/reservations': {
            post: {
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

    const link = result.document?.operations[0]?.responses[0]?.links?.[0]
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
