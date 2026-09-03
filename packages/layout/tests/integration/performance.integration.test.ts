import { expect, test } from 'vitest'

import type { FlowGraph } from '@api-schema-flow/domain'

import { createElkFlowLayoutEngine } from '../../src/index.js'

test('lays out 500 nodes within the M3-A performance budget', async () => {
  const nodeIds = Array.from({ length: 500 }, (_, index) => 'operation:get:/items/' + index)
  const graph: FlowGraph = {
    schemaVersion: '1.0',
    id: 'graph:performance',
    kind: 'operation-topology',
    title: 'Performance graph',
    sourceIds: ['synthetic'],
    nodes: nodeIds.map((id) => ({
      kind: 'endpoint',
      id,
      operationKey: id,
      source: { uri: 'fixture://performance', pointer: '#/paths' },
    })),
    edges: nodeIds.slice(1).map((targetNodeId, index) => ({
      id: 'edge:' + index,
      kind: 'data',
      sourceNodeId: nodeIds[index] ?? nodeIds[0] ?? '',
      targetNodeId,
      provenance: 'declared',
      status: 'accepted',
      mappings: [],
      sourceStandardRefs: [],
    })),
  }
  const started = performance.now()
  const result = await createElkFlowLayoutEngine().layout(graph)
  expect(result.nodes).toHaveLength(500)
  expect(performance.now() - started).toBeLessThan(5_000)
}, 10_000)
