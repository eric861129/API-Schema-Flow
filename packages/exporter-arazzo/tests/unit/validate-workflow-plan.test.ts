import { describe, expect, test } from 'vitest'

import type { FlowGraph, NormalizedApiDocument } from '@api-schema-flow/domain'

import {
  bindWorkflowPlanOperations,
  validateArazzoWorkflowPlan,
  type ArazzoWorkflowPlan,
} from '../../src/index.js'

const document: NormalizedApiDocument = {
  schemaVersion: '1.0',
  sourceUri: 'memory://api',
  openapiVersion: '3.1.0',
  compatibilityMode: false,
  info: { title: 'API', version: '1.0.0' },
  tags: [],
  servers: [],
  componentSchemas: [],
  operations: [
    {
      id: 'operation:post:/reservations',
      operationId: 'createReservation',
      method: 'post',
      path: '/reservations',
      tags: [],
      deprecated: false,
      parameters: [],
      responses: [],
      security: [],
      servers: [],
      source: { uri: 'memory://api', pointer: '#/paths/~1reservations/post' },
    },
    {
      id: 'operation:get:/reservations/{id}',
      operationId: 'getReservation',
      method: 'get',
      path: '/reservations/{id}',
      tags: [],
      deprecated: false,
      parameters: [],
      responses: [],
      security: [],
      servers: [],
      source: { uri: 'memory://api', pointer: '#/paths/~1reservations~1{id}/get' },
    },
  ],
}

const graph: FlowGraph = {
  schemaVersion: '1.0',
  id: 'graph:operation-topology:api',
  kind: 'operation-topology',
  title: 'API',
  sourceIds: ['api'],
  nodes: document.operations.map((operation) => ({
    kind: 'endpoint' as const,
    id: `endpoint:api:${operation.id}`,
    sourceId: 'api',
    operationKey: operation.id,
    operationId: operation.operationId,
    method: operation.method,
    path: operation.path,
    source: operation.source,
  })),
  edges: [],
}

function plan(overrides: Partial<ArazzoWorkflowPlan> = {}): ArazzoWorkflowPlan {
  return {
    schemaVersion: '1.0',
    workflowId: 'createReservation',
    sourceDescriptions: [{ sourceId: 'api', name: 'reservationApi', url: './openapi.yaml' }],
    steps: [
      { stepId: 'create', operationNodeId: graph.nodes[0]!.id },
      { stepId: 'get', operationNodeId: graph.nodes[1]!.id },
    ],
    ...overrides,
  }
}

describe('Arazzo workflow plan validation', () => {
  test('preserves explicit step order and binds each endpoint exactly once', () => {
    const checked = validateArazzoWorkflowPlan({
      workflowPlan: plan(),
      acceptedOperationGraph: graph,
    })
    expect(checked.diagnostics).toEqual([])
    expect(checked.workflowPlan?.steps.map(({ stepId }) => stepId)).toEqual(['create', 'get'])

    const bound = bindWorkflowPlanOperations({
      workflowPlan: checked.workflowPlan!,
      acceptedOperationGraph: graph,
      openApiSources: [{ sourceId: 'api', sourceName: 'reservationApi', document }],
    })
    expect(bound.diagnostics).toEqual([])
    expect(bound.steps.map(({ stepId, operation }) => [stepId, operation.id])).toEqual([
      ['create', 'operation:post:/reservations'],
      ['get', 'operation:get:/reservations/{id}'],
    ])
  })

  test.each([
    ['empty steps', plan({ steps: [] })],
    [
      'duplicate step IDs',
      plan({ steps: [plan().steps[0]!, { ...plan().steps[1]!, stepId: 'create' }] }),
    ],
    [
      'duplicate source names',
      plan({
        sourceDescriptions: [
          { sourceId: 'api', name: 'reservationApi', url: './openapi.yaml' },
          { sourceId: 'other', name: 'reservationApi', url: './other.yaml' },
        ],
      }),
    ],
    ['missing endpoint node', plan({ steps: [{ stepId: 'missing', operationNodeId: 'missing' }] })],
  ])('rejects %s', (_label, value) => {
    const result = validateArazzoWorkflowPlan({
      workflowPlan: value,
      acceptedOperationGraph: graph,
    })
    expect(result.workflowPlan).toBeUndefined()
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'ASF-EXP-1002', severity: 'error' }),
    )
  })

  test('reports missing source descriptions and ambiguous operation binding', () => {
    const missingSource = bindWorkflowPlanOperations({
      workflowPlan: plan({ sourceDescriptions: [] }),
      acceptedOperationGraph: graph,
      openApiSources: [{ sourceId: 'api', document }],
    })
    expect(missingSource.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'ASF-EXP-1003', severity: 'error' }),
    )

    const ambiguous = bindWorkflowPlanOperations({
      workflowPlan: plan(),
      acceptedOperationGraph: graph,
      openApiSources: [
        {
          sourceId: 'api',
          document: { ...document, operations: [...document.operations, document.operations[0]!] },
        },
      ],
    })
    expect(ambiguous.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'ASF-EXP-1003', severity: 'error' }),
    )
  })
})
