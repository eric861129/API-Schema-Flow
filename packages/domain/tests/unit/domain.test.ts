import { describe, expect, test } from 'vitest'

import {
  createOperationId,
  createSourcePointer,
  escapeJsonPointerToken,
  isHttpMethod,
  type NormalizedOperation,
} from '../../src/index.js'

describe('domain contracts', () => {
  test('recognizes only OpenAPI operation methods', () => {
    expect(isHttpMethod('post')).toBe(true)
    expect(isHttpMethod('TRACE')).toBe(true)
    expect(isHttpMethod('connect')).toBe(false)
  })

  test('escapes RFC 6901 JSON pointer tokens', () => {
    expect(escapeJsonPointerToken('a/b~c')).toBe('a~1b~0c')
    expect(createSourcePointer('openapi.yaml', ['paths', '/spaces/{id}', 'get'])).toEqual({
      uri: 'openapi.yaml',
      pointer: '#/paths/~1spaces~1{id}/get',
    })
  })

  test('creates a stable generated operation id', () => {
    expect(createOperationId('POST', '/reservations')).toBe('operation:post:/reservations')
  })

  test('keeps the normalized operation contract constructible', () => {
    const operation: NormalizedOperation = {
      id: 'operation:post:/reservations',
      method: 'post',
      path: '/reservations',
      tags: ['Reservations'],
      deprecated: false,
      parameters: [],
      responses: [],
      security: [],
      servers: [],
      source: { uri: 'openapi.yaml', pointer: '#/paths/~1reservations/post' },
    }

    expect(operation.method).toBe('post')
  })
})
