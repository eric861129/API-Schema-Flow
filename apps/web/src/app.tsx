import { useEffect, useMemo, useState } from 'react'
import '@xyflow/react/dist/style.css'

import type { FlowLayoutDirection, PositionedFlowGraph } from '@api-schema-flow/layout'

import { OperationsPanel } from './components/operations-panel'
import { DiagnosticsDrawer } from './diagnostics/diagnostics-drawer'
import { loadWorkspaceSnapshot, WorkspaceLoadError } from './data/load-workspace'
import type { HttpMethod, SelectedElement, WorkspaceSnapshot } from './data/types'
import { FlowCanvas } from './graph/flow-canvas'
import { InspectorPanel } from './inspector/inspector-panel'
import { OutlineView } from './outline/outline-view'
import {
  buildOperationViewModels,
  filterOperationViewModels,
} from './workspace/operation-view-model'

type AppState =
  | { readonly kind: 'loading' }
  | { readonly kind: 'error'; readonly message: string }
  | { readonly kind: 'ready'; readonly snapshot: WorkspaceSnapshot }

const emptyLayout: PositionedFlowGraph = {
  graphId: 'loading',
  width: 0,
  height: 0,
  nodes: [],
  edges: [],
}

export function App() {
  const [state, setState] = useState<AppState>({ kind: 'loading' })
  const [selected, setSelected] = useState<SelectedElement>(null)
  const [activeView, setActiveView] = useState<'topology' | 'outline'>('topology')
  const [query, setQuery] = useState('')
  const [methods, setMethods] = useState<readonly HttpMethod[]>([])
  const [operationsOpen, setOperationsOpen] = useState(true)
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false)
  const [direction, setDirection] = useState<FlowLayoutDirection>('right')
  const [layout, setLayout] = useState<PositionedFlowGraph>(emptyLayout)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState({ kind: 'loading' })
    loadWorkspaceSnapshot()
      .then((snapshot) => {
        if (!cancelled) setState({ kind: 'ready', snapshot })
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setState({
            kind: 'error',
            message:
              error instanceof WorkspaceLoadError
                ? error.message
                : 'The workspace could not be opened.',
          })
      })
    return () => {
      cancelled = true
    }
  }, [reload])

  const snapshot = state.kind === 'ready' ? state.snapshot : null
  useEffect(() => {
    if (!snapshot) return
    let cancelled = false
    import('@api-schema-flow/layout')
      .then(({ createElkFlowLayoutEngine }) =>
        createElkFlowLayoutEngine().layout(snapshot.acceptedGraph as never, { direction }),
      )
      .then((result) => {
        if (!cancelled) setLayout(result)
      })
      .catch(() => {
        if (!cancelled)
          setLayout({
            graphId: snapshot.acceptedGraph.id,
            width: 0,
            height: 0,
            nodes: snapshot.acceptedGraph.nodes.map((node, index) => ({
              id: node.id,
              x: index * 330,
              y: 120,
              width: 270,
              height: 112,
            })),
            edges: [],
          })
      })
    return () => {
      cancelled = true
    }
  }, [direction, snapshot])

  const models = useMemo(() => (snapshot ? buildOperationViewModels(snapshot) : []), [snapshot])
  const visibleModels = useMemo(
    () => filterOperationViewModels(models, { query, methods }),
    [methods, models, query],
  )

  function select(value: SelectedElement) {
    setSelected(value)
    if (value) setInspectorOpen(true)
  }

  if (state.kind === 'loading')
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
  if (state.kind === 'error')
    return (
      <main className="center-state error-state">
        <div className="brand-mark" aria-hidden="true">
          !
        </div>
        <div>
          <h1>Workspace unavailable</h1>
          <p>{state.message}</p>
          <button className="primary-button" onClick={() => setReload((value) => value + 1)}>
            Retry loading fixture
          </button>
        </div>
      </main>
    )
  if (state.snapshot.apiDocument.operations.length === 0)
    return (
      <main className="center-state">
        <div>
          <h1>No API operations</h1>
          <p>The loaded workspace does not contain operations to visualize.</p>
        </div>
      </main>
    )

  return (
    <main
      className={
        'workspace' +
        (operationsOpen ? '' : ' operations-closed') +
        (selected && inspectorOpen ? ' inspector-open' : '')
      }
    >
      <header className="top-bar">
        <div className="product-lockup">
          <div className="brand-mark" aria-hidden="true">
            ASF
          </div>
          <div>
            <strong>API Schema Flow</strong>
            <small>Read-only workspace</small>
          </div>
        </div>
        <div className="project-context">
          <strong>{state.snapshot.project.name}</strong>
          <span>{state.snapshot.project.sourceName}</span>
          <span className="version-chip">OpenAPI {state.snapshot.project.openapiVersion}</span>
        </div>
        <div className="view-actions">
          <button aria-pressed={direction === 'right'} onClick={() => setDirection('right')}>
            Horizontal
          </button>
          <button aria-pressed={direction === 'down'} onClick={() => setDirection('down')}>
            Vertical
          </button>
        </div>
      </header>
      <nav className="icon-rail" aria-label="Workspace views">
        <button
          aria-current={activeView === 'topology' ? 'page' : undefined}
          onClick={() => setActiveView('topology')}
        >
          <span aria-hidden="true">⌘</span>
          <small>Topology</small>
        </button>
        <button
          aria-current={activeView === 'outline' ? 'page' : undefined}
          onClick={() => setActiveView('outline')}
        >
          <span aria-hidden="true">☷</span>
          <small>Outline</small>
        </button>
        <button
          aria-expanded={diagnosticsOpen}
          onClick={() => setDiagnosticsOpen((value) => !value)}
        >
          <span aria-hidden="true">◇</span>
          <small>Diagnostics</small>
        </button>
        <button
          onClick={() => window.alert('API Schema Flow M3-A · Read-only Reservation workspace')}
        >
          <span aria-hidden="true">i</span>
          <small>About</small>
        </button>
      </nav>
      {operationsOpen ? (
        <OperationsPanel
          models={models}
          query={query}
          activeMethods={methods}
          selectedNodeId={selected?.kind === 'node' ? selected.id : null}
          onQueryChange={setQuery}
          onMethodsChange={setMethods}
          onSelect={(id) => select({ kind: 'node', id })}
          onCollapse={() => setOperationsOpen(false)}
        />
      ) : (
        <button
          className="reopen-operations"
          onClick={() => setOperationsOpen(true)}
          aria-label="Open operations panel"
        >
          ›
        </button>
      )}
      <div className="main-region">
        {activeView === 'topology' ? (
          <>
            <div className="canvas-header">
              <div>
                <span className="eyebrow">ACCEPTED TOPOLOGY</span>
                <strong>
                  {visibleModels.length} of {models.length} endpoints
                </strong>
              </div>
              <p>Explore confirmed data movement without changing the specification.</p>
            </div>
            <FlowCanvas
              snapshot={{
                ...state.snapshot,
                acceptedGraph: {
                  ...state.snapshot.acceptedGraph,
                  nodes: state.snapshot.acceptedGraph.nodes.filter((node) =>
                    visibleModels.some((model) => model.nodeId === node.id),
                  ),
                  edges: state.snapshot.acceptedGraph.edges.filter(
                    (edge) =>
                      visibleModels.some((model) => model.nodeId === edge.sourceNodeId) &&
                      visibleModels.some((model) => model.nodeId === edge.targetNodeId),
                  ),
                },
              }}
              positioned={layout}
              selected={selected}
              onSelect={select}
            />
          </>
        ) : (
          <OutlineView snapshot={state.snapshot} models={visibleModels} onSelect={select} />
        )}
      </div>
      {selected && inspectorOpen ? (
        <InspectorPanel
          snapshot={state.snapshot}
          selected={selected}
          onClose={() => setInspectorOpen(false)}
          onSelect={select}
        />
      ) : selected ? (
        <button className="reopen-inspector" onClick={() => setInspectorOpen(true)}>
          Open inspector
        </button>
      ) : null}
      <DiagnosticsDrawer
        snapshot={state.snapshot}
        open={diagnosticsOpen}
        onToggle={() => setDiagnosticsOpen((value) => !value)}
      />
    </main>
  )
}
