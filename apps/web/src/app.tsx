import { useEffect, useState } from 'react'

import { loadWorkspaceSnapshot, WorkspaceLoadError } from './data/load-workspace'
import type { WorkspaceSnapshot } from './data/types'
import { useI18n } from './i18n'
import { WorkspaceShell } from './workspace/workspace-shell'

type AppState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'ready'; readonly snapshot: WorkspaceSnapshot }

export function App() {
  const { localize, t } = useI18n()
  const [state, setState] = useState<AppState>({ kind: 'loading' })
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState({ kind: 'loading' })
    const token = new URLSearchParams(window.location.hash.slice(1)).get('workspace')
    loadWorkspaceSnapshot(
      token ? '/api/workspace' : undefined,
      fetch,
      token ? { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' } : undefined,
    )
      .then((snapshot) => {
        if (!cancelled) setState({ kind: 'ready', snapshot })
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            kind: 'error',
            message:
              error instanceof WorkspaceLoadError
                ? error.message
                : 'The workspace could not be opened.',
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [reload])

  if (state.kind === 'loading') {
    return (
      <main className="center-state" aria-live="polite">
        <div className="brand-mark" aria-hidden="true">
          ASF
        </div>
        <div>
          <h1>API Schema Flow</h1>
          <p>{t('Loading API workspace…')}</p>
        </div>
      </main>
    )
  }

  if (state.kind === 'error') {
    return (
      <main className="center-state error-state">
        <div className="brand-mark" aria-hidden="true">
          !
        </div>
        <div>
          <h1>{t('Workspace unavailable')}</h1>
          <p>{localize(state.message)}</p>
          <button
            type="button"
            className="primary-button"
            onClick={() => setReload((value) => value + 1)}
          >
            {t('Retry loading workspace')}
          </button>
        </div>
      </main>
    )
  }

  if (state.snapshot.apiDocument.operations.length === 0) {
    return (
      <main className="center-state">
        <div>
          <h1>{t('No API operations')}</h1>
          <p>{t('The loaded workspace does not contain operations to visualize.')}</p>
        </div>
      </main>
    )
  }

  return <WorkspaceShell snapshot={state.snapshot} />
}
