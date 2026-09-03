import {
  ACCEPTED_FLOW_STATUS,
  FLOW_GRAPH_SCHEMA_VERSION,
  type FlowDataMapping,
  type FlowEdge,
  type InferenceCandidate,
  type ReviewDecision,
  type ReviewDecisionOutcome,
} from '@api-schema-flow/domain'
import { DIAGNOSTIC_CODES, sortDiagnostics, type Diagnostic } from '@api-schema-flow/diagnostics'
import { canonicalizeJson, createEdgeId, createMappingId } from '@api-schema-flow/flow'

import { canonicalMappingSemantics } from './canonical.js'
import type {
  MaterializeReviewedGraphInput,
  MaterializeReviewedGraphResult,
  ReviewMaterializationMetrics,
} from './contracts.js'
import { resolveReviewDecisions } from './decision-resolution.js'

function mappingKey(sourceNodeId: string, targetNodeId: string, mapping: FlowDataMapping): string {
  return canonicalizeJson({
    sourceNodeId,
    targetNodeId,
    mapping: canonicalMappingSemantics(mapping),
  })
}

function canonicalMapping(mapping: FlowDataMapping): FlowDataMapping {
  return {
    ...mapping,
    id: createMappingId(mapping.source, mapping.target, mapping.transform),
    aliases: [...mapping.aliases].sort((left, right) =>
      canonicalizeJson(left).localeCompare(canonicalizeJson(right)),
    ),
    sourcePointers: [...mapping.sourcePointers].sort((left, right) =>
      `${left.uri}${left.pointer}`.localeCompare(`${right.uri}${right.pointer}`),
    ),
  }
}

function acceptedEdge(
  decision: ReviewDecision,
  candidate: InferenceCandidate,
): FlowEdge | undefined {
  if (decision.action === 'reject') return undefined
  const mapping = canonicalMapping(
    decision.action === 'edit' ? decision.editedMapping! : candidate.mapping,
  )
  const provenance = decision.action === 'edit' ? 'manual' : 'inferred'
  return {
    id: createEdgeId('data', candidate.sourceOperationNodeId, candidate.targetOperationNodeId, [
      mapping,
    ]),
    kind: 'data',
    sourceNodeId: candidate.sourceOperationNodeId,
    targetNodeId: candidate.targetOperationNodeId,
    provenance,
    status: ACCEPTED_FLOW_STATUS,
    mappings: [mapping],
    sourceStandardRefs: [],
    review: {
      decisionId: decision.id,
      candidateId: candidate.id,
      candidateFingerprint: candidate.fingerprint,
      ruleSetVersion: candidate.ruleSetVersion,
      ...(decision.action === 'edit' ? { derivedFromCandidateId: candidate.id } : {}),
      evidenceRuleIds: [...new Set(candidate.evidence.map(({ ruleId }) => ruleId))].sort(),
    },
  }
}

function validateManualEdge(
  edge: FlowEdge,
  nodeIds: ReadonlySet<string>,
  diagnostics: Diagnostic[],
): boolean {
  if (
    edge.kind !== 'data' ||
    edge.provenance !== 'manual' ||
    edge.status !== 'accepted' ||
    edge.mappings.length === 0
  ) {
    diagnostics.push({
      code: DIAGNOSTIC_CODES.REVIEW_MANUAL_EDGE_INVALID,
      severity: 'error',
      message: `Manual edge "${edge.id}" must be an accepted data edge with at least one mapping.`,
      details: { edgeId: edge.id },
    })
    return false
  }
  for (const [endpoint, nodeId] of [
    ['source', edge.sourceNodeId],
    ['target', edge.targetNodeId],
  ] as const) {
    if (!nodeIds.has(nodeId)) {
      diagnostics.push({
        code: DIAGNOSTIC_CODES.REVIEW_GRAPH_NODE_MISSING,
        severity: 'error',
        message: `Manual edge "${edge.id}" references missing ${endpoint} node "${nodeId}".`,
        details: { edgeId: edge.id, nodeId, endpoint },
      })
      return false
    }
  }
  return true
}

function withEdgeId(edge: FlowEdge): FlowEdge {
  const mappings = edge.mappings.map(canonicalMapping)
  return {
    ...edge,
    id: createEdgeId(edge.kind, edge.sourceNodeId, edge.targetNodeId, mappings),
    mappings,
  }
}

function metrics(outcomes: readonly ReviewDecisionOutcome[]): ReviewMaterializationMetrics {
  const count = (state: ReviewDecisionOutcome['state']) =>
    outcomes.filter((outcome) => outcome.state === state).length
  return {
    appliedCount: count('applied'),
    rejectedCount: count('rejected'),
    staleCount: count('stale'),
    orphanedCount: count('orphaned'),
    supersededCount: count('superseded'),
    alreadyPresentCount: count('already-present'),
  }
}

export function materializeReviewedOperationGraph(
  input: MaterializeReviewedGraphInput,
): MaterializeReviewedGraphResult {
  const diagnostics: Diagnostic[] = []
  if (input.declaredOperationGraph.kind !== 'operation-topology') {
    diagnostics.push({
      code: DIAGNOSTIC_CODES.REVIEW_INPUT_INVALID,
      severity: 'error',
      message: 'Review materialization requires an operation-topology graph.',
      details: { graphId: input.declaredOperationGraph.id },
    })
  }

  const nodeIds = new Set(input.declaredOperationGraph.nodes.map(({ id }) => id))
  const graphEdges: FlowEdge[] = input.declaredOperationGraph.edges
    .filter(({ status }) => status === 'accepted')
    .map((edge) => edge)
  const existingMappings = new Set<string>()
  for (const edge of graphEdges) {
    for (const mapping of edge.mappings) {
      existingMappings.add(mappingKey(edge.sourceNodeId, edge.targetNodeId, mapping))
    }
  }

  for (const manual of [...input.decisionSet.manualEdges].sort((left, right) =>
    left.id.localeCompare(right.id),
  )) {
    if (!validateManualEdge(manual, nodeIds, diagnostics)) continue
    const normalized = withEdgeId(manual)
    const newMappings = normalized.mappings.filter(
      (mapping) =>
        !existingMappings.has(
          mappingKey(normalized.sourceNodeId, normalized.targetNodeId, mapping),
        ),
    )
    if (newMappings.length === 0) continue
    const edge = {
      ...normalized,
      id: createEdgeId(
        normalized.kind,
        normalized.sourceNodeId,
        normalized.targetNodeId,
        newMappings,
      ),
      mappings: newMappings,
    }
    graphEdges.push(edge)
    for (const mapping of newMappings) {
      existingMappings.add(mappingKey(edge.sourceNodeId, edge.targetNodeId, mapping))
    }
  }

  const resolved = resolveReviewDecisions(input)
  diagnostics.push(...resolved.diagnostics)
  const outcomes = [...resolved.outcomes]
  const candidates = new Map(input.candidates.map((candidate) => [candidate.id, candidate]))

  for (const decision of resolved.active) {
    if (decision.action === 'reject') {
      outcomes.push({
        decisionId: decision.id,
        candidateId: decision.candidateId,
        state: 'rejected',
      })
      continue
    }
    const candidate = candidates.get(decision.candidateId)!
    const edge = acceptedEdge(decision, candidate)!
    if (!nodeIds.has(edge.sourceNodeId) || !nodeIds.has(edge.targetNodeId)) {
      const nodeId = !nodeIds.has(edge.sourceNodeId) ? edge.sourceNodeId : edge.targetNodeId
      diagnostics.push({
        code: DIAGNOSTIC_CODES.REVIEW_GRAPH_NODE_MISSING,
        severity: 'error',
        message: `Review decision "${decision.id}" references missing graph node "${nodeId}".`,
        details: { decisionId: decision.id, nodeId },
      })
      outcomes.push({
        decisionId: decision.id,
        candidateId: decision.candidateId,
        state: 'invalid',
        reason: 'Candidate references a missing graph node.',
      })
      continue
    }
    const key = mappingKey(edge.sourceNodeId, edge.targetNodeId, edge.mappings[0]!)
    if (existingMappings.has(key)) {
      outcomes.push({
        decisionId: decision.id,
        candidateId: decision.candidateId,
        state: 'already-present',
      })
      continue
    }
    graphEdges.push(edge)
    existingMappings.add(key)
    outcomes.push({
      decisionId: decision.id,
      candidateId: decision.candidateId,
      state: 'applied',
      edgeId: edge.id,
    })
  }

  const sortedOutcomes = outcomes.sort(
    (left, right) =>
      left.candidateId.localeCompare(right.candidateId) ||
      left.decisionId.localeCompare(right.decisionId) ||
      left.state.localeCompare(right.state),
  )
  return {
    graph: {
      schemaVersion: FLOW_GRAPH_SCHEMA_VERSION,
      id: input.declaredOperationGraph.id,
      kind: input.declaredOperationGraph.kind,
      title: input.declaredOperationGraph.title,
      sourceIds: [...input.declaredOperationGraph.sourceIds].sort(),
      nodes: [...input.declaredOperationGraph.nodes].sort((left, right) =>
        left.id.localeCompare(right.id),
      ),
      edges: graphEdges.sort((left, right) => left.id.localeCompare(right.id)),
    },
    outcomes: sortedOutcomes,
    metrics: metrics(sortedOutcomes),
    diagnostics: sortDiagnostics(diagnostics),
  }
}
