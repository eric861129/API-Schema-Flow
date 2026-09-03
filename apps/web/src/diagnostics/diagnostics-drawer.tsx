import type { WorkspaceSnapshot } from '../data/types'

export function DiagnosticsDrawer({
  snapshot,
  open,
  onToggle,
}: {
  readonly snapshot: WorkspaceSnapshot
  readonly open: boolean
  readonly onToggle: () => void
}) {
  const blocking = snapshot.diagnostics.filter((item) => item.severity === 'error').length
  return (
    <section
      className={'diagnostics-drawer' + (open ? ' is-open' : '')}
      aria-label="Workspace diagnostics"
    >
      <button className="diagnostics-summary" onClick={onToggle} aria-expanded={open}>
        <span className="ready-dot" aria-hidden="true" />
        Ready · {snapshot.apiDocument.operations.length} operations ·{' '}
        {snapshot.acceptedGraph.edges.length} accepted relationships · {blocking} blocking errors
        <span aria-hidden="true">{open ? '⌄' : '⌃'}</span>
      </button>
      {open ? (
        <div className="diagnostics-content">
          {snapshot.diagnostics.length === 0 ? (
            <p>No diagnostics were reported for this workspace.</p>
          ) : (
            snapshot.diagnostics
              .toSorted(
                (left, right) =>
                  left.severity.localeCompare(right.severity) ||
                  left.code.localeCompare(right.code),
              )
              .map((item) => (
                <article key={item.code + item.message}>
                  <strong>
                    {item.severity.toUpperCase()} · {item.code}
                  </strong>
                  <p>{item.message}</p>
                  {item.source ? (
                    <code>
                      {item.source.uri}
                      {item.source.pointer}
                    </code>
                  ) : null}
                </article>
              ))
          )}
        </div>
      ) : null}
    </section>
  )
}
