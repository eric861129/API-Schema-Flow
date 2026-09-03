import { createHash } from 'node:crypto'

import { describe, expect, test } from 'vitest'
import { parse as parseYaml } from 'yaml'

import type { FlowEdge, FlowGraph, NormalizedApiDocument } from '@api-schema-flow/domain'
import type { FlowOpenApiSource } from '@api-schema-flow/flow'

import { exportArazzo, type ArazzoWorkflowPlan } from '../../src/index.js'

function operation(
  id: string,
  method: 'post' | 'get',
  path: string,
  operationId: string,
): NormalizedApiDocument['operations'][number] {
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
    source: { uri: 'memory://reservation-api', pointer: '#' },
  }
}

const openApiSource: FlowOpenApiSource = {
  sourceId: 'reservation-api',
  sourceName: 'reservationApi',
  document: {
    schemaVersion: '1.0',
    sourceUri: 'memory://reservation-api',
    openapiVersion: '3.1.0',
    compatibilityMode: false,
    info: { title: 'Reservation API', version: '1.0.0' },
    tags: [],
    servers: [],
    componentSchemas: [],
    operations: [
      operation('operation:post:/reservations', 'post', '/reservations', 'createReservation'),
      operation('operation:get:/reservations/{id}', 'get', '/reservations/{id}', 'getReservation'),
    ],
  },
}

const nodes = openApiSource.document.operations.map((entry) => ({
  kind: 'endpoint' as const,
  id: `endpoint:${openApiSource.sourceId}:${entry.id}`,
  sourceId: openApiSource.sourceId,
  operationKey: entry.id,
  operationId: entry.operationId,
  method: entry.method,
  path: entry.path,
  source: entry.source,
}))

const acceptedEdge: FlowEdge = {
  id: 'edge:reservation-id',
  kind: 'data',
  sourceNodeId: nodes[0]!.id,
  targetNodeId: nodes[1]!.id,
  provenance: 'inferred',
  status: 'accepted',
  mappings: [
    {
      id: 'mapping:reservation-id',
      source: { kind: 'response-body', pointer: '#/id' },
      target: { kind: 'path-parameter', name: 'id' },
      aliases: [],
      sourcePointers: [],
    },
  ],
  sourceStandardRefs: [],
}

const graph: FlowGraph = {
  schemaVersion: '1.0',
  id: 'graph:operation-topology:reservation-api',
  kind: 'operation-topology',
  title: 'Reservation API',
  sourceIds: [openApiSource.sourceId],
  nodes,
  edges: [acceptedEdge],
}

const workflowPlan: ArazzoWorkflowPlan = {
  schemaVersion: '1.0',
  workflowId: 'createReservation',
  summary: 'Create and retrieve a reservation',
  sourceDescriptions: [
    {
      sourceId: openApiSource.sourceId,
      name: 'reservationApi',
      url: './openapi.yaml',
    },
  ],
  steps: [
    { stepId: 'create', operationNodeId: nodes[0]!.id },
    { stepId: 'get', operationNodeId: nodes[1]!.id },
  ],
}

function input(format: 'yaml' | 'json', acceptedOperationGraph = graph) {
  return {
    title: 'Reservation workflow',
    version: '1.0.0',
    format,
    workflowPlan,
    openApiSources: [openApiSource],
    acceptedOperationGraph,
  } as const
}

describe('deterministic Arazzo export', () => {
  test.each(['yaml', 'json'] as const)(
    'exports parser-valid deterministic %s with an exact SHA-256 hash',
    async (format) => {
      const first = await exportArazzo(input(format))
      const reorderedGraph: FlowGraph = {
        ...graph,
        nodes: [...graph.nodes].reverse(),
        edges: [...graph.edges].reverse(),
      }
      const second = await exportArazzo(input(format, reorderedGraph))

      expect(first.diagnostics).toEqual([])
      expect(first.document?.arazzoVersion).toBe('1.1.0')
      expect(first.contents).toBe(second.contents)
      expect(first.contentHash).toBe(second.contentHash)
      expect(first.contentHash).toBe(
        createHash('sha256').update(first.contents, 'utf8').digest('hex'),
      )
      expect(first.contentHash).toMatch(/^[a-f0-9]{64}$/u)
      expect(first.contents.endsWith('\n')).toBe(true)

      const exported = format === 'json' ? JSON.parse(first.contents) : parseYaml(first.contents)
      expect(exported).toMatchObject({
        arazzo: '1.1.0',
        info: { title: 'Reservation workflow', version: '1.0.0' },
        sourceDescriptions: [{ name: 'reservationApi', url: './openapi.yaml', type: 'openapi' }],
        workflows: [
          {
            workflowId: 'createReservation',
            steps: [
              {
                stepId: 'create',
                operationId: 'createReservation',
                outputs: { id: '$response.body#/id' },
              },
              {
                stepId: 'get',
                operationId: 'getReservation',
                dependsOn: ['create'],
                parameters: [{ name: 'id', in: 'path', value: '$steps.create.outputs.id' }],
              },
            ],
          },
        ],
      })
    },
  )

  test('rejects source-description credentials before serialization', async () => {
    const artifact = await exportArazzo({
      ...input('yaml'),
      workflowPlan: {
        ...workflowPlan,
        sourceDescriptions: [
          {
            sourceId: openApiSource.sourceId,
            name: 'reservationApi',
            url: 'https://user:secret@example.com/openapi.yaml',
          },
        ],
      },
    })

    expect(artifact.document).toBeUndefined()
    expect(artifact.contents).toBe('')
    expect(artifact.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'ASF-EXP-1007', severity: 'error' }),
    )
  })
})
