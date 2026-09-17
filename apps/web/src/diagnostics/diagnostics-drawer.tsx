import { useTranslation } from 'react-i18next'
import { localizeRawMessage } from '../i18n'
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
  const { t } = useTranslation()
  const blocking = snapshot.diagnostics.filter((item) => item.severity === 'error').length
  return (
    <section
      className={'diagnostics-drawer' + (open ? ' is-open' : '')}
      aria-label={t('Workspace diagnostics')}
    >
      <button className="diagnostics-summary" onClick={onToggle} aria-expanded={open}>
        <span className="ready-dot" aria-hidden="true" />
        {t(
          'Ready · {{operations}} operations · {{relationships}} accepted relationships · {{blocking}} blocking errors',
          {
            operations: snapshot.apiDocument.operations.length,
            relationships: snapshot.acceptedGraph.edges.length,
            blocking,
          },
        )}
        <span aria-hidden="true">{open ? '⌄' : '⌃'}</span>
      </button>
      {open ? (
        <div className="diagnostics-content">
          {snapshot.diagnostics.length === 0 ? (
            <p>{t('No diagnostics were reported for this workspace.')}</p>
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
                    {t(item.severity.toUpperCase())} · {item.code}
                  </strong>
                  <p>{localizeRawMessage(item.message, t)}</p>
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
