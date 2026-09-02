import type { FlowGraph, FlowValueSelector, FlowValueTarget } from '@api-schema-flow/domain'
import { canonicalizeJson } from '@api-schema-flow/flow'

export function declaredMappingKey(
  sourceNodeId: string,
  targetNodeId: string,
  source: FlowValueSelector,
  target: FlowValueTarget,
): string {
  return canonicalizeJson({ sourceNodeId, targetNodeId, source, target })
}

export function createDeclaredMappingIndex(graph: FlowGraph): ReadonlySet<string> {
  const keys = new Set<string>()
  for (const edge of graph.edges) {
    if (edge.kind !== 'data' || edge.provenance !== 'declared') continue
    for (const mapping of edge.mappings) {
      keys.add(
        declaredMappingKey(edge.sourceNodeId, edge.targetNodeId, mapping.source, mapping.target),
      )
    }
  }
  return keys
}

export function isDeclaredMapping(
  index: ReadonlySet<string>,
  sourceNodeId: string,
  targetNodeId: string,
  source: FlowValueSelector,
  target: FlowValueTarget,
): boolean {
  return index.has(declaredMappingKey(sourceNodeId, targetNodeId, source, target))
}
