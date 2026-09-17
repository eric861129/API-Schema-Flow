import { describe, expect, test } from 'vitest'

import type { ReviewCandidateRow } from '../review/review-selectors'
import {
  createReviewWorkspaceFixture,
  fixtureNode,
  fixtureOperation,
} from '../test/review-workspace-fixture'
import {
  buildCandidateConnections,
  focusNeighborhood,
  selectPreviewConnections,
} from './exploration-model'

const readOperation = {
  ...fixtureOperation,
  id: 'operation:get:/reservations/{id}',
  method: 'get' as const,
  path: '/reservations/{id}',
  operationId: 'getReservation',
}
const readNode = {
  ...fixtureNode,
  id: 'endpoint:read',
  operationKey: readOperation.id,
  method: readOperation.method,
  path: readOperation.path,
}
const graph = createReviewWorkspaceFixture({
  operations: [fixtureOperation, readOperation],
  nodes: [fixtureNode, readNode],
}).acceptedGraph
const candidate: ReviewCandidateRow = {
  id: 'candidate:id',
  sourceOperationKey: fixtureOperation.id,
  sourceLabel: 'POST /reservations',
  sourceSelector: '$response.body#/id',
  targetOperationKey: readOperation.id,
  targetLabel: 'GET /reservations/{id}',
  targetDescriptor: 'path.id',
  confidence: 0.95,
  band: 'high',
  evidenceCount: 2,
  blockerCount: 0,
  state: 'pending',
}

describe('exploration model', () => {
  test('groups pending field suggestions without treating accepted or rejected decisions as candidates', () => {
    const connections = buildCandidateConnections(
      [
        candidate,
        { ...candidate, id: 'candidate:token', confidence: 0.8 },
        { ...candidate, id: 'candidate:rejected', state: 'rejected' },
      ],
      graph,
    )
    expect(connections).toEqual([
      {
        id: candidate.id,
        sourceNodeId: fixtureNode.id,
        targetNodeId: readNode.id,
        count: 2,
        confidence: 0.95,
        evidenceCount: 2,
        blockerCount: 0,
      },
    ])
    expect(focusNeighborhood(graph, connections, fixtureNode.id)).toEqual(
      new Set([fixtureNode.id, readNode.id]),
    )
    expect(
      selectPreviewConnections(graph, [
        ...connections,
        {
          ...connections[0]!,
          id: 'candidate:reverse',
          sourceNodeId: readNode.id,
          targetNodeId: fixtureNode.id,
        },
      ]),
    ).toHaveLength(1)
  })
})
