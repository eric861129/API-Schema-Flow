import { describe, expect, test } from 'vitest'

import { analyzeArazzoSupport } from '../../src/index.js'
import { normalizedDocument, operationStep } from '../helpers/document.js'

describe('Arazzo support analysis', () => {
  test('classifies supported synchronous OpenAPI workflows', () => {
    const document = normalizedDocument([
      {
        workflowId: 'supported',
        steps: [
          operationStep('login', {
            onFailure: [{ name: 'retry-login', type: 'retry', retry: 1 }],
          }),
          operationStep('finish', {
            dependsOn: ['login'],
            onSuccess: [{ name: 'end-flow', type: 'end' }],
          }),
        ],
        'x-layout': 'simple',
      },
    ])

    const report = analyzeArazzoSupport(document)

    expect(report.level).toBe('supported')
    expect(report.summary).toEqual({ supported: 4, preserveOnly: 0, invalid: 0 })
    expect(report.workflows[0]).toMatchObject({
      workflowId: 'supported',
      level: 'supported',
    })
  })

  test('marks valid-but-not-executable features as preserve-only', () => {
    const document = normalizedDocument(
      [
        {
          workflowId: 'mixed',
          futureWorkflowField: true,
          steps: [
            {
              stepId: 'nested',
              workflowId: 'otherWorkflow',
              successCriteria: [{ condition: '$statusCode == 200', type: 'regex' }],
              onSuccess: [{ name: 'jump', type: 'goto', stepId: 'later' }],
            },
            {
              stepId: 'async',
              channelPath: '{$sourceDescriptions.events.url}#/channels/orders',
              futureStepField: 'send',
              successCriteria: [],
            },
          ],
        },
      ],
      {
        sourceDescriptions: [{ name: 'events', url: './asyncapi.yaml', type: 'asyncapi' }],
      },
    )

    const report = analyzeArazzoSupport(document)

    expect(report.level).toBe('preserve-only')
    expect(report.summary.preserveOnly).toBeGreaterThanOrEqual(6)
    expect(report.features).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ feature: 'source:asyncapi', level: 'preserve-only' }),
        expect.objectContaining({ feature: 'target:workflowId', level: 'preserve-only' }),
        expect.objectContaining({ feature: 'target:channelPath', level: 'preserve-only' }),
        expect.objectContaining({ feature: 'criterion:regex', level: 'preserve-only' }),
        expect.objectContaining({ feature: 'action:goto', level: 'preserve-only' }),
        expect.objectContaining({ feature: 'unknown-field', level: 'preserve-only' }),
      ]),
    )
  })

  test('marks semantically invalid documents as invalid', () => {
    const document = normalizedDocument([
      {
        workflowId: 'invalid',
        steps: [{ stepId: 'broken', successCriteria: [] }],
      },
    ])

    const report = analyzeArazzoSupport(document)

    expect(report.level).toBe('invalid')
    expect(report.summary.invalid).toBeGreaterThan(0)
  })
})
