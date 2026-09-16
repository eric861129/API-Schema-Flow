import type {
  EndpointFlowNode,
  FlowGraph,
  InferenceCandidate,
  ReviewDecision,
} from '@api-schema-flow/domain'
import { describe, expect, test } from 'vitest'

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

const candidate: InferenceCandidate = {
  schemaVersion: '1.0',
  id: 'candidate:browser-entry',
  fingerprint: 'browser-entry',
  ruleSetVersion: 'm2c-v1',
  sourceOperationNodeId: sourceNode.id,
  targetOperationNodeId: targetNode.id,
  sourceOperationKey: sourceNode.operationKey,
  targetOperationKey: targetNode.operationKey,
  mapping: {
    id: 'mapping:browser-entry',
    source: { kind: 'response-body', pointer: '#/id' },
    target: { kind: 'path-parameter', name: 'id' },
    aliases: [],
    sourcePointers: [],
  },
  score: 90,
  confidence: 0.9,
  band: 'high',
  evidence: [],
  blockers: [],
  provenance: 'inferred',
  status: 'candidate',
}

const graph: FlowGraph = {
  schemaVersion: '1.0',
  id: 'graph:operation-topology:api',
  kind: 'operation-topology',
  title: 'API',
  sourceIds: ['api'],
  nodes: [sourceNode, targetNode],
  edges: [],
}

function semanticDecision(): Omit<ReviewDecision, 'id' | 'decidedAt'> {
  return {
    schemaVersion: '1.0',
    candidateId: candidate.id,
    candidateFingerprint: candidate.fingerprint,
    ruleSetVersion: candidate.ruleSetVersion,
    revision: 1,
    action: 'accept',
  }
}

describe('browser Review entry', () => {
  test('exposes only the browser-safe runtime API', async () => {
    const browser = await import('@api-schema-flow/review/browser')

    expect(Object.keys(browser).sort()).toEqual(
      [
        'canonicalizeDecisionSet',
        'createReviewDecisionId',
        'materializeReviewedOperationGraph',
        'resolveReviewDecisions',
      ].sort(),
    )
    expect('parseReviewDecisionSet' in browser).toBe(false)
  })

  test('executes identity, canonicalization, resolution, and materialization', async () => {
    const browser = await import('@api-schema-flow/review/browser')
    const semantic = semanticDecision()
    const decision = { ...semantic, id: browser.createReviewDecisionId(semantic) }
    const decisionSet = browser.canonicalizeDecisionSet({
      schemaVersion: '1.0',
      revision: 1,
      decisions: [decision],
      manualEdges: [],
    })

    expect(browser.resolveReviewDecisions({ candidates: [candidate], decisionSet }).active).toEqual(
      [decision],
    )
    expect(
      browser.materializeReviewedOperationGraph({
        declaredOperationGraph: graph,
        candidates: [candidate],
        decisionSet,
      }),
    ).toMatchObject({
      graph: { edges: [expect.objectContaining({ provenance: 'inferred' })] },
      outcomes: [expect.objectContaining({ state: 'applied' })],
      diagnostics: [],
    })
  })
})
