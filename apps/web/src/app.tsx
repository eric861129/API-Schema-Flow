import { useEffect, useState } from 'react'

import { loadWorkspaceSnapshot, WorkspaceLoadError } from './data/load-workspace'
import type { WorkspaceSnapshot } from './data/types'
import { useI18n } from './i18n'
import { WelcomeScreen } from './welcome-screen'
import { WorkspaceShell } from './workspace/workspace-shell'

type AppState =
  | { readonly kind: 'welcome' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly message: string; readonly local: boolean }
  | {
      readonly kind: 'ready'
      readonly snapshot: WorkspaceSnapshot
      readonly projectText?: string
      readonly sample: boolean
    }

function startWithSample() {
  return new URLSearchParams(window.location.search).get('sample') === '1'
}

function localToken() {
  return new URLSearchParams(window.location.hash.slice(1)).get('workspace')
}

async function loadStartupProject(token: string): Promise<string> {
  const response = await fetch('/api/project', {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })
  if (!response.ok)
    throw new Error(`The saved project could not be loaded (HTTP ${response.status}).`)
  return response.text()
}

export function App() {
  const { localize, t } = useI18n()
  const [state, setState] = useState<AppState>(() =>
    localToken() || startWithSample() ? { kind: 'loading' } : { kind: 'welcome' },
  )
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let cancelled = false
    const token = localToken()
    if (!token && !startWithSample()) {
      setState({ kind: 'welcome' })
      return
    }
    setState({ kind: 'loading' })
    loadWorkspaceSnapshot(
      token ? '/api/workspace' : undefined,
      fetch,
      token ? { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' } : undefined,
    )
      .then(async (snapshot) => {
        const projectText =
          token && new URLSearchParams(window.location.hash.slice(1)).get('project') === '1'
            ? await loadStartupProject(token)
            : undefined
        if (!cancelled)
          setState({
            kind: 'ready',
            snapshot,
            sample: !token,
            ...(projectText ? { projectText } : {}),
          })
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setState({
            kind: 'error',
            message:
              error instanceof WorkspaceLoadError
                ? error.message
                : error instanceof Error
                  ? error.message
                  : 'The workspace could not be opened.',
            local: Boolean(token),
          })
        }
      })

    return () => {
      cancelled = true
    }
  }, [reload])

  if (state.kind === 'welcome') {
    return (
      <WelcomeScreen
        onExploreSample={() => {
          const url = new URL(window.location.href)
          url.searchParams.set('sample', '1')
          window.history.replaceState(null, '', url)
          setReload((value) => value + 1)
        }}
      />
    )
  }

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
          {state.local ? (
            <p>
              {t(
                'This local link expires when the CLI stops. Run open with the same source again; add --project for a saved Project JSON, then use the new URL.',
              )}
            </p>
          ) : null}
          <button
            type="button"
            className="primary-button"
            onClick={() => setReload((value) => value + 1)}
          >
            {t('Retry loading workspace')}
          </button>
          {state.local ? (
            <a className="start-link" href="/">
              {t('Return to start')}
            </a>
          ) : null}
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

  return (
    <WorkspaceShell
      snapshot={state.snapshot}
      sample={state.sample}
      {...(state.projectText ? { projectText: state.projectText } : {})}
    />
  )
}
