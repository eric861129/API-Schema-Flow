import { useMemo } from 'react'
import {
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react'

import type { EdgeValue, OperationValue, SelectedElement, WorkspaceSnapshot } from '../data/types'
import { MethodBadge } from '../components/operations-panel'
import type { PositionedFlowGraph } from '@api-schema-flow/layout'

interface EndpointData extends Record<string, unknown> {
  readonly operation: OperationValue
  readonly incoming: number
  readonly outgoing: number
  readonly selected: boolean
}

function EndpointNode({ data }: NodeProps<Node<EndpointData>>) {
  return (
    <article
      className={'endpoint-node' + (data.selected ? ' is-selected' : '')}
      aria-label={data.operation.method.toUpperCase() + ' ' + data.operation.path}
    >
      <Handle type="target" position={Position.Left} isConnectable={false} />
      <div className="endpoint-title">
        <MethodBadge method={data.operation.method} />
        <code>{data.operation.path}</code>
      </div>
      <p>{data.operation.summary ?? data.operation.operationId}</p>
      <footer>
        <span>{data.operation.tags[0] ?? 'Untagged'}</span>
        <span>
          {data.incoming} in · {data.outgoing} out
        </span>
      </footer>
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </article>
  )
}

function selectorLabel(value: Readonly<Record<string, unknown>>): string {
  if (typeof value.pointer === 'string')
    return value.pointer.replace(/^#\//, '').split('/').at(-1) ?? value.pointer
  if (typeof value.name === 'string') return value.name
  return String(value.kind ?? 'value')
}

function edgeStyle(item: EdgeValue, selected: boolean) {
  const base = {
    strokeWidth: selected ? 3 : 2,
    stroke: selected
      ? '#7ee7ef'
      : item.provenance === 'manual'
        ? '#c39cff'
        : item.provenance === 'declared'
          ? '#58d3a3'
          : '#63aef6',
  }
  return item.provenance === 'inferred'
    ? { ...base, strokeDasharray: '8 6' }
    : item.provenance === 'manual'
      ? { ...base, strokeDasharray: '2 5' }
      : base
}

interface FlowCanvasProps {
  readonly snapshot: WorkspaceSnapshot
  readonly positioned: PositionedFlowGraph
  readonly selected: SelectedElement
  readonly onSelect: (selected: SelectedElement) => void
}

export function FlowCanvas({ snapshot, positioned, selected, onSelect }: FlowCanvasProps) {
  const operationById = useMemo(
    () => new Map(snapshot.apiDocument.operations.map((item) => [item.id, item])),
    [snapshot],
  )
  const positionById = useMemo(
    () => new Map(positioned.nodes.map((item) => [item.id, item])),
    [positioned],
  )
  const nodes = useMemo<Node<EndpointData>[]>(
    () =>
      snapshot.acceptedGraph.nodes.map((item) => {
        const operation = operationById.get(item.operationKey)
        if (!operation) throw new Error('Missing operation for graph node ' + item.id)
        const position = positionById.get(item.id) ?? { x: 0, y: 0 }
        return {
          id: item.id,
          type: 'endpoint',
          position: { x: position.x, y: position.y },
          data: {
            operation,
            incoming: snapshot.acceptedGraph.edges.filter((edge) => edge.targetNodeId === item.id)
              .length,
            outgoing: snapshot.acceptedGraph.edges.filter((edge) => edge.sourceNodeId === item.id)
              .length,
            selected: selected?.kind === 'node' && selected.id === item.id,
          },
          draggable: false,
          selectable: true,
        }
      }),
    [operationById, positionById, selected, snapshot],
  )
  const edges = useMemo<Edge[]>(
    () =>
      snapshot.acceptedGraph.edges.map((item) => ({
        id: item.id,
        source: item.sourceNodeId,
        target: item.targetNodeId,
        label: item.mappings[0]
          ? selectorLabel(item.mappings[0].source) + ' → ' + selectorLabel(item.mappings[0].target)
          : item.kind,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: edgeStyle(item, selected?.kind === 'edge' && selected.id === item.id),
        className: 'mapping-edge provenance-' + item.provenance,
        animated: false,
        selectable: true,
      })),
    [selected, snapshot],
  )

  return (
    <section className="canvas-region" aria-label="Accepted API topology">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={{ endpoint: EndpointNode }}
        nodesDraggable={false}
        nodesConnectable={false}
        edgesReconnectable={false}
        deleteKeyCode={null}
        multiSelectionKeyCode={null}
        minZoom={0.3}
        maxZoom={1.8}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        onPaneClick={() => onSelect(null)}
        onNodeClick={(_, node) => onSelect({ kind: 'node', id: node.id })}
        onEdgeClick={(_, edge) => onSelect({ kind: 'edge', id: edge.id })}
      >
        <Background gap={22} size={1} color="#18314a" />
        <Controls showInteractive={false} />
      </ReactFlow>
    </section>
  )
}
