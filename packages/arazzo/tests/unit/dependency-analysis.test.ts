import { describe, expect, test } from 'vitest'

import { analyzeWorkflowDependencies } from '../../src/index.js'
import { normalizedDocument, operationStep } from '../helpers/document.js'

describe('Arazzo workflow dependency analysis', () => {
  test('combines explicit and implicit dependencies in deterministic topological order', () => {
    const workflow = normalizedDocument([
      {
        workflowId: 'checkout',
        steps: [
          operationStep('login', {
            outputs: { token: '$response.body#/token' },
          }),
          operationStep('reserve', {
            dependsOn: ['login'],
            parameters: [
              {
                name: 'Authorization',
                in: 'header',
                value: 'Bearer {$steps.login.outputs.token}',
              },
            ],
            outputs: { id: '$response.body#/id' },
          }),
          operationStep('confirm', {
            requestBody: {
              payload: {
                reservationId: '$steps.reserve.outputs.id',
                token: '$steps.login.outputs.token',
              },
            },
          }),
        ],
      },
    ]).workflows[0]!

    const result = analyzeWorkflowDependencies(workflow)

    expect(result.diagnostics).toEqual([])
    expect(result.order).toEqual(['login', 'reserve', 'confirm'])
    expect(result.steps).toEqual([
      {
        stepId: 'login',
        explicit: [],
        implicit: [],
        all: [],
        forward: [],
        missing: [],
      },
      {
        stepId: 'reserve',
        explicit: ['login'],
        implicit: ['login'],
        all: ['login'],
        forward: [],
        missing: [],
      },
      {
        stepId: 'confirm',
        explicit: [],
        implicit: ['login', 'reserve'],
        all: ['login', 'reserve'],
        forward: [],
        missing: [],
      },
    ])
  })

  test('reports missing, forward, missing-output, and cyclic dependencies', () => {
    const workflow = normalizedDocument([
      {
        workflowId: 'invalid',
        steps: [
          operationStep('first', {
            dependsOn: ['missing'],
            parameters: [{ name: 'future', in: 'query', value: '$steps.second.outputs.id' }],
          }),
          operationStep('second', {
            dependsOn: ['third'],
            outputs: { other: '$response.body#/other' },
          }),
          operationStep('third', {
            dependsOn: ['second'],
          }),
        ],
      },
    ]).workflows[0]!

    const result = analyzeWorkflowDependencies(workflow)

    expect(result.order).toEqual(['first'])
    expect(result.steps[0]).toMatchObject({
      stepId: 'first',
      forward: ['second'],
      missing: ['missing'],
    })
    expect(result.diagnostics.map(({ code }) => code)).toEqual([
      'ASF-ARZ-1008',
      'ASF-ARZ-1009',
      'ASF-ARZ-1011',
      'ASF-ARZ-1012',
      'ASF-ARZ-1012',
    ])
  })
})
