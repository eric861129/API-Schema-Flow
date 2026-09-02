import { describe, expect, test } from 'vitest'

import { resolveArazzoBaseUri, resolveSourceDescriptionUris } from '../../src/index.js'
import { normalizedDocument, operationStep } from '../helpers/document.js'

describe('Arazzo source URI resolution', () => {
  test.each([
    [
      { $self: 'https://docs.example.test/workflows/main.yaml' },
      'https://retrieval.example.test/incoming.arazzo.yaml',
      'https://docs.example.test/workflows/main.yaml',
    ],
    [
      { $self: './canonical/main.yaml' },
      'file:///workspace/workflows/incoming.arazzo.yaml',
      'file:///workspace/workflows/canonical/main.yaml',
    ],
    [
      {},
      'https://retrieval.example.test/incoming.arazzo.yaml',
      'https://retrieval.example.test/incoming.arazzo.yaml',
    ],
  ] as const)('resolves the effective base URI', (overrides, retrievalUri, expected) => {
    const document = normalizedDocument(
      [{ workflowId: 'one', steps: [operationStep('one')] }],
      overrides,
    )

    expect(resolveArazzoBaseUri(document, retrievalUri)).toEqual({
      baseUri: expected,
      diagnostics: [],
    })
  })

  test('rejects a $self URI with a fragment', () => {
    const document = normalizedDocument([{ workflowId: 'one', steps: [operationStep('one')] }], {
      $self: './canonical/main.yaml#fragment',
    })

    const result = resolveArazzoBaseUri(
      document,
      'file:///workspace/workflows/incoming.arazzo.yaml',
    )

    expect(result.baseUri).toBeUndefined()
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: 'ASF-ARZ-1013', severity: 'error' }),
    ])
  })

  test('resolves Source Description URLs against $self before the retrieval URI', () => {
    const document = normalizedDocument([{ workflowId: 'one', steps: [operationStep('one')] }], {
      $self: './canonical/main.yaml',
      sourceDescriptions: [
        { name: 'api', url: '../contracts/openapi.yaml', type: 'openapi' },
        {
          name: 'events',
          url: 'https://events.example.test/asyncapi.yaml',
          type: 'asyncapi',
        },
      ],
    })

    const result = resolveSourceDescriptionUris(
      document,
      'file:///workspace/workflows/incoming.arazzo.yaml',
    )

    expect(result.diagnostics).toEqual([])
    expect(result.baseUri).toBe('file:///workspace/workflows/canonical/main.yaml')
    expect(result.sources.map(({ name, resolvedUri }) => ({ name, resolvedUri }))).toEqual([
      {
        name: 'api',
        resolvedUri: 'file:///workspace/workflows/contracts/openapi.yaml',
      },
      {
        name: 'events',
        resolvedUri: 'https://events.example.test/asyncapi.yaml',
      },
    ])
  })
})
