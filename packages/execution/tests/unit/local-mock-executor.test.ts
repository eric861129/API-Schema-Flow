import { describe, expect, it } from 'vitest'
import type { NormalizedOperation } from '@api-schema-flow/domain'
import type { CanonicalArazzoDocument } from '@api-schema-flow/exporter-arazzo'
import { InMemoryMockSession } from '@api-schema-flow/mock-runtime'

import fixture from '../../../../apps/web/public/fixtures/reservation-workspace.json'
import { executeLocalMockWorkflow, prepareLocalMockWorkflow } from '../../src/index.js'

const operations = fixture.apiDocument.operations as unknown as NormalizedOperation[]
const document: CanonicalArazzoDocument = {
  arazzo: '1.1.0',
  info: { title: 'Reservation', version: '1.0.0' },
  sourceDescriptions: [{ name: 'api', url: './openapi.yaml', type: 'openapi' }],
  workflows: [
    {
      workflowId: 'createAndRead',
      steps: [
        {
          stepId: 'createReservation',
          operationId: 'createReservation',
          outputs: { id: '$response.body#/id' },
        },
        {
          stepId: 'getReservation',
          operationId: 'getReservation',
          dependsOn: ['createReservation'],
          parameters: [{ name: 'id', in: 'path', value: '$steps.createReservation.outputs.id' }],
        },
      ],
    },
  ],
}

describe('local Mock workflow execution', () => {
  it('follows the explicit binding and traces a successful create/read without leaking body values', () => {
    const prepared = prepareLocalMockWorkflow(document, operations)
    expect(prepared.reason).toBeUndefined()
    const session = new InMemoryMockSession()
    const run = executeLocalMockWorkflow(
      prepared.plan!,
      {
        spaceId: '11111111-1111-4111-8111-111111111111',
        startTime: '2026-09-18T09:00:00Z',
        endTime: '2026-09-18T10:00:00Z',
      },
      session,
    )
    expect(run.status).toBe('passed')
    expect(run.sameEntity).toBe(true)
    expect(
      run.trace.map((event) => [event.sequence, event.responseStatus, event.entityCount]),
    ).toEqual([
      [1, 201, 1],
      [2, 200, 1],
    ])
    expect(JSON.stringify(run)).not.toContain('11111111-1111-4111-8111-111111111111')
  })

  it('blocks an unbound or unsupported flow', () => {
    const withoutMapping: CanonicalArazzoDocument = {
      ...document,
      workflows: [
        {
          ...document.workflows[0]!,
          steps: [
            { stepId: 'createReservation', operationId: 'createReservation' },
            { stepId: 'getReservation', operationId: 'getReservation' },
          ],
        },
      ],
    }
    expect(prepareLocalMockWorkflow(withoutMapping, operations).reason).toContain(
      'Select the accepted',
    )
  })

  it('keeps the session unchanged after request validation fails', () => {
    const session = new InMemoryMockSession()
    const plan = prepareLocalMockWorkflow(document, operations).plan!
    const run = executeLocalMockWorkflow(plan, { spaceId: 'invalid' }, session)
    expect(run.status).toBe('failed')
    expect(run.trace).toEqual([])
    expect(session.summary.entityCount).toBe(0)
  })
})
