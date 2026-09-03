import { describe, expect, test } from 'vitest'

import type { FlowEdge, FlowGraph, NormalizedApiDocument } from '@api-schema-flow/domain'
import type { FlowOpenApiSource } from '@api-schema-flow/flow'

import {
  bindWorkflowPlanOperations,
  projectAcceptedMappings,
  type ArazzoWorkflowPlan,
} from '../../src/index.js'

const source: FlowOpenApiSource = {
  sourceId: 'api',
  sourceName: 'reservationApi',
  document: {
    schemaVersion: '1.0',
    sourceUri: 'memory://api',
    openapiVersion: '3.1.0',
    compatibilityMode: false,
    info: { title: 'API', version: '1.0.0' },
    tags: [],
    servers: [],
    componentSchemas: [],
    operations: [
      operation('operation:post:/reservations', 'post', '/reservations', 'createReservation'),
      operation('operation:get:/reservations/{id}', 'get', '/reservations/{id}', 'getReservation'),
    ],
  },
}

function operation(id: string, method: 'post' | 'get', path: string, operationId: string) {
  return {
    id,
    operationId,
    method,
    path,
    tags: [],
    deprecated: false,
    parameters: [],
    responses: [],
    security: [],
    servers: [],
    source: { uri: 'memory://api', pointer: '#' },
  } satisfies NormalizedApiDocument['operations'][number]
}

const nodes = source.document.operations.map((entry) => ({
  kind: 'endpoint' as const,
  id: `endpoint:api:${entry.id}`,
  sourceId: 'api',
  operationKey: entry.id,
  operationId: entry.operationId,
  method: entry.method,
  path: entry.path,
  source: entry.source,
}))

const plan: ArazzoWorkflowPlan = {
  schemaVersion: '1.0',
  workflowId: 'createReservation',
  sourceDescriptions: [{ sourceId: 'api', name: 'reservationApi', url: './openapi.yaml' }],
  steps: [
    { stepId: 'create', operationNodeId: nodes[0]!.id },
    { stepId: 'get', operationNodeId: nodes[1]!.id },
  ],
}

function edge(
  sourceSelector: FlowEdge['mappings'][number]['source'],
  target: FlowEdge['mappings'][number]['target'],
  overrides: Partial<FlowEdge['mappings'][number]> = {},
): FlowEdge {
  return {
    id: `edge:${sourceSelector.kind}:${target.kind}`,
    kind: 'data',
    sourceNodeId: nodes[0]!.id,
    targetNodeId: nodes[1]!.id,
    provenance: 'inferred',
    status: 'accepted',
    mappings: [
      {
        id: `mapping:${sourceSelector.kind}:${target.kind}`,
        source: sourceSelector,
        target,
        aliases: [],
        sourcePointers: [],
        ...overrides,
      },
    ],
    sourceStandardRefs: [],
  }
}

function project(edges: FlowEdge[], steps = plan.steps) {
  const graph: FlowGraph = {
    schemaVersion: '1.0',
    id: 'graph:operation-topology:api',
    kind: 'operation-topology',
    title: 'API',
    sourceIds: ['api'],
    nodes,
    edges,
  }
  const workflowPlan = { ...plan, steps }
  const bound = bindWorkflowPlanOperations({
    workflowPlan,
    acceptedOperationGraph: graph,
    openApiSources: [source],
  })
  return projectAcceptedMappings({
    workflowPlan,
    acceptedOperationGraph: graph,
    boundSteps: bound.steps,
  })
}

describe('accepted mapping projection', () => {
  test('projects response outputs, parameters, request body, and dependsOn', () => {
    const result = project([
      edge({ kind: 'response-body', pointer: '#/id' }, { kind: 'path-parameter', name: 'id' }),
      edge(
        { kind: 'response-header', name: 'Location' },
        { kind: 'header-parameter', name: 'X-Location' },
      ),
      edge({ kind: 'status-code' }, { kind: 'query-parameter', name: 'status' }),
      edge(
        { kind: 'response-body', pointer: '#/id' },
        { kind: 'cookie-parameter', name: 'reservation' },
      ),
      edge(
        { kind: 'response-body', pointer: '#/id' },
        { kind: 'request-body', pointer: '#/reservation/id' },
      ),
    ])

    expect(result.diagnostics).toEqual([])
    expect(result.steps[0]).toMatchObject({
      stepId: 'create',
      outputs: {
        id: '$response.body#/id',
        location: '$response.header.Location',
        statusCode: '$statusCode',
      },
    })
    expect(result.steps[1]).toMatchObject({
      stepId: 'get',
      dependsOn: ['create'],
      parameters: expect.arrayContaining([
        { name: 'id', in: 'path', value: '$steps.create.outputs.id' },
        { name: 'status', in: 'query', value: '$steps.create.outputs.statusCode' },
        { name: 'X-Location', in: 'header', value: '$steps.create.outputs.location' },
        { name: 'reservation', in: 'cookie', value: '$steps.create.outputs.id' },
      ]),
      requestBody: {
        contentType: 'application/json',
        payload: { reservation: { id: '$steps.create.outputs.id' } },
      },
    })
  })

  test('rewrites a single-expression template to the generated output', () => {
    const result = project([
      edge(
        { kind: 'response-body', pointer: '#/token' },
        { kind: 'header-parameter', name: 'Authorization' },
        { transform: { kind: 'template', raw: 'Bearer {$steps.old.outputs.token}' } },
      ),
    ])
    expect(result.steps[1]?.parameters).toContainEqual({
      name: 'Authorization',
      in: 'header',
      value: 'Bearer {$steps.create.outputs.token}',
    })
  })

  test.each([
    [
      'querystring targets',
      edge(
        { kind: 'response-body', pointer: '#/id' },
        { kind: 'querystring-parameter', name: 'id' },
      ),
      'ASF-EXP-1004',
    ],
    [
      'request-derived sources',
      edge({ kind: 'request-header', name: 'X' }, { kind: 'header-parameter', name: 'Y' }),
      'ASF-EXP-1004',
    ],
    [
      'numeric body segments',
      edge(
        { kind: 'response-body', pointer: '#/id' },
        { kind: 'request-body', pointer: '#/items/0/id' },
      ),
      'ASF-EXP-1004',
    ],
    [
      'multi-expression transforms',
      edge(
        { kind: 'response-body', pointer: '#/id' },
        { kind: 'header-parameter', name: 'X' },
        { transform: { kind: 'template', raw: '{$steps.a.outputs.x}-{$steps.b.outputs.y}' } },
      ),
      'ASF-EXP-1004',
    ],
  ])('blocks %s', (_label, mappingEdge, code) => {
    const result = project([mappingEdge])
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code, severity: 'error' }))
  })

  test('blocks forward references and conflicting target assignments', () => {
    const forward = project(
      [edge({ kind: 'response-body', pointer: '#/id' }, { kind: 'path-parameter', name: 'id' })],
      [...plan.steps].reverse(),
    )
    expect(forward.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'ASF-EXP-1005', severity: 'error' }),
    )

    const conflict = project([
      edge({ kind: 'response-body', pointer: '#/id' }, { kind: 'path-parameter', name: 'id' }),
      edge({ kind: 'response-header', name: 'Location' }, { kind: 'path-parameter', name: 'id' }),
    ])
    expect(conflict.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'ASF-EXP-1006', severity: 'error' }),
    )
  })
})
