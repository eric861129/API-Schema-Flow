import ELK from 'elkjs/lib/elk.bundled.js'

import type { FlowGraph } from '@api-schema-flow/domain'

export type FlowLayoutDirection = 'right' | 'down'

export interface FlowLayoutOptions {
  readonly direction: FlowLayoutDirection
  readonly nodeWidth: number
  readonly nodeHeight: number
  readonly nodeSpacing: number
  readonly layerSpacing: number
}

export interface PositionedFlowNode {
  readonly id: string
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

export interface PositionedFlowEdgeSection {
  readonly startPoint: { readonly x: number; readonly y: number }
  readonly bendPoints: readonly { readonly x: number; readonly y: number }[]
  readonly endPoint: { readonly x: number; readonly y: number }
}

export interface PositionedFlowEdge {
  readonly id: string
  readonly sourceNodeId: string
  readonly targetNodeId: string
  readonly sections: readonly PositionedFlowEdgeSection[]
}

export interface PositionedFlowGraph {
  readonly graphId: string
  readonly width: number
  readonly height: number
  readonly nodes: readonly PositionedFlowNode[]
  readonly edges: readonly PositionedFlowEdge[]
}

export interface FlowLayoutEngine {
  layout(graph: FlowGraph, options?: Partial<FlowLayoutOptions>): Promise<PositionedFlowGraph>
}

export const DEFAULT_FLOW_LAYOUT_OPTIONS: FlowLayoutOptions = {
  direction: 'right',
  nodeWidth: 270,
  nodeHeight: 112,
  nodeSpacing: 52,
  layerSpacing: 108,
}

interface ElkPointResult {
  readonly x?: number
  readonly y?: number
}

interface ElkEdgeSectionResult {
  readonly startPoint?: ElkPointResult
  readonly bendPoints?: readonly ElkPointResult[]
  readonly endPoint?: ElkPointResult
}

interface ElkNodeResult {
  readonly id: string
  readonly x?: number
  readonly y?: number
  readonly width?: number
  readonly height?: number
}

interface ElkEdgeResult {
  readonly id: string
  readonly sources?: readonly string[]
  readonly targets?: readonly string[]
  readonly sections?: readonly ElkEdgeSectionResult[]
}

interface ElkLayoutResult {
  readonly width?: number
  readonly height?: number
  readonly children?: readonly ElkNodeResult[]
  readonly edges?: readonly ElkEdgeResult[]
}

function finite(value: number | undefined, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function createElkFlowLayoutEngine(): FlowLayoutEngine {
  const elk = new ELK()

  return {
    async layout(graph, overrides = {}) {
      const options = { ...DEFAULT_FLOW_LAYOUT_OPTIONS, ...overrides }
      const nodes = [...graph.nodes].sort((left, right) => left.id.localeCompare(right.id))
      const edges = [...graph.edges].sort((left, right) => left.id.localeCompare(right.id))

      if (nodes.length === 0) {
        return { graphId: graph.id, width: 0, height: 0, nodes: [], edges: [] }
      }

      const result = (await elk.layout({
        id: graph.id,
        layoutOptions: {
          'elk.algorithm': 'layered',
          'elk.direction': options.direction === 'right' ? 'RIGHT' : 'DOWN',
          'elk.spacing.nodeNode': String(options.nodeSpacing),
          'elk.layered.spacing.nodeNodeBetweenLayers': String(options.layerSpacing),
          'elk.layered.considerModelOrder.strategy': 'NODES_AND_EDGES',
          'elk.edgeRouting': 'ORTHOGONAL',
        },
        children: nodes.map((node) => ({
          id: node.id,
          width: options.nodeWidth,
          height: options.nodeHeight,
        })),
        edges: edges.map((edge) => ({
          id: edge.id,
          sources: [edge.sourceNodeId],
          targets: [edge.targetNodeId],
        })),
      })) as unknown as ElkLayoutResult

      const positionedNodes = (result.children ?? [])
        .map((node) => ({
          id: node.id,
          x: finite(node.x),
          y: finite(node.y),
          width: finite(node.width, options.nodeWidth),
          height: finite(node.height, options.nodeHeight),
        }))
        .sort((left, right) => left.id.localeCompare(right.id))

      const positionedEdges = (result.edges ?? [])
        .map((edge) => {
          const semantic = edges.find((candidate) => candidate.id === edge.id)
          return {
            id: edge.id,
            sourceNodeId: semantic?.sourceNodeId ?? edge.sources?.[0] ?? '',
            targetNodeId: semantic?.targetNodeId ?? edge.targets?.[0] ?? '',
            sections: (edge.sections ?? []).map((section) => ({
              startPoint: {
                x: finite(section.startPoint?.x),
                y: finite(section.startPoint?.y),
              },
              bendPoints: (section.bendPoints ?? []).map((point) => ({
                x: finite(point.x),
                y: finite(point.y),
              })),
              endPoint: {
                x: finite(section.endPoint?.x),
                y: finite(section.endPoint?.y),
              },
            })),
          }
        })
        .sort((left, right) => left.id.localeCompare(right.id))

      return {
        graphId: graph.id,
        width: finite(result.width),
        height: finite(result.height),
        nodes: positionedNodes,
        edges: positionedEdges,
      }
    },
  }
}
