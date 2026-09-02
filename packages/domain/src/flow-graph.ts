import type { FlowEdge } from './flow-edge.js'
import type { FlowNode } from './flow-node.js'

export const FLOW_GRAPH_SCHEMA_VERSION = '1.0' as const

export type FlowGraphKind = 'operation-topology' | 'workflow-instance'

export interface FlowGraph {
  readonly schemaVersion: typeof FLOW_GRAPH_SCHEMA_VERSION
  readonly id: string
  readonly kind: FlowGraphKind
  readonly title: string
  readonly sourceIds: readonly string[]
  readonly nodes: readonly FlowNode[]
  readonly edges: readonly FlowEdge[]
}
