import { describe, expect, test } from 'vitest'

import {
  assembleFlowGraph,
  createEdgeId,
  createMappingId,
  type AssembleFlowGraphInput,
} from '../../src/index.js'

const sourcePointer = { uri: 'memory://openapi', pointer: '#/paths/~1reservations/post' }
const targetPointer = { uri: 'memory://openapi', pointer: '#/paths/~1reservations~1{id}/get' }

const sourceNode = {
  kind: 'endpoint' as const,
  id: 'endpoint:api:operation:post:/reservations',
  sourceId: 'api',
  operationKey: 'operation:post:/reservations',
  method: 'post' as const,
  path: '/reservations',
  source: sourcePointer,
}

const targetNode = {
  kind: 'endpoint' as const,
  id: 'endpoint:api:operation:get:/reservations/{id}',
  sourceId: 'api',
  operationKey: 'operation:get:/reservations/{id}',
  method: 'get' as const,
  path: '/reservations/{id}',
  source: targetPointer,
}

const mappingId = createMappingId(
  { kind: 'response-body', pointer: '#/id' },
  { kind: 'path-parameter', name: 'id' },
)

const baseMapping = {
  id: mappingId,
  source: { kind: 'response-body' as const, pointer: '#/id' },
  target: { kind: 'path-parameter' as const, name: 'id' },
  aliases: [],
  sourcePointers: [sourcePointer],
}

const edgeId = createEdgeId('data', sourceNode.id, targetNode.id, [baseMapping])

function input(overrides: Partial<AssembleFlowGraphInput> = {}): AssembleFlowGraphInput {
  return {
    id: 'graph:operation-topology:api',
    kind: 'operation-topology',
    title: 'Operation topology',
    sourceIds: ['api'],
    nodes: [targetNode, sourceNode, sourceNode],
    edges: [
      {
        id: edgeId,
        kind: 'data',
        sourceNodeId: sourceNode.id,
        targetNodeId: targetNode.id,
        provenance: 'declared',
        status: 'accepted',
        mappings: [baseMapping],
        sourceStandardRefs: [{ standard: 'openapi-link', source: sourcePointer }],
      },
      {
        id: edgeId,
        kind: 'data',
        sourceNodeId: sourceNode.id,
        targetNodeId: targetNode.id,
        provenance: 'declared',
        status: 'accepted',
        mappings: [
          {
            ...baseMapping,
            aliases: [
              {
                kind: 'step-output',
                workflowId: 'reservation',
                stepId: 'create',
                outputName: 'reservationId',
              },
            ],
            sourcePointers: [targetPointer],
          },
        ],
        sourceStandardRefs: [{ standard: 'arazzo', source: targetPointer }],
      },
    ],
    ...overrides,
  }
}

describe('flow graph assembler', () => {
  test('merges duplicate nodes, edges, mappings, aliases, pointers, and standards', () => {
    const result = assembleFlowGraph(input())

    expect(result.diagnostics).toEqual([])
    expect(result.graph.nodes.map(({ id }) => id)).toEqual([sourceNode.id, targetNode.id])
    expect(result.graph.edges).toHaveLength(1)
    expect(result.graph.edges[0]?.sourceStandardRefs.map(({ standard }) => standard)).toEqual([
      'arazzo',
      'openapi-link',
    ])
    expect(result.graph.edges[0]?.mappings[0]?.aliases).toEqual([
      {
        kind: 'step-output',
        workflowId: 'reservation',
        stepId: 'create',
        outputName: 'reservationId',
      },
    ])
    expect(result.graph.edges[0]?.mappings[0]?.sourcePointers).toEqual([
      sourcePointer,
      targetPointer,
    ])
  })

  test('rejects non-declared or non-accepted edges instead of mutating them', () => {
    const candidate = {
      ...input().edges[0]!,
      provenance: 'inferred' as const,
      status: 'candidate' as const,
    }
    const result = assembleFlowGraph(input({ edges: [candidate] }))

    expect(result.graph.edges).toEqual([])
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: 'ASF-FLW-1008', severity: 'error' }),
    ])
  })

  test('diagnoses conflicting duplicate node identities', () => {
    const conflict = { ...sourceNode, path: '/different' }
    const result = assembleFlowGraph(input({ nodes: [sourceNode, conflict] }))

    expect(result.graph.nodes).toEqual([sourceNode])
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: 'ASF-FLW-1001', severity: 'error' }),
    ])
  })
})
