import type { FlowGraph, InferenceEvidence, SourcePointer } from '@api-schema-flow/domain'

import type { InferencePair } from './contracts.js'
import { wouldCreateDeclaredCycle } from './topology.js'

function evidence(
  ruleId: string,
  kind: InferenceEvidence['kind'],
  weight: number,
  message: string,
  pointers: readonly SourcePointer[],
): InferenceEvidence {
  const values = new Map(
    pointers.map((pointer) => [`${pointer.uri}\u0000${pointer.pointer}`, pointer] as const),
  )
  return {
    ruleId,
    kind,
    weight,
    message,
    sourcePointers: [...values.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([, pointer]) => pointer),
  }
}

function fieldPointers(pair: InferencePair): readonly SourcePointer[] {
  return [pair.source.sourcePointer, pair.target.sourcePointer]
}

function numericCompatible(left: string, right: string): boolean {
  return (left === 'integer' && right === 'number') || (left === 'number' && right === 'integer')
}

export function schemaTypesCompatible(
  sourceTypes: readonly string[],
  targetTypes: readonly string[],
): boolean {
  if (sourceTypes.length === 0 || targetTypes.length === 0) return true
  return sourceTypes.some((sourceType) =>
    targetTypes.some(
      (targetType) => sourceType === targetType || numericCompatible(sourceType, targetType),
    ),
  )
}

function createReadLifecycle(pair: InferencePair): boolean {
  return (
    pair.source.method === 'post' &&
    pair.target.method === 'get' &&
    pair.target.path.includes('{') &&
    pair.source.resourceKey.length > 0 &&
    pair.source.resourceKey === pair.target.resourceKey
  )
}

function resourceIdRelation(pair: InferencePair): boolean {
  if (!pair.target.normalizedName.genericId) return false
  if (pair.source.resourceKey !== pair.target.resourceKey) return false
  if (pair.source.normalizedName.genericId) return true
  const tokens = pair.source.normalizedName.tokens
  return (
    tokens.length >= 2 &&
    tokens.at(-1) === 'id' &&
    tokens.slice(0, -1).join('-') === pair.target.resourceKey
  )
}

function meaningfulOperationOverlap(pair: InferencePair): boolean {
  const ignored = new Set([
    'by',
    'create',
    'delete',
    'fetch',
    'find',
    'get',
    'list',
    'read',
    'update',
  ])
  const tokens = (value: string | undefined) =>
    new Set(
      (value ?? '')
        .replace(/([a-z\d])([A-Z])/gu, '$1 $2')
        .split(/[^A-Za-z0-9]+/u)
        .map((token) => token.toLowerCase())
        .filter((token) => token.length > 1 && !ignored.has(token)),
    )
  const source = tokens(pair.source.operationId)
  const target = tokens(pair.target.operationId)
  return [...source].some((token) => target.has(token))
}

export function plausibleInferencePair(pair: InferencePair): boolean {
  if (pair.source.normalizedName.signature === pair.target.normalizedName.signature) return true
  if (resourceIdRelation(pair)) return true
  if (pair.source.normalizedName.tokens.includes('token') && pair.target.bearerTarget) {
    return true
  }
  return false
}

export function evaluateHardConstraints(
  pair: InferencePair,
  graph: FlowGraph,
): readonly InferenceEvidence[] {
  const blockers: InferenceEvidence[] = []
  const pointers = fieldPointers(pair)

  if (pair.source.operationNodeId === pair.target.operationNodeId) {
    blockers.push(
      evidence(
        'INF-SAME-OPERATION',
        'blocker',
        0,
        'Source and target belong to the same operation.',
        pointers,
      ),
    )
  }
  if (pair.source.writeOnly) {
    blockers.push(
      evidence(
        'INF-WRITE-ONLY-SOURCE',
        'blocker',
        0,
        'A write-only schema field cannot be used as a response source.',
        pointers,
      ),
    )
  }
  if (pair.target.readOnly) {
    blockers.push(
      evidence(
        'INF-READ-ONLY-TARGET',
        'blocker',
        0,
        'A read-only schema field cannot be used as a request target.',
        pointers,
      ),
    )
  }
  if (pair.source.arrayDepth > 0) {
    blockers.push(
      evidence(
        'INF-ARRAY-SELECTOR',
        'blocker',
        0,
        'The response value is inside an array and requires an explicit selector.',
        pointers,
      ),
    )
  }
  if (!schemaTypesCompatible(pair.source.schemaTypes, pair.target.schemaTypes)) {
    blockers.push(
      evidence(
        'INF-INCOMPATIBLE',
        'blocker',
        0,
        'Source and target schema types are explicitly incompatible.',
        pointers,
      ),
    )
  }
  if (pair.source.normalizedName.secretLike && !pair.target.securityTarget) {
    blockers.push(
      evidence(
        'INF-SECRET-TARGET',
        'blocker',
        0,
        'A secret-shaped source cannot be suggested to a non-security target.',
        pointers,
      ),
    )
  }
  if (
    pair.source.normalizedName.genericId &&
    pair.target.normalizedName.genericId &&
    pair.source.resourceKey !== pair.target.resourceKey
  ) {
    blockers.push(
      evidence(
        'INF-CROSS-RESOURCE-ID',
        'blocker',
        0,
        'A generic ID cannot cross unrelated resource boundaries.',
        pointers,
      ),
    )
  }
  if (wouldCreateDeclaredCycle(graph, pair.source.operationNodeId, pair.target.operationNodeId)) {
    blockers.push(
      evidence(
        'INF-CYCLE-RISK',
        'blocker',
        0,
        'The proposed direction would create a cycle in declared control flow.',
        pointers,
      ),
    )
  }

  return blockers.sort((left, right) => left.ruleId.localeCompare(right.ruleId))
}

export function evaluateEvidenceRules(pair: InferencePair): readonly InferenceEvidence[] {
  const result: InferenceEvidence[] = []
  const pointers = fieldPointers(pair)
  const sourceLower = pair.source.name.toLowerCase()
  const targetLower = pair.target.name.toLowerCase()

  if (sourceLower === targetLower) {
    result.push(evidence('INF-NAME-EXACT', 'positive', 25, 'Field names match exactly.', pointers))
  }
  if (
    pair.source.normalizedName.signature.length > 0 &&
    pair.source.normalizedName.signature === pair.target.normalizedName.signature
  ) {
    result.push(
      evidence(
        'INF-NAME-NORMALIZED',
        'positive',
        18,
        'Normalized field-name tokens match.',
        pointers,
      ),
    )
  }
  if (resourceIdRelation(pair)) {
    result.push(
      evidence(
        'INF-RESOURCE-ID',
        'positive',
        25,
        'A resource response ID matches the target item parameter.',
        pointers,
      ),
    )
  }
  if (schemaTypesCompatible(pair.source.schemaTypes, pair.target.schemaTypes)) {
    result.push(
      evidence(
        'INF-SCHEMA-TYPE',
        'positive',
        12,
        'Source and target schema types are compatible.',
        pointers,
      ),
    )
  }
  if (pair.source.format !== undefined && pair.source.format === pair.target.format) {
    result.push(
      evidence(
        'INF-SCHEMA-FORMAT',
        'positive',
        10,
        'Source and target schema formats match.',
        pointers,
      ),
    )
  }
  if (pair.source.resourceKey.length > 0 && pair.source.resourceKey === pair.target.resourceKey) {
    result.push(
      evidence(
        'INF-RESOURCE-PATH',
        'positive',
        15,
        'Source and target operations share a resource path.',
        pointers,
      ),
    )
  }
  if (createReadLifecycle(pair)) {
    result.push(
      evidence(
        'INF-LIFECYCLE-CREATE-READ',
        'positive',
        20,
        'A collection create response feeds an item read request.',
        pointers,
      ),
    )
  }
  if (pair.source.normalizedName.tokens.includes('token') && pair.target.bearerTarget) {
    result.push(
      evidence(
        'INF-AUTH-BEARER',
        'positive',
        65,
        'A token-like response feeds a bearer-secured Authorization target.',
        pointers,
      ),
    )
  }
  if (pair.source.tags.some((tag) => pair.target.tags.includes(tag))) {
    result.push(
      evidence(
        'INF-TAG-SAME',
        'positive',
        4,
        'Source and target operations share an OpenAPI tag.',
        pointers,
      ),
    )
  }
  if (meaningfulOperationOverlap(pair)) {
    result.push(
      evidence(
        'INF-OPERATION-NAME',
        'positive',
        6,
        'Operation identifiers share a meaningful token.',
        pointers,
      ),
    )
  }
  if (pair.source.normalizedName.genericId && pair.target.normalizedName.genericId) {
    result.push(
      evidence('INF-GENERIC-ID', 'positive', 3, 'Both fields use the generic name id.', pointers),
    )
  }
  if (pair.source.variant || pair.target.variant) {
    result.push(
      evidence(
        'INF-VARIANT-SCHEMA',
        'penalty',
        -10,
        'At least one field belongs to a schema variant.',
        pointers,
      ),
    )
  }
  if (
    pair.source.resourceKey.length > 0 &&
    pair.target.resourceKey.length > 0 &&
    pair.source.resourceKey !== pair.target.resourceKey &&
    !pair.target.bearerTarget
  ) {
    result.push(
      evidence(
        'INF-CROSS-RESOURCE',
        'penalty',
        -20,
        'Source and target belong to different resources.',
        pointers,
      ),
    )
  }

  return result.sort((left, right) => left.ruleId.localeCompare(right.ruleId))
}

export function genericOnlyEvidence(evidenceValues: readonly InferenceEvidence[]): boolean {
  const strongRules = new Set([
    'INF-AUTH-BEARER',
    'INF-LIFECYCLE-CREATE-READ',
    'INF-RESOURCE-ID',
    'INF-RESOURCE-PATH',
  ])
  return !evidenceValues.some(({ kind, ruleId }) => kind === 'positive' && strongRules.has(ruleId))
}

export function evidenceScore(values: readonly InferenceEvidence[]): number {
  return values.reduce((total, value) => total + value.weight, 0)
}
