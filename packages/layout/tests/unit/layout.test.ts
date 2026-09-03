import { describe, expect, test } from 'vitest'

import type { FlowGraph } from '@api-schema-flow/domain'

import { createElkFlowLayoutEngine } from '../../src/index.js'

function graph(nodeIds: string[], pairs: Array<[string, string, string]> = []): FlowGraph {
  return {
    schemaVersion: '1.0',
    id: 'graph:test',
    kind: 'operation-topology',
    title: 'Test graph',
    sourceIds: ['test'],
    nodes: nodeIds.map((id) => ({
      kind: 'endpoint',
      id,
      operationKey: id,
      source: { uri: 'fixture://test', pointer: '#/paths' },
    })),
    edges: pairs.map(([id, sourceNodeId, targetNodeId]) => ({
      id,
      kind: 'data',
      sourceNodeId,
      targetNodeId,
      provenance: 'declared',
      status: 'accepted',
      mappings: [],
      sourceStandardRefs: [],
    })),
  }
}

describe('ELK flow layout', () => {
  test('returns a valid empty layout', async () => {
    const result = await createElkFlowLayoutEngine().layout(graph([]))
    expect(result).toEqual({ graphId: 'graph:test', width: 0, height: 0, nodes: [], edges: [] })
  })

  test('lays out a directed graph deterministically regardless of input order', async () => {
    const engine = createElkFlowLayoutEngine()
    const first = await engine.layout(
      graph(
        ['b', 'a', 'c'],
        [
          ['e2', 'b', 'c'],
          ['e1', 'a', 'b'],
        ],
      ),
    )
    const second = await engine.layout(
      graph(
        ['c', 'b', 'a'],
        [
          ['e1', 'a', 'b'],
          ['e2', 'b', 'c'],
        ],
      ),
    )
    expect(first).toEqual(second)
    expect(first.nodes.map((node) => node.id)).toEqual(['a', 'b', 'c'])
    expect(first.nodes.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y))).toBe(
      true,
    )
  })

  test('supports down layout and cycles without throwing', async () => {
    const result = await createElkFlowLayoutEngine().layout(
      graph(
        ['a', 'b'],
        [
          ['ab', 'a', 'b'],
          ['ba', 'b', 'a'],
        ],
      ),
      { direction: 'down' },
    )
    expect(result.nodes).toHaveLength(2)
    expect(result.edges).toHaveLength(2)
  })
})
