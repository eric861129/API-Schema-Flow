import { useEffect, useState } from 'react'

import { loadWorkspaceSnapshot, WorkspaceLoadError } from './data/load-workspace'
import type { WorkspaceSnapshot } from './data/types'
import { WorkspaceShell } from './workspace/workspace-shell'

type AppState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'ready'; readonly snapshot: WorkspaceSnapshot }

export function App() {
  const [state, setState] = useState<AppState>({ kind: 'loading' })
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState({ kind: 'loading' })
    loadWorkspaceSnapshot()
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
          <p>Loading Reservation workspace…</p>
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
          <h1>Workspace unavailable</h1>
          <p>{state.message}</p>
          <button
            type="button"
            className="primary-button"
            onClick={() => setReload((value) => value + 1)}
          >
            Retry loading fixture
          </button>
        </div>
      </main>
    )
  }

  if (state.snapshot.apiDocument.operations.length === 0) {
    return (
      <main className="center-state">
        <div>
          <h1>No API operations</h1>
          <p>The loaded workspace does not contain operations to visualize.</p>
        </div>
      </main>
    )
  }

  return <WorkspaceShell snapshot={state.snapshot} />
}
