import { describe, expect, test } from 'vitest'

import {
  parseRuntimeTemplate,
  runtimeExpressionStepDependencies,
} from '../../src/index.js'

describe('Arazzo Runtime Expression templates', () => {
  test('keeps a pure expression typed instead of coercing it to a string template', () => {
    const result = parseRuntimeTemplate('$steps.login.outputs.token')

    expect(result.diagnostics).toEqual([])
    expect(result.template).toBeUndefined()
    expect(result.expression).toMatchObject({
      kind: 'step-output',
      stepId: 'login',
      outputName: 'token',
    })
  })

  test('parses embedded expressions while preserving literal segments', () => {
    const result = parseRuntimeTemplate(
      'Bearer {$steps.login.outputs.token} for {$inputs.username}',
    )

    expect(result.diagnostics).toEqual([])
    expect(result.template).toEqual({
      kind: 'template',
      raw: 'Bearer {$steps.login.outputs.token} for {$inputs.username}',
      segments: [
        { kind: 'literal', value: 'Bearer ' },
        {
          kind: 'expression',
          expression: expect.objectContaining({
            kind: 'step-output',
            stepId: 'login',
            outputName: 'token',
          }),
        },
        { kind: 'literal', value: ' for ' },
        {
          kind: 'expression',
          expression: expect.objectContaining({
            kind: 'named',
            scope: 'inputs',
            name: 'username',
          }),
        },
      ],
    })
    expect(runtimeExpressionStepDependencies(result.template)).toEqual(['login'])
  })

  test('represents an ordinary string as one literal segment', () => {
    const result = parseRuntimeTemplate('Bearer static-token')

    expect(result.diagnostics).toEqual([])
    expect(result.expression).toBeUndefined()
    expect(result.template).toEqual({
      kind: 'template',
      raw: 'Bearer static-token',
      segments: [{ kind: 'literal', value: 'Bearer static-token' }],
    })
  })

  test.each([
    'Bearer {$steps.login.outputs.token',
    'Bearer $steps.login.outputs.token}',
    'Bearer {$steps.login.token}',
  ])('rejects malformed template %s', (raw) => {
    const result = parseRuntimeTemplate(raw)

    expect(result.expression).toBeUndefined()
    expect(result.template).toBeUndefined()
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: 'ASF-ARZ-1010', severity: 'error' }),
    ])
  })
})
