import { describe, expect, test } from 'vitest'

import type {
  EndpointFlowNode,
  FlowEdge,
  FlowGraph,
  InferenceCandidate,
  ReviewDecision,
} from '@api-schema-flow/domain'
import { createEdgeId, createMappingId } from '@api-schema-flow/flow'

import { createReviewDecisionId, materializeReviewedOperationGraph } from '../../src/index.js'

const sourceNode: EndpointFlowNode = {
  kind: 'endpoint',
  id: 'endpoint:api:operation:post:/reservations',
  sourceId: 'api',
  operationKey: 'operation:post:/reservations',
  operationId: 'createReservation',
  method: 'post',
  path: '/reservations',
  source: { uri: 'memory://api', pointer: '#/paths/~1reservations/post' },
}
const targetNode: EndpointFlowNode = {
  kind: 'endpoint',
  id: 'endpoint:api:operation:get:/reservations/{id}',
  sourceId: 'api',
  operationKey: 'operation:get:/reservations/{id}',
  operationId: 'getReservation',
  method: 'get',
  path: '/reservations/{id}',
  source: { uri: 'memory://api', pointer: '#/paths/~1reservations~1{id}/get' },
}
const mapping = {
  id: createMappingId(
    { kind: 'response-body' as const, pointer: '#/id' },
    { kind: 'path-parameter' as const, name: 'id' },
  ),
  source: { kind: 'response-body' as const, pointer: '#/id' },
  target: { kind: 'path-parameter' as const, name: 'id' },
  aliases: [],
  sourcePointers: [],
}
const candidate: InferenceCandidate = {
  schemaVersion: '1.0',
  id: 'candidate:abc',
  fingerprint: 'abc',
  ruleSetVersion: 'm2c-v1',
  sourceOperationNodeId: sourceNode.id,
  targetOperationNodeId: targetNode.id,
  sourceOperationKey: sourceNode.operationKey,
  targetOperationKey: targetNode.operationKey,
  mapping,
  score: 90,
  confidence: 0.95,
  band: 'high',
  evidence: [
    {
      ruleId: 'INF-RESOURCE-ID',
      kind: 'positive',
      weight: 25,
      message: 'Resource identifier matches.',
      sourcePointers: [],
    },
  ],
  blockers: [],
  provenance: 'inferred',
  status: 'candidate',
}

function graph(edges: FlowEdge[] = []): FlowGraph {
  return {
    schemaVersion: '1.0',
    id: 'graph:operation-topology:api',
    kind: 'operation-topology',
    title: 'API',
    sourceIds: ['api'],
    nodes: [sourceNode, targetNode],
    edges,
  }
}

function decision(
  action: 'accept' | 'reject' | 'edit',
  editedMapping = action === 'edit'
    ? {
        ...mapping,
        id: createMappingId(mapping.source, { kind: 'query-parameter', name: 'id' }),
        target: { kind: 'query-parameter' as const, name: 'id' },
      }
    : undefined,
): ReviewDecision {
  const semantic = {
    schemaVersion: '1.0' as const,
    candidateId: candidate.id,
    candidateFingerprint: candidate.fingerprint,
    ruleSetVersion: candidate.ruleSetVersion,
    revision: 1,
    action,
    ...(editedMapping === undefined ? {} : { editedMapping }),
  }
  return { ...semantic, id: createReviewDecisionId(semantic) }
}

function materialize(
  decisions: ReviewDecision[],
  declaredOperationGraph = graph(),
  manualEdges: FlowEdge[] = [],
) {
  return materializeReviewedOperationGraph({
    declaredOperationGraph,
    candidates: [candidate],
    decisionSet: { schemaVersion: '1.0', revision: 1, decisions, manualEdges },
  })
}

describe('reviewed graph materialization', () => {
  test('turns accept into an accepted inferred edge with review evidence', () => {
    const accepted = decision('accept')
    const result = materialize([accepted])
    expect(result.diagnostics).toEqual([])
    expect(result.graph.edges).toEqual([
      expect.objectContaining({
        provenance: 'inferred',
        status: 'accepted',
        review: expect.objectContaining({
          decisionId: accepted.id,
          candidateId: candidate.id,
          evidenceRuleIds: ['INF-RESOURCE-ID'],
        }),
      }),
    ])
    expect(result.outcomes).toContainEqual(expect.objectContaining({ state: 'applied' }))
  })

  test('turns edit into accepted manual edge and reject into no edge', () => {
    const edited = materialize([decision('edit')])
    expect(edited.graph.edges[0]).toMatchObject({
      provenance: 'manual',
      status: 'accepted',
      mappings: [expect.objectContaining({ target: { kind: 'query-parameter', name: 'id' } })],
      review: { derivedFromCandidateId: candidate.id },
    })

    const rejected = materialize([decision('reject')])
    expect(rejected.graph.edges).toEqual([])
    expect(rejected.outcomes).toContainEqual(expect.objectContaining({ state: 'rejected' }))
  })

  test('suppresses mappings already present in a declared edge', () => {
    const declared: FlowEdge = {
      id: createEdgeId('data', sourceNode.id, targetNode.id, [mapping]),
      kind: 'data',
      sourceNodeId: sourceNode.id,
      targetNodeId: targetNode.id,
      provenance: 'declared',
      status: 'accepted',
      mappings: [mapping],
      sourceStandardRefs: [],
    }
    const result = materialize([decision('accept')], graph([declared]))
    expect(result.graph.edges).toEqual([declared])
    expect(result.outcomes).toContainEqual(expect.objectContaining({ state: 'already-present' }))
  })

  test('validates manual edges and missing graph nodes', () => {
    const manual: FlowEdge = {
      id: 'edge:manual',
      kind: 'data',
      sourceNodeId: sourceNode.id,
      targetNodeId: 'missing',
      provenance: 'manual',
      status: 'accepted',
      mappings: [mapping],
      sourceStandardRefs: [],
    }
    const result = materialize([], graph(), [manual])
    expect(result.graph.edges).toEqual([])
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'ASF-REV-1007', severity: 'error' }),
    )
  })

  test('is deterministic across decision and manual-edge input ordering', () => {
    const accepted = decision('accept')
    const manual: FlowEdge = {
      id: createEdgeId('data', targetNode.id, sourceNode.id, [mapping]),
      kind: 'data',
      sourceNodeId: targetNode.id,
      targetNodeId: sourceNode.id,
      provenance: 'manual',
      status: 'accepted',
      mappings: [mapping],
      sourceStandardRefs: [],
    }
    const first = materialize([accepted], graph(), [manual])
    const second = materialize([accepted], graph(), [manual].reverse())
    expect(JSON.stringify(first.graph)).toBe(JSON.stringify(second.graph))
    expect(first.graph.edges.every(({ status }) => status === 'accepted')).toBe(true)
  })
})
