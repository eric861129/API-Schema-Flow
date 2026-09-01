import { describe, expect, test } from 'vitest'

import { resolveArazzoOperations, type ArazzoOperationCatalog } from '../../src/index.js'
import { normalizedDocument } from '../helpers/document.js'

const apiCatalog: ArazzoOperationCatalog = {
  sourceName: 'reservationApi',
  sourceUri: 'file:///workspace/openapi.yaml',
  sourceType: 'openapi',
  operations: [
    {
      key: 'operation:post:/reservations',
      operationId: 'createReservation',
      operationPath: '#/paths/~1reservations/post',
    },
    {
      key: 'operation:get:/reservations/{id}',
      operationId: 'getReservation',
      operationPath: '#/paths/~1reservations~1{id}/get',
    },
  ],
}

function documentWithStep(step: Record<string, unknown>, overrides = {}) {
  return normalizedDocument(
    [{ workflowId: 'flow', steps: [{ stepId: 'target', successCriteria: [], ...step }] }],
    {
      sourceDescriptions: [{ name: 'reservationApi', url: './openapi.yaml', type: 'openapi' }],
      ...overrides,
    },
  )
}

describe('Arazzo operation resolution', () => {
  test.each([
    [{ operationId: 'createReservation' }, 'operation:post:/reservations'],
    [
      { operationId: '$sourceDescriptions.reservationApi.getReservation' },
      'operation:get:/reservations/{id}',
    ],
    [
      {
        operationPath: '{$sourceDescriptions.reservationApi.url}#/paths/~1reservations/post',
      },
      'operation:post:/reservations',
    ],
  ] as const)('resolves an OpenAPI target %o', (step, operationKey) => {
    const result = resolveArazzoOperations(
      documentWithStep(step),
      [apiCatalog],
      'file:///workspace/workflow.arazzo.yaml',
    )

    expect(result.diagnostics).toEqual([])
    expect(result.resolutions).toEqual([
      expect.objectContaining({
        workflowId: 'flow',
        stepId: 'target',
        status: 'resolved',
        sourceName: 'reservationApi',
        operationKey,
      }),
    ])
  })

  test('reports a missing operation without dropping the step', () => {
    const result = resolveArazzoOperations(
      documentWithStep({ operationId: 'missingOperation' }),
      [apiCatalog],
      'file:///workspace/workflow.arazzo.yaml',
    )

    expect(result.resolutions[0]).toMatchObject({
      workflowId: 'flow',
      stepId: 'target',
      status: 'missing',
    })
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: 'ASF-ARZ-1014', severity: 'error' }),
    ])
  })

  test('reports an ambiguous unqualified operationId', () => {
    const secondCatalog: ArazzoOperationCatalog = {
      sourceName: 'secondaryApi',
      sourceUri: 'file:///workspace/secondary.yaml',
      sourceType: 'openapi',
      operations: [
        {
          key: 'operation:post:/secondary-reservations',
          operationId: 'createReservation',
          operationPath: '#/paths/~1secondary-reservations/post',
        },
      ],
    }
    const document = documentWithStep(
      { operationId: 'createReservation' },
      {
        sourceDescriptions: [
          { name: 'reservationApi', url: './openapi.yaml', type: 'openapi' },
          { name: 'secondaryApi', url: './secondary.yaml', type: 'openapi' },
        ],
      },
    )

    const result = resolveArazzoOperations(
      document,
      [apiCatalog, secondCatalog],
      'file:///workspace/workflow.arazzo.yaml',
    )

    expect(result.resolutions[0]).toMatchObject({ status: 'ambiguous' })
    expect(result.resolutions[0]?.candidates).toEqual([
      'operation:post:/reservations',
      'operation:post:/secondary-reservations',
    ])
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: 'ASF-ARZ-1015', severity: 'error' }),
    ])
  })

  test('rejects an OpenAPI operation target bound to an AsyncAPI source', () => {
    const asyncCatalog: ArazzoOperationCatalog = {
      sourceName: 'events',
      sourceUri: 'file:///workspace/asyncapi.yaml',
      sourceType: 'asyncapi',
      operations: [{ key: 'operation:publish:/orders', operationId: 'publishOrder' }],
    }
    const document = documentWithStep(
      { operationId: '$sourceDescriptions.events.publishOrder' },
      {
        sourceDescriptions: [{ name: 'events', url: './asyncapi.yaml', type: 'asyncapi' }],
      },
    )

    const result = resolveArazzoOperations(
      document,
      [asyncCatalog],
      'file:///workspace/workflow.arazzo.yaml',
    )

    expect(result.resolutions[0]).toMatchObject({ status: 'type-mismatch' })
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: 'ASF-ARZ-1016', severity: 'error' }),
    ])
  })

  test.each([
    [{ workflowId: 'nestedWorkflow' }, 'workflowId'],
    [{ channelPath: '#/channels/orders' }, 'channelPath'],
  ] as const)('preserves non-OpenAPI target %s without pretending to bind it', (step, type) => {
    const result = resolveArazzoOperations(
      documentWithStep(step),
      [apiCatalog],
      'file:///workspace/workflow.arazzo.yaml',
    )

    expect(result.diagnostics).toEqual([])
    expect(result.resolutions[0]).toMatchObject({
      status: 'preserve-only',
      target: { type },
    })
  })
})
