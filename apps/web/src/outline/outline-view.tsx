import type { SelectedElement, WorkspaceSnapshot } from '../data/types'
import type { OperationViewModel } from '../workspace/operation-view-model'
import { MethodBadge } from '../components/operations-panel'

function short(value: Readonly<Record<string, unknown>>): string {
  return typeof value.pointer === 'string'
    ? value.pointer
    : typeof value.name === 'string'
      ? String(value.location ?? value.kind) + '.' + value.name
      : String(value.kind ?? 'value')
}

export function OutlineView({
  snapshot,
  models,
  onSelect,
}: {
  readonly snapshot: WorkspaceSnapshot
  readonly models: readonly OperationViewModel[]
  readonly onSelect: (selected: SelectedElement) => void
}) {
  const operationByNode = new Map(
    snapshot.acceptedGraph.nodes.map((node) => [
      node.id,
      snapshot.apiDocument.operations.find((operation) => operation.id === node.operationKey),
    ]),
  )
  return (
    <section className="outline-view" aria-labelledby="outline-title">
      <header>
        <span className="eyebrow">ACCESSIBLE ALTERNATIVE</span>
        <h1 id="outline-title">Operation and relationship outline</h1>
        <p>The tables contain the same accepted topology shown on the canvas.</p>
      </header>
      <div className="table-shell">
        <table>
          <caption>API operations</caption>
          <thead>
            <tr>
              <th>Method</th>
              <th>Path</th>
              <th>Tag</th>
              <th>Incoming</th>
              <th>Outgoing</th>
            </tr>
          </thead>
          <tbody>
            {models.map((model) => (
              <tr key={model.nodeId}>
                <td>
                  <MethodBadge method={model.operation.method} />
                </td>
                <td>
                  <button
                    className="table-link"
                    onClick={() => onSelect({ kind: 'node', id: model.nodeId })}
                  >
                    {model.operation.path}
                  </button>
                </td>
                <td>{model.tag}</td>
                <td>{model.incoming}</td>
                <td>{model.outgoing}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-shell">
        <table>
          <caption>Accepted data mappings</caption>
          <thead>
            <tr>
              <th>Source</th>
              <th>Selector</th>
              <th>Target</th>
              <th>Target field</th>
              <th>Provenance</th>
            </tr>
          </thead>
          <tbody>
            {snapshot.acceptedGraph.edges.map((edge) => (
              <tr key={edge.id}>
                <td>{operationByNode.get(edge.sourceNodeId)?.path}</td>
                <td>
                  <code>{edge.mappings[0] ? short(edge.mappings[0].source) : '—'}</code>
                </td>
                <td>{operationByNode.get(edge.targetNodeId)?.path}</td>
                <td>
                  <button
                    className="table-link"
                    onClick={() => onSelect({ kind: 'edge', id: edge.id })}
                  >
                    <code>{edge.mappings[0] ? short(edge.mappings[0].target) : '—'}</code>
                  </button>
                </td>
                <td>
                  <span className={'provenance-token provenance-' + edge.provenance}>
                    {edge.provenance}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
