import { parseRuntimeExpression } from '@api-schema-flow/arazzo'
import { describe, expect, test } from 'vitest'

import { runtimeExpressionToSelector } from '../../src/index.js'

function expression(raw: string) {
  const result = parseRuntimeExpression(raw)
  expect(result.diagnostics).toEqual([])
  expect(result.expression).toBeDefined()
  return result.expression!
}

describe('runtime expression selector projection', () => {
  test.each([
    ['$response.body#/id', { kind: 'response-body', pointer: '#/id' }],
    ['$response.header.ETag', { kind: 'response-header', name: 'ETag' }],
    ['$request.body#/user/id', { kind: 'request-body', pointer: '#/user/id' }],
    ['$request.header.X-Trace', { kind: 'request-header', name: 'X-Trace' }],
    ['$request.query.filter', { kind: 'request-query', name: 'filter' }],
    ['$request.path.id', { kind: 'request-path', name: 'id' }],
    ['$statusCode', { kind: 'status-code' }],
    ['$inputs.userId', { kind: 'workflow-input', name: 'userId' }],
  ])('maps %s to a structural selector', (raw, expected) => {
    expect(runtimeExpressionToSelector(expression(raw))).toEqual(expected)
  })

  test.each([
    '$steps.login.outputs.token',
    '$workflows.checkout.outputs.orderId',
    '$components.parameters.traceId',
    '$sourceDescriptions.api.getUser',
    '$method',
  ])('does not guess unsupported expression %s', (raw) => {
    expect(runtimeExpressionToSelector(expression(raw))).toBeUndefined()
  })
})
