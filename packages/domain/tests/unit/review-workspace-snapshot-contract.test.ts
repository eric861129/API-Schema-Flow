import { describe, expect, test } from 'vitest'

import {
  FLOW_GRAPH_SCHEMA_VERSION,
  READ_ONLY_WORKSPACE_SNAPSHOT_SCHEMA_VERSION,
  REVIEW_DECISION_SCHEMA_VERSION,
  REVIEW_WORKSPACE_SNAPSHOT_SCHEMA_VERSION,
  isReadOnlyWorkspaceSnapshot,
  isReviewWorkspaceSnapshot,
  type FlowGraph,
  type ReadOnlyWorkspaceSnapshot,
  type ReviewWorkspaceSnapshot,
} from '../../src/index.js'

const declaredGraph: FlowGraph = {
  schemaVersion: FLOW_GRAPH_SCHEMA_VERSION,
  id: 'graph:reservation:declared',
  kind: 'operation-topology',
  title: 'Reservation API declared topology',
  sourceIds: ['fixture://reservation/openapi.yaml'],
  nodes: [],
  edges: [],
}

const snapshot: ReviewWorkspaceSnapshot = {
  schemaVersion: REVIEW_WORKSPACE_SNAPSHOT_SCHEMA_VERSION,
  generatedBy: {
    package: 'api-schema-flow',
    milestone: 'M3-B1',
  },
  project: {
    name: 'Reservation System',
    sourceName: 'Reservation API',
    sourceUri: 'fixture://reservation/openapi.yaml',
    openapiVersion: '3.1.0',
  },
  reviewContext: {
    projectFingerprint: 'project:reservation:v1',
    sourceRevision: 'source:reservation:openapi:v1',
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
  declaredGraph,
  acceptedGraph: {
    ...declaredGraph,
    id: 'graph:reservation:accepted',
    title: 'Reservation API accepted topology',
  },
  inferenceCandidates: [],
  reviewDecisionSet: {
    schemaVersion: REVIEW_DECISION_SCHEMA_VERSION,
    revision: 0,
    decisions: [],
    manualEdges: [],
  },
  reviewOutcomes: [],
  diagnostics: [],
}

const readOnlySnapshot: ReadOnlyWorkspaceSnapshot = {
  schemaVersion: READ_ONLY_WORKSPACE_SNAPSHOT_SCHEMA_VERSION,
  generatedBy: {
    package: 'api-schema-flow',
    milestone: 'M3-A',
  },
  project: snapshot.project,
  apiDocument: snapshot.apiDocument,
  acceptedGraph: snapshot.acceptedGraph,
  inferenceCandidates: [],
  reviewOutcomes: [],
  diagnostics: [],
}

function withoutProperty(value: object, property: string): Record<string, unknown> {
  const copy = { ...value } as Record<string, unknown>
  delete copy[property]
  return copy
}

describe('review workspace snapshot contract', () => {
  test('accepts a complete version 1.1 review workspace snapshot without mutating it', () => {
    const before = JSON.stringify(snapshot)

    expect(REVIEW_WORKSPACE_SNAPSHOT_SCHEMA_VERSION).toBe('1.1')
    expect(isReviewWorkspaceSnapshot(snapshot)).toBe(true)
    expect(snapshot.schemaVersion).toBe('1.1')
    expect(snapshot.generatedBy.milestone).toBe('M3-B1')
    expect(JSON.stringify(snapshot)).toBe(before)
    expect(JSON.parse(before)).toEqual(snapshot)
  })

  test('keeps snapshot 1.0 and review snapshot 1.1 as distinct contracts', () => {
    expect(isReadOnlyWorkspaceSnapshot(readOnlySnapshot)).toBe(true)
    expect(isReadOnlyWorkspaceSnapshot(snapshot)).toBe(false)
    expect(isReviewWorkspaceSnapshot(readOnlySnapshot)).toBe(false)
  })

  test.each([
    ['unsupported schema version', { ...snapshot, schemaVersion: '1.2' }],
    [
      'wrong generator package',
      { ...snapshot, generatedBy: { package: 'other-package', milestone: 'M3-B1' } },
    ],
    [
      'wrong generator milestone',
      { ...snapshot, generatedBy: { package: 'api-schema-flow', milestone: 'M3-B2' } },
    ],
    ['missing review context', withoutProperty(snapshot, 'reviewContext')],
    [
      'empty project fingerprint',
      { ...snapshot, reviewContext: { ...snapshot.reviewContext, projectFingerprint: '' } },
    ],
    [
      'empty source revision',
      { ...snapshot, reviewContext: { ...snapshot.reviewContext, sourceRevision: '' } },
    ],
    ['missing declared graph', withoutProperty(snapshot, 'declaredGraph')],
    [
      'wrong declared graph schema version',
      { ...snapshot, declaredGraph: { ...snapshot.declaredGraph, schemaVersion: '2.0' } },
    ],
    [
      'non-operation declared graph',
      { ...snapshot, declaredGraph: { ...snapshot.declaredGraph, kind: 'workflow-instance' } },
    ],
    [
      'declared graph without node array',
      { ...snapshot, declaredGraph: { ...snapshot.declaredGraph, nodes: {} } },
    ],
    [
      'non-operation accepted graph',
      { ...snapshot, acceptedGraph: { ...snapshot.acceptedGraph, kind: 'workflow-instance' } },
    ],
    [
      'accepted graph without edge array',
      { ...snapshot, acceptedGraph: { ...snapshot.acceptedGraph, edges: {} } },
    ],
    ['missing review decision set', withoutProperty(snapshot, 'reviewDecisionSet')],
    [
      'wrong review decision set version',
      { ...snapshot, reviewDecisionSet: { ...snapshot.reviewDecisionSet, schemaVersion: '2.0' } },
    ],
    [
      'invalid review decision set revision',
      { ...snapshot, reviewDecisionSet: { ...snapshot.reviewDecisionSet, revision: -1 } },
    ],
    [
      'non-array decisions',
      { ...snapshot, reviewDecisionSet: { ...snapshot.reviewDecisionSet, decisions: {} } },
    ],
    [
      'non-array manual edges',
      { ...snapshot, reviewDecisionSet: { ...snapshot.reviewDecisionSet, manualEdges: {} } },
    ],
    ['missing candidates', withoutProperty(snapshot, 'inferenceCandidates')],
    ['missing outcomes', withoutProperty(snapshot, 'reviewOutcomes')],
    ['missing diagnostics', withoutProperty(snapshot, 'diagnostics')],
  ])('rejects %s', (_label, value) => {
    expect(isReviewWorkspaceSnapshot(value)).toBe(false)
  })
})
