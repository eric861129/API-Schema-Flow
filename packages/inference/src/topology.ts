import type { FlowGraph } from '@api-schema-flow/domain'

export function wouldCreateDeclaredCycle(
  graph: FlowGraph,
  sourceNodeId: string,
  targetNodeId: string,
): boolean {
  if (sourceNodeId === targetNodeId) return true

  const outgoing = new Map<string, Set<string>>()
  for (const edge of graph.edges) {
    if (
      edge.provenance !== 'declared' ||
      (edge.kind !== 'control' && edge.kind !== 'dependency')
    ) {
      continue
    }
    const values = outgoing.get(edge.sourceNodeId) ?? new Set<string>()
    values.add(edge.targetNodeId)
    outgoing.set(edge.sourceNodeId, values)
  }

  const stack = [targetNodeId]
  const visited = new Set<string>()
  while (stack.length > 0) {
    const current = stack.pop()!
    if (current === sourceNodeId) return true
    if (visited.has(current)) continue
    visited.add(current)
    for (const next of outgoing.get(current) ?? []) stack.push(next)
  }
  return false
}
