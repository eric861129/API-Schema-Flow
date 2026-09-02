import type {
  FlowDataMapping,
  FlowEdgeKind,
  FlowValueSelector,
  FlowValueTarget,
  FlowValueTransform,
} from '@api-schema-flow/domain'

const FNV_OFFSET_BASIS = 0xcbf29ce484222325n
const FNV_PRIME = 0x100000001b3n
const FNV_MASK = 0xffffffffffffffffn

function normalizeCanonicalValue(value: unknown, seen: Set<object>): unknown {
  if (value === undefined) return undefined
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value))
      throw new TypeError('Canonical JSON does not support non-finite numbers.')
    return Object.is(value, -0) ? 0 : value
  }
  if (typeof value === 'bigint' || typeof value === 'function' || typeof value === 'symbol') {
    throw new TypeError(`Canonical JSON does not support ${typeof value} values.`)
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) throw new TypeError('Canonical JSON does not support circular values.')
    seen.add(value)
    const normalized = value.map((entry) => normalizeCanonicalValue(entry, seen) ?? null)
    seen.delete(value)
    return normalized
  }

  if (typeof value === 'object') {
    if (seen.has(value)) throw new TypeError('Canonical JSON does not support circular values.')
    seen.add(value)
    const normalized: Record<string, unknown> = {}
    for (const key of Object.keys(value).sort()) {
      const entry = normalizeCanonicalValue((value as Record<string, unknown>)[key], seen)
      if (entry !== undefined) normalized[key] = entry
    }
    seen.delete(value)
    return normalized
  }

  throw new TypeError('Canonical JSON received an unsupported value.')
}

export function canonicalizeJson(value: unknown): string {
  const normalized = normalizeCanonicalValue(value, new Set())
  const serialized = JSON.stringify(normalized)
  if (serialized === undefined) throw new TypeError('Canonical JSON root cannot be undefined.')
  return serialized
}

function stableHash(value: string): string {
  let hash = FNV_OFFSET_BASIS
  for (const character of value) {
    hash ^= BigInt(character.codePointAt(0) ?? 0)
    hash = (hash * FNV_PRIME) & FNV_MASK
  }
  return hash.toString(16).padStart(16, '0')
}

function nonEmpty(value: string, label: string): string {
  const normalized = value.trim()
  if (normalized.length === 0) throw new TypeError(`${label} must not be empty.`)
  return normalized
}

export function createEndpointNodeId(sourceId: string, operationKey: string): string {
  return `endpoint:${nonEmpty(sourceId, 'sourceId')}:${nonEmpty(operationKey, 'operationKey')}`
}

export function createWorkflowStepNodeId(
  sourceId: string,
  workflowId: string,
  stepId: string,
): string {
  return `workflow-step:${nonEmpty(sourceId, 'sourceId')}:${nonEmpty(workflowId, 'workflowId')}:${nonEmpty(stepId, 'stepId')}`
}

function mappingIdentity(mapping: FlowDataMapping): Readonly<Record<string, unknown>> {
  return {
    source: mapping.source,
    target: mapping.target,
    ...(mapping.transform === undefined ? {} : { transform: mapping.transform }),
  }
}

export function createMappingId(
  source: FlowValueSelector,
  target: FlowValueTarget,
  transform?: FlowValueTransform,
): string {
  return `mapping:${stableHash(canonicalizeJson({ source, target, ...(transform ? { transform } : {}) }))}`
}

export function createEdgeId(
  kind: FlowEdgeKind,
  sourceNodeId: string,
  targetNodeId: string,
  mappings: readonly FlowDataMapping[],
): string {
  const canonicalMappings = mappings
    .map(mappingIdentity)
    .map((mapping) => canonicalizeJson(mapping))
    .sort()
  return `edge:${kind}:${stableHash(
    canonicalizeJson({
      kind,
      sourceNodeId,
      targetNodeId,
      mappings: canonicalMappings,
    }),
  )}`
}

export function createOperationGraphId(sourceIds: readonly string[]): string {
  const values = [...new Set(sourceIds.map((value) => nonEmpty(value, 'sourceId')))].sort()
  return `graph:operation-topology:${values.length === 0 ? 'empty' : values.join(',')}`
}

export function createWorkflowGraphId(sourceId: string, workflowId: string): string {
  return `graph:workflow:${nonEmpty(sourceId, 'sourceId')}:${nonEmpty(workflowId, 'workflowId')}`
}
