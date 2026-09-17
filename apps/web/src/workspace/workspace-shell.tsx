import { useEffect, useMemo, useState } from 'react'
import '@xyflow/react/dist/style.css'

import type { HttpMethod } from '@api-schema-flow/domain'
import type { FlowLayoutDirection, PositionedFlowGraph } from '@api-schema-flow/layout'

import { OperationsPanel } from '../components/operations-panel'
import type { SelectedElement, WorkspaceSnapshot } from '../data/types'
import { DiagnosticsDrawer } from '../diagnostics/diagnostics-drawer'
import { FlowCanvas } from '../graph/flow-canvas'
import { MAX_CANVAS_OPERATIONS } from '../graph/canvas-limits'
import { InspectorPanel } from '../inspector/inspector-panel'
import { OutlineView } from '../outline/outline-view'
import { DEFAULT_WORKSPACE_LAYOUT } from '../project/workspace-layout'
import { ProjectControls } from '../project/project-controls'
import { ReviewSessionProvider, useReviewSession } from '../review/review-session-context'
import { ReviewWorkspace } from '../review/review-workspace'
import { LanguageSwitcher } from '../language-switcher'
import { useI18n } from '../i18n'
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
  return (
    <ReviewSessionProvider snapshot={snapshot}>
      <WorkspaceContent snapshot={snapshot} />
    </ReviewSessionProvider>
  )
}

function WorkspaceContent({ snapshot }: { readonly snapshot: WorkspaceSnapshot }) {
  const { state, dispatch } = useReviewSession()
  const { t } = useI18n()
  const workspaceLayout = state.workspaceLayout ?? DEFAULT_WORKSPACE_LAYOUT
  const direction = workspaceLayout.direction
  const setDirection = (value: FlowLayoutDirection) => {
    if (value === direction) return
    dispatch({
      type: 'set-workspace-layout',
      layout: { ...DEFAULT_WORKSPACE_LAYOUT, direction: value },
      reset: true,
    })
  }
  const [selected, setSelected] = useState<SelectedElement>(null)
  const [destination, setDestination] = useState<WorkspaceDestination>(
    snapshot.acceptedGraph.nodes.length > MAX_CANVAS_OPERATIONS ? 'outline' : 'topology',
  )
  const [query, setQuery] = useState('')
  const [methods, setMethods] = useState<readonly HttpMethod[]>([])
  const [operationsOpen, setOperationsOpen] = useState(true)
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false)
  const [layoutDirection, setLayoutDirection] = useState<FlowLayoutDirection | null>(null)
  const [layout, setLayout] = useState<PositionedFlowGraph>(emptyLayout)
  const [layoutInput, setLayoutInput] = useState<WorkspaceSnapshot['acceptedGraph'] | null>(null)
  const models = useMemo(() => buildOperationViewModels(snapshot), [snapshot])
  const visibleModels = useMemo(
    () => filterOperationViewModels(models, { query, methods }),
    [methods, models, query],
  )
  const visibleGraph = useMemo(() => {
    const graph = snapshot.acceptedGraph
    const ids = new Set(visibleModels.map((model) => model.nodeId))
    return {
      ...graph,
      nodes: graph.nodes.filter((node) => ids.has(node.id)),
      edges: graph.edges.filter((edge) => ids.has(edge.sourceNodeId) && ids.has(edge.targetNodeId)),
    }
  }, [snapshot, visibleModels])
  const layoutGraph =
    snapshot.acceptedGraph.nodes.length <= MAX_CANVAS_OPERATIONS
      ? snapshot.acceptedGraph
      : visibleGraph

  useEffect(() => {
    if (layoutGraph.nodes.length > MAX_CANVAS_OPERATIONS) return
    let cancelled = false
    import('@api-schema-flow/layout')
      .then(({ createElkFlowLayoutEngine }) =>
        createElkFlowLayoutEngine().layout(layoutGraph, { direction }),
      )
      .then((result) => {
        if (!cancelled) {
          setLayout(result)
          setLayoutInput(layoutGraph)
          setLayoutDirection(direction)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLayoutInput(layoutGraph)
          setLayoutDirection(direction)
          setLayout({
            graphId: layoutGraph.id,
            width: 0,
            height: 0,
            nodes: layoutGraph.nodes.map((node, index) => ({
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
  }, [direction, layoutGraph])
  const reviewActive = destination === 'inference-review'

  function select(value: SelectedElement) {
    setSelected(value)
    if (value) setInspectorOpen(true)
  }

  return (
    <>
      <main
        aria-label={t('API Schema Flow workspace')}
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
              <small>
                {t(reviewActive ? 'Inference review workspace' : 'Read-only workspace')}
              </small>
            </div>
          </div>
          <div className="project-context">
            <strong>{snapshot.project.name}</strong>
            <span>{snapshot.project.sourceName}</span>
            <span className="version-chip">OpenAPI {snapshot.project.openapiVersion}</span>
          </div>
          <ProjectControls />
          <LanguageSwitcher />
          <div className="view-actions" aria-label={t('Topology direction')}>
            <button
              type="button"
              aria-pressed={direction === 'right'}
              onClick={() => setDirection('right')}
            >
              {t('Horizontal')}
            </button>
            <button
              type="button"
              aria-pressed={direction === 'down'}
              onClick={() => setDirection('down')}
            >
              {t('Vertical')}
            </button>
          </div>
        </header>

        <WorkspaceNavigation
          activeDestination={destination}
          diagnosticsOpen={diagnosticsOpen}
          onDestinationChange={setDestination}
          onToggleDiagnostics={() => setDiagnosticsOpen((open) => !open)}
          onShowAbout={() => window.alert(t('API Schema Flow · Local API review workspace'))}
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
              aria-label={t('Open operations panel')}
            >
              ›
            </button>
          )
        ) : null}

        <div
          className={
            'main-region' +
            (reviewActive ? ' review-main-region' : '') +
            (destination === 'outline' ? ' outline-main-region' : '')
          }
        >
          {reviewActive ? (
            <ReviewWorkspace />
          ) : destination === 'topology' ? (
            <>
              <div className="canvas-header">
                <div>
                  <span className="eyebrow">{t('ACCEPTED TOPOLOGY')}</span>
                  <strong>
                    {t('{{visible}} of {{total}} endpoints', {
                      visible: visibleModels.length,
                      total: models.length,
                    })}
                  </strong>
                </div>
                <p>{t('Explore confirmed data movement without changing the specification.')}</p>
              </div>
              {layoutGraph.nodes.length > MAX_CANVAS_OPERATIONS ? (
                <p role="status">
                  {t(
                    'Large workspace: filter to {{limit}} or fewer endpoints for the canvas, or use Outline to inspect all operations.',
                    { limit: MAX_CANVAS_OPERATIONS },
                  )}
                </p>
              ) : layoutInput === layoutGraph && layoutDirection === direction ? (
                <FlowCanvas
                  snapshot={{
                    ...snapshot,
                    acceptedGraph: visibleGraph,
                  }}
                  key={`topology-${direction}-${state.layoutRevision ?? 0}`}
                  canvasLayout={workspaceLayout.topology}
                  onCanvasLayoutChange={(value) =>
                    dispatch({
                      type: 'set-workspace-layout',
                      layout: { ...workspaceLayout, topology: value },
                    })
                  }
                  positioned={layout}
                  selected={selected}
                  onSelect={select}
                />
              ) : (
                <p role="status">{t('Arranging topology…')}</p>
              )}
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
            {t('Open inspector')}
          </button>
        ) : null}

        <DiagnosticsDrawer
          snapshot={snapshot}
          open={diagnosticsOpen}
          onToggle={() => setDiagnosticsOpen((open) => !open)}
        />
      </main>
    </>
  )
}
