import { describe, expect, test } from 'vitest'

import { buildOperationViewModels, filterOperationViewModels } from './operation-view-model'
import type { WorkspaceSnapshot } from '../data/types'

const snapshot = {
  apiDocument: {
    operations: [
      {
        id: 'operation:post:/reservations',
        method: 'post',
        path: '/reservations',
        operationId: 'createReservation',
        summary: 'Create reservation',
        tags: ['Reservations'],
        parameters: [],
        responses: [],
        security: [],
        source: { uri: 'fixture://test', pointer: '#/paths' },
      },
    ],
  },
  acceptedGraph: {
    id: 'graph',
    nodes: [
      {
        kind: 'endpoint',
        id: 'operation:post:/reservations',
        operationKey: 'operation:post:/reservations',
        source: { uri: 'fixture://test', pointer: '#/paths' },
      },
    ],
    edges: [],
  },
  schemaVersion: '1.0',
  project: {
    name: 'Test',
    sourceName: 'Test',
    sourceUri: 'fixture://test',
    openapiVersion: '3.1.0',
  },
  inferenceCandidates: [],
  reviewOutcomes: [],
  diagnostics: [],
} satisfies WorkspaceSnapshot

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
})
