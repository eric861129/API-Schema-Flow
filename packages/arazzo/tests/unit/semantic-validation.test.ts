import { describe, expect, test } from 'vitest'

import { validateArazzoDocument } from '../../src/index.js'
import { normalizedDocument, operationStep } from '../helpers/document.js'

describe('Arazzo semantic validation', () => {
  test('accepts a unique, ordered workflow', () => {
    const document = normalizedDocument([
      {
        workflowId: 'createReservation',
        parameters: [{ name: 'tenant', in: 'header', value: '$inputs.tenant' }],
        steps: [
          operationStep('login', { outputs: { token: '$response.body#/token' } }),
          operationStep('reserve', {
            dependsOn: ['login'],
            parameters: [
              {
                name: 'Authorization',
                in: 'header',
                value: 'Bearer {$steps.login.outputs.token}',
              },
            ],
          }),
        ],
      },
    ])

    expect(validateArazzoDocument(document)).toEqual([])
  })

  test('reports duplicate IDs, invalid targets, and duplicate parameter identities', () => {
    const document = normalizedDocument(
      [
        {
          workflowId: 'duplicate',
          parameters: [
            { name: 'X-Trace', in: 'header', value: 'a' },
            { name: 'x-trace', in: 'header', value: 'b' },
          ],
          steps: [
            { stepId: 'same', successCriteria: [] },
            {
              stepId: 'same',
              operationId: 'one',
              operationPath: '#/paths/~1one/get',
              successCriteria: [],
            },
          ],
        },
        {
          workflowId: 'duplicate',
          steps: [operationStep('other')],
        },
      ],
      {
        sourceDescriptions: [
          { name: 'api', url: './one.yaml', type: 'openapi' },
          { name: 'api', url: './two.yaml', type: 'openapi' },
        ],
      },
    )

    expect(validateArazzoDocument(document).map(({ code }) => code)).toEqual([
      'ASF-ARZ-1004',
      'ASF-ARZ-1005',
      'ASF-ARZ-1006',
      'ASF-ARZ-1007',
      'ASF-ARZ-1007',
      'ASF-ARZ-1017',
    ])
  })
})
