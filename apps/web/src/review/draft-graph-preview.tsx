import { useEffect, useMemo, useState } from 'react'
import type { PositionedFlowGraph } from '@api-schema-flow/layout'

import type { SelectedElement, WorkspaceSnapshot } from '../data/types'
import { FlowCanvas } from '../graph/flow-canvas'

type ReviewGraph = WorkspaceSnapshot['acceptedGraph']

/** 草稿排版與快照分離，過期的非同步排版結果不會覆蓋新決策。 */
export function DraftGraphPreview({
  snapshot,
  graph,
  pendingCount,
}: {
  readonly snapshot: WorkspaceSnapshot
  readonly graph: ReviewGraph
  readonly pendingCount: number
}) {
  const [positioned, setPositioned] = useState<{
    graph: ReviewGraph
    layout: PositionedFlowGraph
    fallback: boolean
  } | null>(null)
  const [selected, setSelected] = useState<SelectedElement>(null)
  const draftSnapshot = useMemo(() => ({ ...snapshot, acceptedGraph: graph }), [snapshot, graph])

  useEffect(() => {
    let cancelled = false
    import('@api-schema-flow/layout')
      .then(({ createElkFlowLayoutEngine }) =>
        createElkFlowLayoutEngine().layout(graph, { direction: 'right' }),
      )
      .then((layout) => {
        if (!cancelled) setPositioned({ graph, layout, fallback: false })
      })
      .catch(() => {
        if (!cancelled)
          setPositioned({
            graph,
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
  }, [graph])

  return (
    <div className="draft-graph-preview">
      <section aria-label="Draft graph summary" className="draft-graph-summary">
        <strong>Review graph preview</strong>
        <ul>
          <li>
            {graph.edges.filter((edge) => edge.provenance === 'declared').length} declared accepted
          </li>
          <li>
            {graph.edges.filter((edge) => edge.provenance === 'inferred').length} inferred accepted
          </li>
          <li>
            {graph.edges.filter((edge) => edge.provenance === 'manual').length} manual accepted
          </li>
          <li>{pendingCount} pending candidates outside the graph</li>
        </ul>
      </section>
      {positioned?.graph === graph ? (
        <>
          {positioned.fallback ? (
            <p>Automatic layout is unavailable. Showing a simple linear preview.</p>
          ) : null}
          <FlowCanvas
            snapshot={draftSnapshot}
            positioned={positioned.layout}
            selected={selected}
            onSelect={setSelected}
            ariaLabel="Review graph preview"
          />
        </>
      ) : (
        <p>Arranging draft topology…</p>
      )}
    </div>
  )
}
