import type { Diagnostic } from '@api-schema-flow/diagnostics'
import {
  FLOW_GRAPH_SCHEMA_VERSION,
  REVIEW_DECISION_SCHEMA_VERSION,
  REVIEW_WORKSPACE_SNAPSHOT_SCHEMA_VERSION,
  type EndpointFlowNode,
  type NormalizedOperation,
  type ReviewWorkspaceSnapshot,
} from '@api-schema-flow/domain'

const source = {
  uri: 'fixture://reservation/openapi.yaml',
  pointer: '#/paths/~1reservations/post',
} as const

export const fixtureOperation: NormalizedOperation = {
  id: 'operation:post:/reservations',
  method: 'post',
  path: '/reservations',
  operationId: 'createReservation',
  summary: 'Create reservation',
  tags: ['Reservations'],
  deprecated: false,
  parameters: [],
  responses: [],
  security: [],
  servers: [],
  source,
}

export const fixtureNode: EndpointFlowNode = {
  kind: 'endpoint',
  id: 'endpoint:fixture://reservation/openapi.yaml:operation:post:/reservations',
  sourceId: 'fixture://reservation/openapi.yaml',
  operationKey: fixtureOperation.id,
  method: fixtureOperation.method,
  path: fixtureOperation.path,
  operationId: 'createReservation',
  summary: 'Create reservation',
  source,
}

interface ReviewWorkspaceFixtureOptions {
  readonly operations?: readonly NormalizedOperation[]
  readonly nodes?: readonly EndpointFlowNode[]
}

export function createReviewWorkspaceFixture(
  options: ReviewWorkspaceFixtureOptions = {},
): ReviewWorkspaceSnapshot<Diagnostic> {
  const operations = options.operations ?? [fixtureOperation]
  const nodes = options.nodes ?? [fixtureNode]
  const graph = {
    schemaVersion: FLOW_GRAPH_SCHEMA_VERSION,
    id: 'graph:operation-topology:fixture://reservation/openapi.yaml',
    kind: 'operation-topology' as const,
    title: 'Reservation API topology',
    sourceIds: ['fixture://reservation/openapi.yaml'],
    nodes,
    edges: [],
  }

  return {
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
      info: {
        title: 'Reservation API',
        version: '1.0.0',
      },
      tags: ['Reservations'],
      servers: [],
      operations,
      componentSchemas: [],
    },
    declaredGraph: graph,
    acceptedGraph: graph,
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
}
