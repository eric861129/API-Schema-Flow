import { useEffect, useMemo, useState } from 'react'
import type { PositionedFlowGraph } from '@api-schema-flow/layout'

import type { SelectedElement, WorkspaceSnapshot } from '../data/types'
import type { CanvasLayoutState } from '../project/workspace-layout'
import { FlowCanvas } from '../graph/flow-canvas'
import { MAX_CANVAS_OPERATIONS } from '../graph/canvas-limits'
import { useI18n } from '../i18n'

type ReviewGraph = WorkspaceSnapshot['acceptedGraph']

/** 草稿排版與快照分離，過期的非同步排版結果不會覆蓋新決策。 */
export function DraftGraphPreview({
  snapshot,
  graph,
  pendingCount,
  canvasLayout,
  onCanvasLayoutChange,
  direction = 'right',
  layoutRevision = 0,
}: {
  readonly snapshot: WorkspaceSnapshot
  readonly graph: ReviewGraph
  readonly pendingCount: number
  readonly canvasLayout?: CanvasLayoutState
  readonly onCanvasLayoutChange?: (layout: CanvasLayoutState) => void
  readonly direction?: 'right' | 'down'
  readonly layoutRevision?: number
}) {
  const { t } = useI18n()
  const [positioned, setPositioned] = useState<{
    graph: ReviewGraph
    direction: 'right' | 'down'
    layout: PositionedFlowGraph
    fallback: boolean
  } | null>(null)
  const [selected, setSelected] = useState<SelectedElement>(null)
  const draftSnapshot = useMemo(() => ({ ...snapshot, acceptedGraph: graph }), [snapshot, graph])

  useEffect(() => {
    if (graph.nodes.length > MAX_CANVAS_OPERATIONS) return
    let cancelled = false
    import('@api-schema-flow/layout')
      .then(({ createElkFlowLayoutEngine }) =>
        createElkFlowLayoutEngine().layout(graph, { direction }),
      )
      .then((layout) => {
        if (!cancelled) setPositioned({ graph, direction, layout, fallback: false })
      })
      .catch(() => {
        if (!cancelled)
          setPositioned({
            graph,
            direction,
            fallback: true,
            layout: {
              graphId: graph.id,
              width: graph.nodes.length * 330,
              height: 240,
              nodes: graph.nodes.map((node, index) => ({
                id: node.id,
                x: index * 330,
                y: 60,
                width: 270,
                height: 112,
              })),
              edges: [],
            },
          })
      })
    return () => {
      cancelled = true
    }
  }, [graph, direction])

  return (
    <div className="draft-graph-preview">
      <section aria-label={t('Draft graph summary')} className="draft-graph-summary">
        <strong>{t('Review graph preview')}</strong>
        <ul>
          <li>
            {t('{{count}} declared accepted', {
              count: graph.edges.filter((edge) => edge.provenance === 'declared').length,
            })}
          </li>
          <li>
            {t('{{count}} inferred accepted', {
              count: graph.edges.filter((edge) => edge.provenance === 'inferred').length,
            })}
          </li>
          <li>
            {t('{{count}} manual accepted', {
              count: graph.edges.filter((edge) => edge.provenance === 'manual').length,
            })}
          </li>
          <li>{t('{{count}} pending candidates outside the graph', { count: pendingCount })}</li>
        </ul>
      </section>
      {graph.nodes.length > MAX_CANVAS_OPERATIONS ? (
        <p>
          {t(
            'Large workspace: use Mapping preview and Review Summary to inspect decisions. The draft canvas is limited to {{limit}} operations.',
            { limit: MAX_CANVAS_OPERATIONS },
          )}
        </p>
      ) : positioned?.graph === graph && positioned.direction === direction ? (
        <>
          {positioned.fallback ? (
            <p>{t('Automatic layout is unavailable. Showing a simple linear preview.')}</p>
          ) : null}
          <FlowCanvas
            key={`review-${direction}-${layoutRevision}`}
            canvasLayout={canvasLayout}
            onCanvasLayoutChange={onCanvasLayoutChange}
            snapshot={draftSnapshot}
            positioned={positioned.layout}
            selected={selected}
            onSelect={setSelected}
            ariaLabel={t('Review graph preview')}
          />
        </>
      ) : (
        <p>{t('Arranging draft topology…')}</p>
      )}
    </div>
  )
}
