import { describe, expect, test } from 'vitest'

import {
  canonicalizeJson,
  createEdgeId,
  createEndpointNodeId,
  createMappingId,
  createOperationGraphId,
  createWorkflowGraphId,
  createWorkflowStepNodeId,
} from '../../src/index.js'

const mapping = {
  id: 'ignored-for-identity',
  source: { kind: 'response-body' as const, pointer: '#/id' },
  target: { kind: 'path-parameter' as const, name: 'id' },
  aliases: [],
  sourcePointers: [],
}

describe('flow canonical identity', () => {
  test('canonicalizes object key order recursively', () => {
    expect(canonicalizeJson({ b: 1, a: { d: 2, c: 3 } })).toBe('{"a":{"c":3,"d":2},"b":1}')
  })

  test('creates stable readable node and graph identifiers', () => {
    expect(createEndpointNodeId('reservationApi', 'operation:post:/reservations')).toBe(
      'endpoint:reservationApi:operation:post:/reservations',
    )
    expect(createWorkflowStepNodeId('workflow', 'createReservation', 'login')).toBe(
      'workflow-step:workflow:createReservation:login',
    )
    expect(createOperationGraphId(['spaces', 'auth', 'spaces'])).toBe(
      'graph:operation-topology:auth,spaces',
    )
    expect(createWorkflowGraphId('workflow', 'createReservation')).toBe(
      'graph:workflow:workflow:createReservation',
    )
  })

  test('creates mapping identity from semantic values rather than key order', () => {
    expect(
      createMappingId(
        { kind: 'response-body', pointer: '#/id' },
        { kind: 'path-parameter', name: 'id' },
      ),
    ).toBe(
      createMappingId(
        { pointer: '#/id', kind: 'response-body' },
        { name: 'id', kind: 'path-parameter' },
      ),
    )
  })

  test('does not include aliases or standard references in edge identity', () => {
    const first = createEdgeId('data', 'source', 'target', [mapping])
    const second = createEdgeId('data', 'source', 'target', [
      {
        ...mapping,
        aliases: [
          {
            kind: 'step-output' as const,
            workflowId: 'workflow',
            stepId: 'create',
            outputName: 'reservationId',
          },
        ],
        sourcePointers: [{ uri: 'memory://workflow', pointer: '#/outputs/id' }],
      },
    ])

    expect(first).toBe(second)
  })
})
