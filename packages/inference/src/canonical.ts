import type { FlowGraph, FlowValueSelector, FlowValueTarget } from '@api-schema-flow/domain'
import { canonicalizeJson } from '@api-schema-flow/flow'

import { INFERENCE_RULE_SET_VERSION } from './config.js'
import type { InferenceSourceField, InferenceTargetField } from './contracts.js'

const FNV_OFFSET_BASIS = 0xcbf29ce484222325n
const FNV_PRIME = 0x100000001b3n
const FNV_MASK = 0xffffffffffffffffn

function stableHash(value: string): string {
  let hash = FNV_OFFSET_BASIS
  for (const character of value) {
    hash ^= BigInt(character.codePointAt(0) ?? 0)
    hash = (hash * FNV_PRIME) & FNV_MASK
  }
  return hash.toString(16).padStart(16, '0')
}

function schemaFingerprint(field: InferenceSourceField | InferenceTargetField): string {
  return stableHash(
    canonicalizeJson({
      schemaTypes: field.schemaTypes,
      format: field.format ?? null,
      arrayDepth: field.arrayDepth,
      variant: field.variant,
      readOnly: field.readOnly,
      writeOnly: field.writeOnly,
    }),
  )
}

export function createInferenceFingerprint(
  source: InferenceSourceField,
  target: InferenceTargetField,
  selector: FlowValueSelector,
  valueTarget: FlowValueTarget,
): string {
  return stableHash(
    canonicalizeJson({
      ruleSetVersion: INFERENCE_RULE_SET_VERSION,
      sourceOperationNodeId: source.operationNodeId,
      targetOperationNodeId: target.operationNodeId,
      selector,
      target: valueTarget,
      sourceSchemaFingerprint: schemaFingerprint(source),
      targetSchemaFingerprint: schemaFingerprint(target),
    }),
  )
}

export function createInferenceCandidateId(fingerprint: string): string {
  return `candidate:${fingerprint}`
}

export function inferenceInputFingerprint(graph: FlowGraph): string {
  return stableHash(
    canonicalizeJson({
      schemaVersion: graph.schemaVersion,
      id: graph.id,
      nodes: graph.nodes.map(({ id }) => id),
      declaredMappings: graph.edges
        .filter(({ kind, provenance }) => kind === 'data' && provenance === 'declared')
        .map(({ id }) => id),
    }),
  )
}
