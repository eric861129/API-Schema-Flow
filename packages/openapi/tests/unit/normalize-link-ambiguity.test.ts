import { describe, expect, test } from 'vitest'

import { normalizeOpenApiDocument } from '../../src/index.js'

const source = {
  uri: 'memory://link-ambiguity.yaml',
  contents: 'openapi: 3.1.0\n',
  byteLength: 15,
} as const

describe('OpenAPI Link target ambiguity', () => {
  test('preserves an ambiguous operationId Link and emits duplicate and target diagnostics', () => {
    const result = normalizeOpenApiDocument(
      {
        openapi: '3.1.0',
        info: { title: 'Ambiguous Link API', version: '1.0.0' },
        paths: {
          '/create': {
            post: {
              responses: {
                '201': {
                  description: 'Created',
                  links: {
                    Ambiguous: { operationId: 'sharedOperation' },
                  },
                },
              },
            },
          },
          '/first': {
            get: {
              operationId: 'sharedOperation',
              responses: { '200': { description: 'OK' } },
            },
          },
          '/second': {
            get: {
              operationId: 'sharedOperation',
              responses: { '200': { description: 'OK' } },
            },
          },
        },
      },
      source,
    )

    const link = result.document?.operations[0]?.responses[0]?.links?.[0]
    expect(link).toMatchObject({
      name: 'Ambiguous',
      target: { type: 'operationId', operationId: 'sharedOperation' },
    })
    expect(link).not.toHaveProperty('resolvedOperationKey')
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: 'ASF-OAS-1005', severity: 'error' }),
      expect.objectContaining({ code: 'ASF-OAS-1008', severity: 'error' }),
    ])
  })
})
