import { describe, expect, test } from 'vitest'
import type { FlowEdge } from '@api-schema-flow/domain'

import { createReviewWorkspaceFixture } from '../test/review-workspace-fixture'
import { fixtureOperation, fixtureNode } from '../test/review-workspace-fixture'
import {
  buildOperationViewModels,
  filterOperationViewModels,
  groupOperationViewModels,
} from './operation-view-model'

const snapshot = createReviewWorkspaceFixture()

describe('operation view model', () => {
  test('builds deterministic connection metadata and searches path, summary, and operation ID', () => {
    const models = buildOperationViewModels(snapshot)
    expect(models[0]).toMatchObject({ tag: 'Reservations', incoming: 0, outgoing: 0 })
    expect(
      filterOperationViewModels(models, { query: 'createReservation', methods: [] }),
    ).toHaveLength(1)
    expect(
      filterOperationViewModels(models, { query: 'reservation', methods: ['get'] }),
    ).toHaveLength(0)
  })

  test('narrows a large list by group and focused neighborhood while preserving text search', () => {
    const other = {
      ...fixtureOperation,
      id: 'operation:get:/spaces',
      path: '/spaces',
      method: 'get' as const,
      tags: ['Spaces'],
    }
    const otherNode = {
      ...fixtureNode,
      id: 'endpoint:spaces',
      operationKey: other.id,
      path: other.path,
      method: other.method,
    }
    const models = buildOperationViewModels(
      createReviewWorkspaceFixture({
        operations: [fixtureOperation, other],
        nodes: [fixtureNode, otherNode],
      }),
    )
    expect(filterOperationViewModels(models, { query: 'Spaces', methods: [] })).toHaveLength(1)
    expect(
      filterOperationViewModels(models, { query: '', methods: [], tag: 'Reservations' }),
    ).toHaveLength(1)
    expect(
      filterOperationViewModels(models, {
        query: '',
        methods: [],
        focusNodeIds: new Set([otherNode.id]),
      }),
    ).toMatchObject([{ nodeId: otherNode.id }])
  })

  test('counts a 1,311-endpoint graph and keeps all groups available', () => {
    const operations = Array.from({ length: 1_311 }, (_, index) => ({
      ...fixtureOperation,
      id: `operation:post:/items/${index}`,
      path: `/items/${index}`,
      tags: [`Group ${Math.floor(index / 50) + 1}`],
    }))
    const nodes = operations.map((operation) => ({
      ...fixtureNode,
      id: `endpoint:${operation.id}`,
      operationKey: operation.id,
    }))
    const edges: FlowEdge[] = nodes.slice(0, -1).map((node, index) => ({
      id: `edge:${index}`,
      kind: 'data',
      sourceNodeId: node.id,
      targetNodeId: nodes[index + 1]!.id,
      provenance: 'declared',
      status: 'accepted',
      mappings: [],
      sourceStandardRefs: [],
    }))
    const fixture = createReviewWorkspaceFixture({ operations, nodes })
    const models = buildOperationViewModels({
      ...fixture,
      acceptedGraph: { ...fixture.acceptedGraph, edges },
    })
    expect(models).toHaveLength(1_311)
    expect(groupOperationViewModels(models).size).toBe(27)
    expect(models.find((model) => model.nodeId === nodes[0]!.id)).toMatchObject({
      incoming: 0,
      outgoing: 1,
    })
    expect(models.find((model) => model.nodeId === nodes.at(-1)!.id)).toMatchObject({
      incoming: 1,
      outgoing: 0,
    })
    expect(
      filterOperationViewModels(models, { query: '', methods: [], tag: 'Group 1' }),
    ).toHaveLength(50)
  })

  test('finds operations without tags through the Untagged group', () => {
    const operation = { ...fixtureOperation, tags: [] }
    const models = buildOperationViewModels(
      createReviewWorkspaceFixture({ operations: [operation] }),
    )
    expect(
      filterOperationViewModels(models, { query: '', methods: [], tag: 'Untagged' }),
    ).toHaveLength(1)
  })
})
