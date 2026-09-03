import type { EdgeValue, HttpMethod, OperationValue, WorkspaceSnapshot } from '../data/types'

export interface OperationViewModel {
  readonly nodeId: string
  readonly operation: OperationValue
  readonly tag: string
  readonly incoming: number
  readonly outgoing: number
}

export interface OperationFilters {
  readonly query: string
  readonly methods: readonly HttpMethod[]
}

export function buildOperationViewModels(
  snapshot: WorkspaceSnapshot,
): readonly OperationViewModel[] {
  const edges = snapshot.acceptedGraph.edges
  const nodeByOperation = new Map(
    snapshot.acceptedGraph.nodes.map((node) => [node.operationKey, node.id]),
  )
  return snapshot.apiDocument.operations
    .map((operation) => {
      const nodeId = nodeByOperation.get(operation.id) ?? operation.id
      return {
        nodeId,
        operation,
        tag: operation.tags[0] ?? 'Untagged',
        incoming: edges.filter((edge: EdgeValue) => edge.targetNodeId === nodeId).length,
        outgoing: edges.filter((edge: EdgeValue) => edge.sourceNodeId === nodeId).length,
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
    const searchable = [
      model.operation.path,
      model.operation.operationId ?? '',
      model.operation.summary ?? '',
    ]
      .join(' ')
      .toLocaleLowerCase()
    return (
      (query.length === 0 || searchable.includes(query)) &&
      (methods.size === 0 || methods.has(model.operation.method))
    )
  })
}

export function groupOperationViewModels(
  models: readonly OperationViewModel[],
): ReadonlyMap<string, readonly OperationViewModel[]> {
  const groups = new Map<string, OperationViewModel[]>()
  for (const model of models) groups.set(model.tag, [...(groups.get(model.tag) ?? []), model])
  return new Map([...groups.entries()].sort(([left], [right]) => left.localeCompare(right)))
}
