import type { ReviewCandidateRow } from '../review/review-selectors'
import type { WorkspaceSnapshot } from '../data/types'

export interface CandidateConnection {
  readonly id: string
  readonly sourceNodeId: string
  readonly targetNodeId: string
  readonly count: number
  readonly confidence: number
  readonly evidenceCount: number
  readonly blockerCount: number
}

/** 將同一對端點的待審欄位映射合併成一條預覽線，避免把候選誤當成已接受關聯。 */
export function buildCandidateConnections(
  rows: readonly ReviewCandidateRow[],
  graph: WorkspaceSnapshot['acceptedGraph'],
): readonly CandidateConnection[] {
  const nodeIds = new Map(
    graph.nodes.flatMap((node) =>
      node.kind === 'endpoint' ? [[node.operationKey, node.id] as const] : [],
    ),
  )
  const connections = new Map<string, CandidateConnection>()
  for (const row of rows) {
    if (row.state !== 'pending') continue
    const sourceNodeId = nodeIds.get(row.sourceOperationKey)
    const targetNodeId = nodeIds.get(row.targetOperationKey)
    if (!sourceNodeId || !targetNodeId || sourceNodeId === targetNodeId) continue
    const key = `${sourceNodeId}\u0000${targetNodeId}`
    const current = connections.get(key)
    const preferred =
      current &&
      (current.blockerCount < row.blockerCount ||
        (current.blockerCount === row.blockerCount &&
          (current.confidence > row.confidence ||
            (current.confidence === row.confidence && current.evidenceCount >= row.evidenceCount))))
    connections.set(key, {
      id: preferred ? current.id : row.id,
      sourceNodeId,
      targetNodeId,
      count: (current?.count ?? 0) + 1,
      confidence: preferred ? current.confidence : row.confidence,
      evidenceCount: preferred ? current.evidenceCount : row.evidenceCount,
      blockerCount: preferred ? current.blockerCount : row.blockerCount,
    })
  }
  return [...connections.values()].sort(
    (left, right) =>
      left.blockerCount - right.blockerCount ||
      right.confidence - left.confidence ||
      right.evidenceCount - left.evidenceCount ||
      left.id.localeCompare(right.id),
  )
}

/** 預覽採用無循環的候選子集，完整候選仍留在審查清單。 */
export function selectPreviewConnections(
  graph: WorkspaceSnapshot['acceptedGraph'],
  candidates: readonly CandidateConnection[],
  limit = 40,
): readonly CandidateConnection[] {
  const adjacency = new Map<string, Set<string>>()
  const connect = (source: string, target: string) =>
    adjacency.set(source, new Set([...(adjacency.get(source) ?? []), target]))
  for (const edge of graph.edges) connect(edge.sourceNodeId, edge.targetNodeId)
  function reaches(source: string, target: string): boolean {
    const seen = new Set<string>()
    const pending = [source]
    while (pending.length) {
      const current = pending.pop()!
      if (current === target) return true
      if (seen.has(current)) continue
      seen.add(current)
      pending.push(...(adjacency.get(current) ?? []))
    }
    return false
  }
  const preview: CandidateConnection[] = []
  for (const candidate of candidates) {
    if (preview.length >= limit) break
    if (candidate.blockerCount > 0 || reaches(candidate.targetNodeId, candidate.sourceNodeId))
      continue
    preview.push(candidate)
    connect(candidate.sourceNodeId, candidate.targetNodeId)
  }
  return preview
}

/** 焦點包含選取端點以及已確認、待審關係的直接相鄰端點。 */
export function focusNeighborhood(
  graph: WorkspaceSnapshot['acceptedGraph'],
  candidates: readonly CandidateConnection[],
  nodeId: string,
): ReadonlySet<string> {
  const ids = new Set([nodeId])
  for (const edge of [...graph.edges, ...candidates]) {
    if (edge.sourceNodeId === nodeId) ids.add(edge.targetNodeId)
    if (edge.targetNodeId === nodeId) ids.add(edge.sourceNodeId)
  }
  return ids
}
