import type { EndpointFlowNode, HttpMethod, NormalizedOperation } from '@api-schema-flow/domain'

import type { WorkspaceSnapshot } from '../data/types'

export interface OperationViewModel {
  readonly nodeId: string
  readonly operation: NormalizedOperation
  readonly tag: string
  readonly incoming: number
  readonly outgoing: number
}

export interface OperationFilters {
  readonly query: string
  readonly methods: readonly HttpMethod[]
  readonly tag?: string
  readonly focusNodeIds?: ReadonlySet<string>
}

function isEndpointNode(
  node: WorkspaceSnapshot['acceptedGraph']['nodes'][number],
): node is EndpointFlowNode {
  return node.kind === 'endpoint'
}

export function buildOperationViewModels(
  snapshot: WorkspaceSnapshot,
): readonly OperationViewModel[] {
  const nodeByOperation = new Map(
    snapshot.acceptedGraph.nodes.filter(isEndpointNode).map((node) => [node.operationKey, node.id]),
  )
  const incoming = new Map<string, number>()
  const outgoing = new Map<string, number>()
  for (const edge of snapshot.acceptedGraph.edges) {
    incoming.set(edge.targetNodeId, (incoming.get(edge.targetNodeId) ?? 0) + 1)
    outgoing.set(edge.sourceNodeId, (outgoing.get(edge.sourceNodeId) ?? 0) + 1)
  }

  return snapshot.apiDocument.operations
    .map((operation) => {
      const nodeId = nodeByOperation.get(operation.id) ?? operation.id
      return {
        nodeId,
        operation,
        tag: operation.tags[0] ?? 'Untagged',
        incoming: incoming.get(nodeId) ?? 0,
        outgoing: outgoing.get(nodeId) ?? 0,
      }
    })
    .toSorted(
      (left, right) =>
        left.tag.localeCompare(right.tag) ||
        left.operation.path.localeCompare(right.operation.path) ||
        left.operation.method.localeCompare(right.operation.method),
    )
}

export function filterOperationViewModels(
  models: readonly OperationViewModel[],
  filters: OperationFilters,
): readonly OperationViewModel[] {
  const query = filters.query.trim().toLocaleLowerCase()
  const methods = new Set(filters.methods)
  return models.filter((model) => {
    if (methods.size > 0 && !methods.has(model.operation.method)) return false
    if (
      filters.tag &&
      !(filters.tag === 'Untagged' && model.operation.tags.length === 0) &&
      !model.operation.tags.includes(filters.tag)
    )
      return false
    if (filters.focusNodeIds && !filters.focusNodeIds.has(model.nodeId)) return false
    if (query.length === 0) return true
    return [
      model.operation.path,
      model.operation.operationId ?? '',
      model.operation.summary ?? '',
      model.operation.description ?? '',
      ...model.operation.tags,
    ]
      .join(' ')
      .toLocaleLowerCase()
      .includes(query)
  })
}

/** 依目前可見的關係重新計算端點進出數，讓清單與畫布使用同一個範圍。 */
export function scopeOperationViewModels(
  models: readonly OperationViewModel[],
  graph: WorkspaceSnapshot['acceptedGraph'],
): readonly OperationViewModel[] {
  const incoming = new Map<string, number>()
  const outgoing = new Map<string, number>()
  for (const edge of graph.edges) {
    incoming.set(edge.targetNodeId, (incoming.get(edge.targetNodeId) ?? 0) + 1)
    outgoing.set(edge.sourceNodeId, (outgoing.get(edge.sourceNodeId) ?? 0) + 1)
  }
  return models.map((model) => ({
    ...model,
    incoming: incoming.get(model.nodeId) ?? 0,
    outgoing: outgoing.get(model.nodeId) ?? 0,
  }))
}

export function groupOperationViewModels(
  models: readonly OperationViewModel[],
): ReadonlyMap<string, readonly OperationViewModel[]> {
  const groups = new Map<string, OperationViewModel[]>()
  for (const model of models) {
    const group = groups.get(model.tag)
    if (group) group.push(model)
    else groups.set(model.tag, [model])
  }
  return new Map([...groups.entries()].sort(([left], [right]) => left.localeCompare(right)))
}
