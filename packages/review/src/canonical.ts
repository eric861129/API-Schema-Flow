import type { FlowDataMapping, ReviewDecision, ReviewDecisionSet } from '@api-schema-flow/domain'
import { canonicalizeJson } from '@api-schema-flow/flow'

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

export function canonicalMappingSemantics(mapping: FlowDataMapping | undefined): unknown {
  if (mapping === undefined) return undefined
  return {
    source: mapping.source,
    target: mapping.target,
    ...(mapping.transform === undefined ? {} : { transform: mapping.transform }),
  }
}

export function createReviewDecisionId(
  input: Omit<ReviewDecision, 'id' | 'decidedAt'> & { readonly decidedAt?: string },
): string {
  return `decision:${stableHash(
    canonicalizeJson({
      schemaVersion: input.schemaVersion,
      candidateId: input.candidateId,
      candidateFingerprint: input.candidateFingerprint,
      ruleSetVersion: input.ruleSetVersion,
      revision: input.revision,
      action: input.action,
      ...(input.editedMapping === undefined
        ? {}
        : { editedMapping: canonicalMappingSemantics(input.editedMapping) }),
    }),
  )}`
}

export function canonicalizeDecisionSet(input: ReviewDecisionSet): ReviewDecisionSet {
  return {
    schemaVersion: input.schemaVersion,
    revision: input.revision,
    decisions: [...input.decisions].sort(
      (left, right) =>
        left.candidateId.localeCompare(right.candidateId) ||
        left.revision - right.revision ||
        left.id.localeCompare(right.id),
    ),
    manualEdges: [...input.manualEdges].sort((left, right) => left.id.localeCompare(right.id)),
  }
}
