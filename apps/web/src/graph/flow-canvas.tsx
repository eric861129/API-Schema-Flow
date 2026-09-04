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

import type {
  EndpointFlowNode,
  FlowEdge,
  FlowValueSelector,
  FlowValueTarget,
  NormalizedOperation,
} from '@api-schema-flow/domain'
import type { PositionedFlowGraph } from '@api-schema-flow/layout'

import { MethodBadge } from '../components/operations-panel'
import type { SelectedElement, WorkspaceSnapshot } from '../data/types'

interface EndpointData extends Record<string, unknown> {
  readonly operation: NormalizedOperation
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

function selectorLabel(value: FlowValueSelector | FlowValueTarget): string {
  switch (value.kind) {
    case 'request-body':
    case 'response-body':
      return value.pointer.replace(/^#\//, '').split('/').at(-1) ?? value.pointer
    case 'request-header':
    case 'request-query':
    case 'request-path':
    case 'response-header':
    case 'workflow-input':
    case 'path-parameter':
    case 'query-parameter':
    case 'querystring-parameter':
    case 'header-parameter':
    case 'cookie-parameter':
      return value.name
    case 'status-code':
      return 'statusCode'
    case 'literal':
      return String(value.value)
  }
}

function edgeStyle(item: FlowEdge, selected: boolean) {
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

function isEndpointNode(
  node: WorkspaceSnapshot['acceptedGraph']['nodes'][number],
): node is EndpointFlowNode {
  return node.kind === 'endpoint'
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
  const endpointNodes = useMemo(
    () => snapshot.acceptedGraph.nodes.filter(isEndpointNode),
    [snapshot.acceptedGraph.nodes],
  )
  const nodes = useMemo<Node<EndpointData>[]>(
    () =>
      endpointNodes.map((item) => {
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
    [endpointNodes, operationById, positionById, selected, snapshot.acceptedGraph.edges],
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
    [selected, snapshot.acceptedGraph.edges],
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
