import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import '@xyflow/react/dist/style.css'

import type { FlowEdge, HttpMethod } from '@api-schema-flow/domain'
import type { FlowLayoutDirection, PositionedFlowGraph } from '@api-schema-flow/layout'
import { InMemoryMockSession } from '@api-schema-flow/mock-runtime'

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
import {
  buildOperationViewModels,
  filterOperationViewModels,
  scopeOperationViewModels,
} from './operation-view-model'
import {
  buildCandidateConnections,
  focusNeighborhood,
  selectPreviewConnections,
} from './exploration-model'
import { ExplorerOverview } from './explorer-overview'
import { WorkspaceNavigation, type WorkspaceDestination } from './workspace-navigation'

const emptyLayout: PositionedFlowGraph = {
  graphId: 'loading',
  width: 0,
  height: 0,
  nodes: [],
  edges: [],
}

const WorkflowEditor = lazy(() =>
  import('../workflow/workflow-editor').then(({ WorkflowEditor: component }) => ({
    default: component,
  })),
)

export function WorkspaceShell({
  snapshot,
  projectText,
  sample = false,
}: {
  readonly snapshot: WorkspaceSnapshot
  readonly projectText?: string
  readonly sample?: boolean
}) {
  return (
    <ReviewSessionProvider snapshot={snapshot}>
      <WorkspaceContent
        snapshot={snapshot}
        sample={sample}
        {...(projectText ? { projectText } : {})}
      />
    </ReviewSessionProvider>
  )
}

function WorkspaceContent({
  snapshot,
  projectText,
  sample,
}: {
  readonly snapshot: WorkspaceSnapshot
  readonly projectText?: string
  readonly sample: boolean
}) {
  const { state, dispatch, materialization, projection, selectCandidate } = useReviewSession()
  const { t } = useI18n()
  const activeSnapshot = useMemo(
    () => ({ ...snapshot, acceptedGraph: materialization.result.graph }),
    [snapshot, materialization.result.graph],
  )
  const mockSession = useMemo(
    () => new InMemoryMockSession(),
    [snapshot.reviewContext.projectFingerprint, snapshot.reviewContext.sourceRevision],
  )
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
  const [tag, setTag] = useState('')
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null)
  const [scopeBeforeFocus, setScopeBeforeFocus] = useState<{
    readonly query: string
    readonly methods: readonly HttpMethod[]
    readonly tag: string
    readonly destination: WorkspaceDestination
  } | null>(null)
  const [showCandidates, setShowCandidates] = useState(snapshot.acceptedGraph.edges.length === 0)
  const [operationsOpen, setOperationsOpen] = useState(true)
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false)
  const [layoutDirection, setLayoutDirection] = useState<FlowLayoutDirection | null>(null)
  const [layout, setLayout] = useState<PositionedFlowGraph>(emptyLayout)
  const [layoutInput, setLayoutInput] = useState<WorkspaceSnapshot['acceptedGraph'] | null>(null)
  const models = useMemo(() => buildOperationViewModels(activeSnapshot), [activeSnapshot])
  const candidateConnections = useMemo(
    () => buildCandidateConnections(projection.rows, activeSnapshot.acceptedGraph),
    [projection.rows, activeSnapshot.acceptedGraph],
  )
  const focusNodeIds = useMemo(
    () =>
      focusNodeId
        ? focusNeighborhood(activeSnapshot.acceptedGraph, candidateConnections, focusNodeId)
        : undefined,
    [activeSnapshot.acceptedGraph, candidateConnections, focusNodeId],
  )
  const filteredModels = useMemo(
    () =>
      filterOperationViewModels(models, {
        query,
        methods,
        tag,
        ...(focusNodeIds ? { focusNodeIds } : {}),
      }),
    [methods, models, query, tag, focusNodeIds],
  )
  const visibleGraph = useMemo(() => {
    const graph = activeSnapshot.acceptedGraph
    const ids = new Set(filteredModels.map((model) => model.nodeId))
    return {
      ...graph,
      nodes: graph.nodes.filter((node) => ids.has(node.id)),
      edges: graph.edges.filter((edge) => ids.has(edge.sourceNodeId) && ids.has(edge.targetNodeId)),
    }
  }, [activeSnapshot, filteredModels])
  const visibleModels = useMemo(
    () => scopeOperationViewModels(filteredModels, visibleGraph),
    [filteredModels, visibleGraph],
  )
  const fitToVisible = visibleGraph.nodes.length < activeSnapshot.acceptedGraph.nodes.length
  const visibleCandidates = useMemo(() => {
    if (
      !showCandidates ||
      destination !== 'topology' ||
      visibleGraph.nodes.length > MAX_CANVAS_OPERATIONS
    )
      return []
    const ids = new Set(visibleModels.map((model) => model.nodeId))
    return selectPreviewConnections(
      visibleGraph,
      candidateConnections.filter(
        (candidate) => ids.has(candidate.sourceNodeId) && ids.has(candidate.targetNodeId),
      ),
    )
  }, [showCandidates, destination, visibleModels, visibleGraph, candidateConnections])
  const baseLayoutGraph =
    activeSnapshot.acceptedGraph.nodes.length <= MAX_CANVAS_OPERATIONS
      ? activeSnapshot.acceptedGraph
      : visibleGraph
  const layoutGraph = useMemo(() => {
    if (!visibleCandidates.length) return baseLayoutGraph
    const previewEdges: FlowEdge[] = visibleCandidates.map((candidate) => ({
      id: `layout:suggestion:${candidate.id}`,
      kind: 'data',
      sourceNodeId: candidate.sourceNodeId,
      targetNodeId: candidate.targetNodeId,
      provenance: 'inferred',
      status: 'candidate',
      mappings: [],
      sourceStandardRefs: [],
    }))
    return { ...baseLayoutGraph, edges: [...baseLayoutGraph.edges, ...previewEdges] }
  }, [baseLayoutGraph, visibleCandidates])

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
  const workflowActive = destination === 'workflows'
  const fullWidthView = reviewActive || workflowActive

  function select(value: SelectedElement) {
    setSelected(value)
    if (value) setInspectorOpen(true)
  }
  function reviewCandidate(id: string) {
    const candidate = projection.rows.find((row) => row.id === id)
    if (candidate) {
      if (state.filters.query) dispatch({ type: 'set-query', query: '' })
      if (state.filters.reviewState !== 'all' && state.filters.reviewState !== 'pending')
        dispatch({ type: 'set-review-state', state: 'pending' })
      if (state.filters.hasBlockersOnly && candidate.blockerCount === 0)
        dispatch({ type: 'set-blockers-only', enabled: false })
      if (!state.filters.confidenceBands.includes(candidate.band))
        dispatch({ type: 'toggle-confidence', band: candidate.band })
    }
    selectCandidate(id)
    setDestination('inference-review')
  }
  function focusSelected() {
    if (selected?.kind !== 'node') return
    const neighbors = focusNeighborhood(
      activeSnapshot.acceptedGraph,
      candidateConnections,
      selected.id,
    )
    if (!scopeBeforeFocus) setScopeBeforeFocus({ query, methods, tag, destination })
    setQuery('')
    setMethods([])
    setTag('')
    setFocusNodeId(selected.id)
    setDestination(neighbors.size <= MAX_CANVAS_OPERATIONS ? 'topology' : 'outline')
    setInspectorOpen(false)
  }
  function clearFocus() {
    setFocusNodeId(null)
    if (!scopeBeforeFocus) return
    setQuery(scopeBeforeFocus.query)
    setMethods(scopeBeforeFocus.methods)
    setTag(scopeBeforeFocus.tag)
    setDestination(scopeBeforeFocus.destination)
    setScopeBeforeFocus(null)
  }
  function changeQuery(value: string) {
    setQuery(value)
    setFocusNodeId(null)
    setScopeBeforeFocus(null)
  }
  function changeMethods(value: readonly HttpMethod[]) {
    setMethods(value)
    setFocusNodeId(null)
    setScopeBeforeFocus(null)
  }
  function changeTag(value: string) {
    setTag(value)
    setFocusNodeId(null)
    setScopeBeforeFocus(null)
  }
  function chooseGroup(value: string) {
    setQuery('')
    setMethods([])
    setFocusNodeId(null)
    setScopeBeforeFocus(null)
    setSelected(null)
    setTag(value)
    const count = value
      ? models.filter((model) =>
          value === 'Untagged'
            ? model.operation.tags.length === 0
            : model.operation.tags.includes(value),
        ).length
      : models.length
    setDestination(count <= MAX_CANVAS_OPERATIONS ? 'topology' : 'outline')
  }

  return (
    <>
      <main
        aria-label={t('API Schema Flow workspace')}
        className={
          'workspace' +
          (reviewActive ? ' review-active' : '') +
          (workflowActive ? ' workflow-active' : '') +
          (!fullWidthView && !operationsOpen ? ' operations-closed' : '') +
          (!fullWidthView && selected && inspectorOpen ? ' inspector-open' : '')
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
                {t(
                  reviewActive
                    ? 'Inference review workspace'
                    : workflowActive
                      ? 'Workflow editor workspace'
                      : 'Read-only workspace',
                )}
              </small>
            </div>
          </div>
          <div className="project-context">
            <strong>{snapshot.project.name}</strong>
            {sample && !fullWidthView ? <span className="version-chip">{t('Sample')}</span> : null}
            <span>{snapshot.project.sourceName}</span>
            <span className="version-chip">OpenAPI {snapshot.project.openapiVersion}</span>
          </div>
          {!fullWidthView ? (
            <a className="start-link" href="/">
              {t('Start')}
            </a>
          ) : null}
          <ProjectControls {...(projectText ? { initialProjectText: projectText } : {})} />
          <LanguageSwitcher />
          <div
            className="view-actions"
            aria-label={t('Topology direction')}
            hidden={workflowActive}
          >
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

        {!fullWidthView ? (
          operationsOpen ? (
            <OperationsPanel
              models={models}
              visibleModels={visibleModels}
              query={query}
              activeMethods={methods}
              selectedTag={tag}
              {...(focusNodeIds ? { focusNodeIds } : {})}
              selectedNodeId={selected?.kind === 'node' ? selected.id : null}
              onQueryChange={changeQuery}
              onMethodsChange={changeMethods}
              onTagChange={changeTag}
              onChooseGroup={chooseGroup}
              onFocusSelection={focusSelected}
              onClearFocus={clearFocus}
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
            (workflowActive ? ' workflow-main-region' : '') +
            (destination === 'outline' ? ' outline-main-region' : '')
          }
        >
          {reviewActive ? (
            <ReviewWorkspace />
          ) : workflowActive ? (
            <Suspense fallback={<p role="status">{t('Loading workflow editor…')}</p>}>
              <WorkflowEditor
                snapshot={activeSnapshot}
                graph={activeSnapshot.acceptedGraph}
                draft={state.workflowDraft}
                mockSession={mockSession}
                onChange={(draft) => dispatch({ type: 'set-workflow-draft', draft })}
              />
            </Suspense>
          ) : (
            <>
              <ExplorerOverview
                operations={models.length}
                groups={new Set(models.map((model) => model.tag)).size}
                accepted={activeSnapshot.acceptedGraph.edges.length}
                candidates={projection.rows}
                onReview={reviewCandidate}
                onOpenReview={() => {
                  selectCandidate(null)
                  setDestination('inference-review')
                }}
              />
              {destination === 'topology' ? (
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
                    <div className="canvas-header__actions">
                      <button
                        type="button"
                        aria-pressed={showCandidates}
                        onClick={() => setShowCandidates(!showCandidates)}
                      >
                        {t('Suggestion preview')} · {visibleCandidates.length}/
                        {candidateConnections.length}
                      </button>
                      <button
                        type="button"
                        disabled={selected?.kind !== 'node'}
                        onClick={focusSelected}
                      >
                        {t('Focus neighbors')}
                      </button>
                      {focusNodeId ? (
                        <button type="button" onClick={clearFocus}>
                          {t('Show all')}
                        </button>
                      ) : null}
                    </div>
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
                        ...activeSnapshot,
                        acceptedGraph: visibleGraph,
                      }}
                      key={JSON.stringify([
                        direction,
                        state.layoutRevision ?? 0,
                        visibleGraph.nodes.map((node) => node.id),
                        Boolean(selected && inspectorOpen),
                      ])}
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
                      candidateConnections={visibleCandidates}
                      onCandidateSelect={reviewCandidate}
                      fitToVisible={fitToVisible}
                    />
                  ) : (
                    <p role="status">{t('Arranging topology…')}</p>
                  )}
                </>
              ) : (
                <OutlineView
                  snapshot={activeSnapshot}
                  graph={visibleGraph}
                  models={visibleModels}
                  onSelect={select}
                />
              )}
            </>
          )}
        </div>

        {!fullWidthView && selected && inspectorOpen ? (
          <InspectorPanel
            snapshot={activeSnapshot}
            selected={selected}
            onClose={() => setInspectorOpen(false)}
            onSelect={select}
          />
        ) : !fullWidthView && selected ? (
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
