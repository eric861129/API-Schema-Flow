import { describe, expect, test } from 'vitest'

import {
  parseRuntimeExpression,
  runtimeExpressionStepDependencies,
} from '../../src/index.js'

describe('Arazzo Runtime Expression parsing', () => {
  test.each([
    ['$url', { kind: 'context', context: 'url' }],
    ['$method', { kind: 'context', context: 'method' }],
    ['$statusCode', { kind: 'context', context: 'statusCode' }],
    ['$self', { kind: 'context', context: 'self' }],
    [
      '$request.header.Authorization',
      { kind: 'http', message: 'request', location: 'header', name: 'Authorization' },
    ],
    [
      '$request.query.filter',
      { kind: 'http', message: 'request', location: 'query', name: 'filter' },
    ],
    [
      '$request.path.id',
      { kind: 'http', message: 'request', location: 'path', name: 'id' },
    ],
    [
      '$request.body#/reservation/id',
      {
        kind: 'http',
        message: 'request',
        location: 'body',
        pointer: '#/reservation/id',
      },
    ],
    [
      '$response.header.X-Rate-Limit',
      {
        kind: 'http',
        message: 'response',
        location: 'header',
        name: 'X-Rate-Limit',
      },
    ],
    [
      '$response.body#/id',
      { kind: 'http', message: 'response', location: 'body', pointer: '#/id' },
    ],
    [
      '$message.payload#/orderId',
      { kind: 'message', location: 'payload', pointer: '#/orderId' },
    ],
    ['$inputs.username', { kind: 'named', scope: 'inputs', name: 'username' }],
    [
      '$outputs.reservationId',
      { kind: 'named', scope: 'outputs', name: 'reservationId' },
    ],
    [
      '$steps.login.outputs.token',
      { kind: 'step-output', stepId: 'login', outputName: 'token' },
    ],
    [
      '$workflows.checkout.outputs.orderId',
      { kind: 'workflow-output', workflowId: 'checkout', outputName: 'orderId' },
    ],
    [
      '$sourceDescriptions.reservationApi.createReservation',
      {
        kind: 'source-operation',
        sourceName: 'reservationApi',
        operationId: 'createReservation',
      },
    ],
    [
      '$components.parameters.authorization',
      { kind: 'component', componentType: 'parameters', name: 'authorization' },
    ],
  ] as const)('parses %s', (raw, expected) => {
    const result = parseRuntimeExpression(raw)

    expect(result.diagnostics).toEqual([])
    expect(result.expression).toMatchObject({ raw, ...expected })
  })

  test.each([
    '$request.body#not-a-pointer',
    '$steps.login.token',
    '$workflows.checkout.orderId',
    '$unknown.value',
    '$components.parameters',
    'not-an-expression',
  ])('rejects invalid expression %s with a source-addressable diagnostic', (raw) => {
    const result = parseRuntimeExpression(raw, {
      uri: 'memory://workflow',
      pointer: '#/workflows/0/steps/0/parameters/0/value',
    })

    expect(result.expression).toBeUndefined()
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: 'ASF-ARZ-1010',
        severity: 'error',
        source: {
          uri: 'memory://workflow',
          pointer: '#/workflows/0/steps/0/parameters/0/value',
        },
      }),
    ])
  })

  test('extracts step dependencies from parsed expressions and strings', () => {
    const parsed = parseRuntimeExpression('$steps.login.outputs.token').expression

    expect(runtimeExpressionStepDependencies(parsed)).toEqual(['login'])
    expect(runtimeExpressionStepDependencies('$steps.reserve.outputs.id')).toEqual([
      'reserve',
    ])
    expect(runtimeExpressionStepDependencies('$inputs.username')).toEqual([])
  })
})
