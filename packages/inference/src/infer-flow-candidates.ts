import {
  CANDIDATE_FLOW_STATUS,
  INFERENCE_SCHEMA_VERSION,
  INFERRED_FLOW_PROVENANCE,
  type EndpointFlowNode,
  type FlowDataMapping,
  type InferenceCandidate,
  type InferenceReport,
} from '@api-schema-flow/domain'
import { DIAGNOSTIC_CODES, sortDiagnostics, type Diagnostic } from '@api-schema-flow/diagnostics'
import { canonicalizeJson, createMappingId } from '@api-schema-flow/flow'

import { createInferenceCandidateId, createInferenceFingerprint } from './canonical.js'
import {
  DEFAULT_INFERENCE_CONFIG,
  INFERENCE_RULE_SET_VERSION,
  resolveInferenceConfig,
} from './config.js'
import type {
  InferFlowCandidatesInput,
  InferenceOperationIndex,
  InferencePair,
  InferenceSourceField,
  InferenceTargetField,
} from './contracts.js'
import { createDeclaredMappingIndex, isDeclaredMapping } from './declared-suppression.js'
import {
  evaluateEvidenceRules,
  evaluateHardConstraints,
  evidenceScore,
  genericOnlyEvidence,
  plausibleInferencePair,
} from './rules.js'
import { extractOperationSourceFields, extractOperationTargetFields } from './schema-fields.js'
import { confidenceBand, confidenceForScore } from './scoring.js'

function endpointNodeMap(input: InferFlowCandidatesInput): Map<string, EndpointFlowNode> {
  return new Map(
    input.declaredOperationGraph.nodes.flatMap((node) =>
      node.kind === 'endpoint'
        ? [[`${node.sourceId}\u0000${node.operationKey}`, node] as const]
        : [],
    ),
  )
}

function buildOperationIndex(
  input: InferFlowCandidatesInput,
  config: typeof DEFAULT_INFERENCE_CONFIG,
): InferenceOperationIndex {
  const diagnostics: Diagnostic[] = []
  const sourceFields: InferenceSourceField[] = []
  const targetFields: InferenceTargetField[] = []
  const nodes = endpointNodeMap(input)

  for (const source of [...input.openApiSources].sort((left, right) =>
    left.sourceId.localeCompare(right.sourceId),
  )) {
    for (const operation of [...source.document.operations].sort((left, right) =>
      left.id.localeCompare(right.id),
    )) {
      const node = nodes.get(`${source.sourceId}\u0000${operation.id}`)
      if (node === undefined) {
        diagnostics.push({
          code: DIAGNOSTIC_CODES.INFERENCE_OPERATION_BINDING_MISSING,
          severity: 'error',
          message: `Inference could not bind operation "${operation.id}" to an endpoint node.`,
          source: operation.source,
          details: { sourceId: source.sourceId, operationKey: operation.id },
        })
        continue
      }
      const sources = extractOperationSourceFields(source.sourceId, node, operation, config)
      const targets = extractOperationTargetFields(source.sourceId, node, operation, config)
      sourceFields.push(...sources.fields)
      targetFields.push(...targets.fields)
      diagnostics.push(...sources.diagnostics, ...targets.diagnostics)
    }
  }

  return {
    sourceFields: sourceFields.sort(fieldOrder),
    targetFields: targetFields.sort(fieldOrder),
    diagnostics: sortDiagnostics(diagnostics),
  }
}

function fieldOrder(
  left: InferenceSourceField | InferenceTargetField,
  right: InferenceSourceField | InferenceTargetField,
): number {
  const leftValue =
    'selector' in left ? canonicalizeJson(left.selector) : canonicalizeJson(left.target)
  const rightValue =
    'selector' in right ? canonicalizeJson(right.selector) : canonicalizeJson(right.target)
  return (
    left.operationNodeId.localeCompare(right.operationNodeId) ||
    leftValue.localeCompare(rightValue) ||
    left.sourcePointer.pointer.localeCompare(right.sourcePointer.pointer)
  )
}

function candidateOrder(left: InferenceCandidate, right: InferenceCandidate): number {
  return (
    right.confidence - left.confidence ||
    right.score - left.score ||
    left.targetOperationNodeId.localeCompare(right.targetOperationNodeId) ||
    left.mapping.id.localeCompare(right.mapping.id) ||
    left.sourceOperationNodeId.localeCompare(right.sourceOperationNodeId) ||
    left.id.localeCompare(right.id)
  )
}

function mappingForPair(pair: InferencePair): FlowDataMapping {
  const id = createMappingId(pair.source.selector, pair.target.target)
  const pointers = new Map(
    [pair.source.sourcePointer, pair.target.sourcePointer].map(
      (pointer) => [`${pointer.uri}\u0000${pointer.pointer}`, pointer] as const,
    ),
  )
  return {
    id,
    source: pair.source.selector,
    target: pair.target.target,
    aliases: [],
    sourcePointers: [...pointers.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([, pointer]) => pointer),
  }
}

function emptyReport(
  diagnostics: readonly Diagnostic[],
  elapsedMs = 0,
): InferenceReport<Diagnostic> {
  return {
    schemaVersion: INFERENCE_SCHEMA_VERSION,
    ruleSetVersion: INFERENCE_RULE_SET_VERSION,
    candidates: [],
    metrics: {
      sourceFieldCount: 0,
      targetFieldCount: 0,
      generatedPairCount: 0,
      blockedPairCount: 0,
      suppressedDeclaredCount: 0,
      emittedCandidateCount: 0,
      highConfidenceCount: 0,
      mediumConfidenceCount: 0,
      lowConfidenceCount: 0,
      truncated: false,
      elapsedMs,
    },
    diagnostics: sortDiagnostics(diagnostics),
  }
}

function validateInput(input: InferFlowCandidatesInput): readonly Diagnostic[] {
  if (input.declaredOperationGraph.kind === 'operation-topology') return []
  return [
    {
      code: DIAGNOSTIC_CODES.INFERENCE_INPUT_INVALID,
      severity: 'error',
      message: 'Inference requires an operation-topology graph.',
      details: { graphKind: input.declaredOperationGraph.kind },
    },
  ]
}

function applyTopK(candidates: readonly InferenceCandidate[], topK: number): InferenceCandidate[] {
  const counts = new Map<string, number>()
  const result: InferenceCandidate[] = []
  for (const candidate of [...candidates].sort(candidateOrder)) {
    const key = `${candidate.targetOperationNodeId}\u0000${canonicalizeJson(
      candidate.mapping.target,
    )}`
    const count = counts.get(key) ?? 0
    if (count >= topK) continue
    counts.set(key, count + 1)
    result.push(candidate)
  }
  return result
}

export function inferFlowCandidates(input: InferFlowCandidatesInput): InferenceReport<Diagnostic> {
  const startedAt = Date.now()
  const inputDiagnostics = validateInput(input)
  if (inputDiagnostics.length > 0) return emptyReport(inputDiagnostics)

  const resolved = resolveInferenceConfig(input.config)
  if (resolved.config === undefined) return emptyReport(resolved.diagnostics)
  const config = resolved.config
  const index = buildOperationIndex(input, config)
  const diagnostics: Diagnostic[] = [...index.diagnostics]
  const declaredMappings = createDeclaredMappingIndex(input.declaredOperationGraph)
  const candidates: InferenceCandidate[] = []
  let generatedPairCount = 0
  let blockedPairCount = 0
  let suppressedDeclaredCount = 0
  let truncated = false
  let timedOut = false

  outer: for (const source of index.sourceFields) {
    for (const target of index.targetFields) {
      const pair: InferencePair = { source, target }
      if (!plausibleInferencePair(pair)) continue
      if (generatedPairCount >= config.maxPairs) {
        truncated = true
        diagnostics.push({
          code: DIAGNOSTIC_CODES.INFERENCE_PAIR_LIMIT,
          severity: 'warning',
          message: 'Inference candidate-pair limit was reached.',
          details: { maxPairs: config.maxPairs },
        })
        break outer
      }
      if (Date.now() - startedAt >= config.maxElapsedMs) {
        truncated = true
        timedOut = true
        diagnostics.push({
          code: DIAGNOSTIC_CODES.INFERENCE_TIME_LIMIT,
          severity: 'warning',
          message: 'Inference time budget was reached.',
          details: { maxElapsedMs: config.maxElapsedMs },
        })
        break outer
      }
      generatedPairCount += 1

      const mapping = mappingForPair(pair)
      if (
        isDeclaredMapping(
          declaredMappings,
          source.operationNodeId,
          target.operationNodeId,
          mapping.source,
          mapping.target,
        )
      ) {
        suppressedDeclaredCount += 1
        continue
      }

      const blockers = evaluateHardConstraints(pair, input.declaredOperationGraph)
      if (blockers.length > 0) {
        blockedPairCount += 1
        continue
      }

      try {
        const evidence = evaluateEvidenceRules(pair)
        const score = evidenceScore(evidence)
        const confidence = confidenceForScore(score, {
          genericOnly: genericOnlyEvidence(evidence),
        })
        const band = confidenceBand(confidence)
        if (band === undefined || confidence < config.minimumConfidence) continue
        if (band === 'low' && !config.includeLowConfidence) continue

        const fingerprint = createInferenceFingerprint(
          source,
          target,
          mapping.source,
          mapping.target,
        )
        candidates.push({
          schemaVersion: INFERENCE_SCHEMA_VERSION,
          id: createInferenceCandidateId(fingerprint),
          fingerprint,
          ruleSetVersion: INFERENCE_RULE_SET_VERSION,
          sourceOperationNodeId: source.operationNodeId,
          targetOperationNodeId: target.operationNodeId,
          sourceOperationKey: source.operationKey,
          targetOperationKey: target.operationKey,
          mapping,
          score,
          confidence,
          band,
          evidence,
          blockers: [],
          provenance: INFERRED_FLOW_PROVENANCE,
          status: CANDIDATE_FLOW_STATUS,
        })
      } catch (error) {
        diagnostics.push({
          code: DIAGNOSTIC_CODES.INFERENCE_RULE_FAILED,
          severity: 'warning',
          message: 'An inference rule failed and the pair was skipped.',
          source: source.sourcePointer,
          details: {
            sourceOperationKey: source.operationKey,
            targetOperationKey: target.operationKey,
            reason: error instanceof Error ? error.message : String(error),
          },
        })
      }
    }
  }

  const ranked = applyTopK(candidates, config.topKPerTarget)
  const limited = ranked.slice(0, config.maxCandidates)
  if (ranked.length > limited.length) {
    truncated = true
    diagnostics.push({
      code: DIAGNOSTIC_CODES.INFERENCE_CANDIDATE_LIMIT,
      severity: 'warning',
      message: 'Inference candidate output limit was reached.',
      details: { maxCandidates: config.maxCandidates },
    })
  }

  const highConfidenceCount = limited.filter(({ band }) => band === 'high').length
  const mediumConfidenceCount = limited.filter(({ band }) => band === 'medium').length
  const lowConfidenceCount = limited.filter(({ band }) => band === 'low').length

  return {
    schemaVersion: INFERENCE_SCHEMA_VERSION,
    ruleSetVersion: INFERENCE_RULE_SET_VERSION,
    candidates: limited,
    metrics: {
      sourceFieldCount: index.sourceFields.length,
      targetFieldCount: index.targetFields.length,
      generatedPairCount,
      blockedPairCount,
      suppressedDeclaredCount,
      emittedCandidateCount: limited.length,
      highConfidenceCount,
      mediumConfidenceCount,
      lowConfidenceCount,
      truncated,
      elapsedMs: timedOut ? config.maxElapsedMs : Date.now() - startedAt,
    },
    diagnostics: sortDiagnostics(diagnostics),
  }
}
