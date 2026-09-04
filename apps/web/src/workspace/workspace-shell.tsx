import { useEffect, useMemo, useState } from 'react'
import '@xyflow/react/dist/style.css'

import type { HttpMethod } from '@api-schema-flow/domain'
import type { FlowLayoutDirection, PositionedFlowGraph } from '@api-schema-flow/layout'

import { OperationsPanel } from '../components/operations-panel'
import type { SelectedElement, WorkspaceSnapshot } from '../data/types'
import { DiagnosticsDrawer } from '../diagnostics/diagnostics-drawer'
import { FlowCanvas } from '../graph/flow-canvas'
import { InspectorPanel } from '../inspector/inspector-panel'
import { OutlineView } from '../outline/outline-view'
import { ReviewSessionProvider } from '../review/review-session-context'
import { ReviewWorkspace } from '../review/review-workspace'
import { buildOperationViewModels, filterOperationViewModels } from './operation-view-model'
import { WorkspaceNavigation, type WorkspaceDestination } from './workspace-navigation'

const emptyLayout: PositionedFlowGraph = {
  graphId: 'loading',
  width: 0,
  height: 0,
  nodes: [],
  edges: [],
}

export function WorkspaceShell({ snapshot }: { readonly snapshot: WorkspaceSnapshot }) {
  const [selected, setSelected] = useState<SelectedElement>(null)
  const [destination, setDestination] = useState<WorkspaceDestination>('topology')
  const [query, setQuery] = useState('')
  const [methods, setMethods] = useState<readonly HttpMethod[]>([])
  const [operationsOpen, setOperationsOpen] = useState(true)
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false)
  const [direction, setDirection] = useState<FlowLayoutDirection>('right')
  const [layout, setLayout] = useState<PositionedFlowGraph>(emptyLayout)

  useEffect(() => {
    let cancelled = false
    import('@api-schema-flow/layout')
      .then(({ createElkFlowLayoutEngine }) =>
        createElkFlowLayoutEngine().layout(snapshot.acceptedGraph, { direction }),
      )
      .then((result) => {
        if (!cancelled) setLayout(result)
      })
      .catch(() => {
        if (!cancelled) {
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
        }
      })
    return () => {
      cancelled = true
    }
  }, [direction, snapshot])

  const models = useMemo(() => buildOperationViewModels(snapshot), [snapshot])
  const visibleModels = useMemo(
    () => filterOperationViewModels(models, { query, methods }),
    [methods, models, query],
  )
  const reviewActive = destination === 'inference-review'

  function select(value: SelectedElement) {
    setSelected(value)
    if (value) setInspectorOpen(true)
  }

  return (
    <ReviewSessionProvider snapshot={snapshot}>
      <main
        aria-label="API Schema Flow workspace"
        className={
          'workspace' +
          (reviewActive ? ' review-active' : '') +
          (!reviewActive && !operationsOpen ? ' operations-closed' : '') +
          (!reviewActive && selected && inspectorOpen ? ' inspector-open' : '')
        }
      >
        <header className="top-bar">
          <div className="product-lockup">
            <div className="brand-mark" aria-hidden="true">
              ASF
            </div>
            <div>
              <strong>API Schema Flow</strong>
              <small>{reviewActive ? 'Inference review workspace' : 'Read-only workspace'}</small>
            </div>
          </div>
          <div className="project-context">
            <strong>{snapshot.project.name}</strong>
            <span>{snapshot.project.sourceName}</span>
            <span className="version-chip">OpenAPI {snapshot.project.openapiVersion}</span>
          </div>
          <div className="view-actions" aria-label="Topology direction">
            <button
              type="button"
              aria-pressed={direction === 'right'}
              onClick={() => setDirection('right')}
            >
              Horizontal
            </button>
            <button
              type="button"
              aria-pressed={direction === 'down'}
              onClick={() => setDirection('down')}
            >
              Vertical
            </button>
          </div>
        </header>

        <WorkspaceNavigation
          activeDestination={destination}
          diagnosticsOpen={diagnosticsOpen}
          onDestinationChange={setDestination}
          onToggleDiagnostics={() => setDiagnosticsOpen((open) => !open)}
          onShowAbout={() =>
            window.alert('API Schema Flow M3-B1 · Review-ready Reservation workspace')
          }
        />

        {!reviewActive ? (
          operationsOpen ? (
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
              type="button"
              className="reopen-operations"
              onClick={() => setOperationsOpen(true)}
              aria-label="Open operations panel"
            >
              ›
            </button>
          )
        ) : null}

        <div className={'main-region' + (reviewActive ? ' review-main-region' : '')}>
          {reviewActive ? (
            <ReviewWorkspace />
          ) : destination === 'topology' ? (
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
                  ...snapshot,
                  acceptedGraph: {
                    ...snapshot.acceptedGraph,
                    nodes: snapshot.acceptedGraph.nodes.filter((node) =>
                      visibleModels.some((model) => model.nodeId === node.id),
                    ),
                    edges: snapshot.acceptedGraph.edges.filter(
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
            <OutlineView snapshot={snapshot} models={visibleModels} onSelect={select} />
          )}
        </div>

        {!reviewActive && selected && inspectorOpen ? (
          <InspectorPanel
            snapshot={snapshot}
            selected={selected}
            onClose={() => setInspectorOpen(false)}
            onSelect={select}
          />
        ) : !reviewActive && selected ? (
          <button type="button" className="reopen-inspector" onClick={() => setInspectorOpen(true)}>
            Open inspector
          </button>
        ) : null}

        <DiagnosticsDrawer
          snapshot={snapshot}
          open={diagnosticsOpen}
          onToggle={() => setDiagnosticsOpen((open) => !open)}
        />
      </main>
    </ReviewSessionProvider>
  )
}
