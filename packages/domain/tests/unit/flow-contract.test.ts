import { describe, expect, test } from 'vitest'

import {
  ACCEPTED_FLOW_STATUS,
  DECLARED_FLOW_PROVENANCE,
  FLOW_GRAPH_SCHEMA_VERSION,
  type EndpointFlowNode,
  type FlowDataMapping,
  type FlowEdge,
  type FlowGraph,
  type WorkflowStepFlowNode,
} from '../../src/index.js'

const endpoint: EndpointFlowNode = {
  kind: 'endpoint',
  id: 'endpoint:reservationApi:operation:post:/reservations',
  sourceId: 'reservationApi',
  operationKey: 'operation:post:/reservations',
  method: 'post',
  path: '/reservations',
  operationId: 'createReservation',
  source: { uri: 'memory://openapi', pointer: '#/paths/~1reservations/post' },
}

const step: WorkflowStepFlowNode = {
  kind: 'workflow-step',
  id: 'workflow-step:reservationWorkflow:createReservation:create',
  sourceId: 'reservationWorkflow',
  workflowId: 'createReservation',
  stepId: 'create',
  operationKey: 'operation:post:/reservations',
  source: { uri: 'memory://arazzo', pointer: '#/workflows/0/steps/0' },
}

const mapping: FlowDataMapping = {
  id: 'mapping:response-body:#/id->path-parameter:id',
  source: { kind: 'response-body', pointer: '#/id' },
  target: { kind: 'path-parameter', name: 'id' },
  aliases: [],
  sourcePointers: [],
}

const edge: FlowEdge = {
  id: 'edge:data:a:b:mapping',
  kind: 'data',
  sourceNodeId: endpoint.id,
  targetNodeId: step.id,
  provenance: DECLARED_FLOW_PROVENANCE,
  status: ACCEPTED_FLOW_STATUS,
  mappings: [mapping],
  sourceStandardRefs: [],
}

const graph: FlowGraph = {
  schemaVersion: FLOW_GRAPH_SCHEMA_VERSION,
  id: 'graph:operation-topology:reservationApi',
  kind: 'operation-topology',
  title: 'Operation topology',
  sourceIds: ['reservationApi'],
  nodes: [endpoint],
  edges: [edge],
}

describe('flow domain contracts', () => {
  test('expose stable declared graph constants', () => {
    expect(FLOW_GRAPH_SCHEMA_VERSION).toBe('1.0')
    expect(DECLARED_FLOW_PROVENANCE).toBe('declared')
    expect(ACCEPTED_FLOW_STATUS).toBe('accepted')
  })

  test('remain plain serializable values', () => {
    expect(JSON.parse(JSON.stringify({ endpoint, step, graph }))).toEqual({ endpoint, step, graph })
  })

  test('model declared accepted data mappings without parser types', () => {
    expect(edge).toMatchObject({
      kind: 'data',
      provenance: 'declared',
      status: 'accepted',
    })
  })
})
