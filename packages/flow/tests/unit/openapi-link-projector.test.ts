import { describe, expect, test } from 'vitest'

import { projectOpenApiLinks, resolveLinkParameterTarget } from '../../src/index.js'
import { createReservationOpenApiSource } from '../helpers/fixtures.js'

describe('OpenAPI Link projection', () => {
  test('resolves unqualified targets against the target operation', () => {
    const source = createReservationOpenApiSource({ includeLink: true })
    const targetOperation = source.document.operations.find(
      ({ operationId }) => operationId === 'getReservation',
    )!

    expect(resolveLinkParameterTarget(targetOperation, 'id')).toEqual({
      kind: 'path-parameter',
      name: 'id',
    })
    expect(resolveLinkParameterTarget(targetOperation, 'path.id')).toEqual({
      kind: 'path-parameter',
      name: 'id',
    })
  })

  test('projects a resolved Link into one declared accepted data edge', () => {
    const result = projectOpenApiLinks(createReservationOpenApiSource({ includeLink: true }))

    expect(result.diagnostics).toEqual([])
    expect(result.nodes).toHaveLength(4)
    expect(result.edges).toHaveLength(1)
    expect(result.edges[0]).toMatchObject({
      kind: 'data',
      provenance: 'declared',
      status: 'accepted',
      mappings: [
        {
          source: { kind: 'response-body', pointer: '#/id' },
          target: { kind: 'path-parameter', name: 'id' },
        },
      ],
      sourceStandardRefs: [expect.objectContaining({ standard: 'openapi-link' })],
    })
  })

  test('does not create an edge when a Link target is unresolved', () => {
    const source = createReservationOpenApiSource({ includeLink: true })
    const operations = source.document.operations.map((operation) => ({
      ...operation,
      responses: operation.responses.map((response) => ({
        ...response,
        links: response.links.map((link) => ({
          name: link.name,
          ...(link.description === undefined ? {} : { description: link.description }),
          target: link.target,
          parameters: link.parameters,
          ...(link.requestBody === undefined ? {} : { requestBody: link.requestBody }),
          source: link.source,
        })),
      })),
    }))

    const result = projectOpenApiLinks({
      ...source,
      document: { ...source.document, operations },
    })

    expect(result.edges).toEqual([])
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: 'ASF-FLW-1002', severity: 'error' }),
    ])
  })
})
