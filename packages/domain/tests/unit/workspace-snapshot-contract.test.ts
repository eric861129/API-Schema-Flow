import { describe, expect, test } from 'vitest'

import {
  FLOW_GRAPH_SCHEMA_VERSION,
  READ_ONLY_WORKSPACE_SNAPSHOT_SCHEMA_VERSION,
  isReadOnlyWorkspaceSnapshot,
  type ReadOnlyWorkspaceSnapshot,
} from '../../src/index.js'

const snapshot: ReadOnlyWorkspaceSnapshot = {
  schemaVersion: READ_ONLY_WORKSPACE_SNAPSHOT_SCHEMA_VERSION,
  generatedBy: {
    package: 'api-schema-flow',
    milestone: 'M3-A',
  },
  project: {
    name: 'Reservation System',
    sourceName: 'Reservation API',
    sourceUri: 'fixture://reservation/openapi.yaml',
    openapiVersion: '3.1.0',
  },
  apiDocument: {
    schemaVersion: '1.0',
    sourceUri: 'fixture://reservation/openapi.yaml',
    openapiVersion: '3.1.0',
    compatibilityMode: false,
    info: { title: 'Reservation API', version: '1.0.0' },
    tags: [],
    servers: [],
    operations: [],
    componentSchemas: [],
  },
  acceptedGraph: {
    schemaVersion: FLOW_GRAPH_SCHEMA_VERSION,
    id: 'graph:reservation',
    kind: 'operation-topology',
    title: 'Reservation API',
    sourceIds: ['reservation'],
    nodes: [],
    edges: [],
  },
  inferenceCandidates: [],
  reviewOutcomes: [],
  diagnostics: [],
}

describe('read-only workspace snapshot contract', () => {
  test('exposes version 1.0 and remains JSON serializable', () => {
    expect(READ_ONLY_WORKSPACE_SNAPSHOT_SCHEMA_VERSION).toBe('1.0')
    expect(JSON.parse(JSON.stringify(snapshot))).toEqual(snapshot)
    expect(isReadOnlyWorkspaceSnapshot(snapshot)).toBe(true)
  })

  test('rejects unsupported schema versions and malformed graph envelopes', () => {
    expect(isReadOnlyWorkspaceSnapshot({ ...snapshot, schemaVersion: '2.0' })).toBe(false)
    expect(
      isReadOnlyWorkspaceSnapshot({
        ...snapshot,
        acceptedGraph: { ...snapshot.acceptedGraph, nodes: undefined },
      }),
    ).toBe(false)
  })
})
