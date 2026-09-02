import {
  ACCEPTED_FLOW_STATUS,
  DECLARED_FLOW_PROVENANCE,
  FLOW_GRAPH_SCHEMA_VERSION,
  type FlowDataMapping,
  type FlowEdge,
  type FlowGraph,
  type FlowGraphKind,
  type FlowNode,
  type FlowValueAlias,
  type SourcePointer,
  type SourceStandardRef,
} from '@api-schema-flow/domain'
import { DIAGNOSTIC_CODES, sortDiagnostics, type Diagnostic } from '@api-schema-flow/diagnostics'

import { canonicalizeJson } from './canonical.js'

export interface AssembleFlowGraphInput {
  readonly id: string
  readonly kind: FlowGraphKind
  readonly title: string
  readonly sourceIds: readonly string[]
  readonly nodes: readonly FlowNode[]
  readonly edges: readonly FlowEdge[]
}

export interface AssembleFlowGraphResult {
  readonly graph: FlowGraph
  readonly diagnostics: readonly Diagnostic[]
}

function sourceKey(source: SourcePointer): string {
  return `${source.uri}\u0000${source.pointer}`
}

function aliasKey(alias: FlowValueAlias): string {
  return `${alias.kind}\u0000${alias.workflowId}\u0000${alias.stepId}\u0000${alias.outputName}`
}

function standardRefKey(reference: SourceStandardRef): string {
  return `${reference.standard}\u0000${sourceKey(reference.source)}`
}

function uniqueByKey<T>(values: readonly T[], keyOf: (value: T) => string): T[] {
  const result = new Map<string, T>()
  for (const value of values) {
    const key = keyOf(value)
    if (!result.has(key)) result.set(key, value)
  }
  return [...result.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, value]) => value)
}

function semanticNode(node: FlowNode): unknown {
  return node
}

function semanticMapping(mapping: FlowDataMapping): unknown {
  return {
    id: mapping.id,
    source: mapping.source,
    target: mapping.target,
    ...(mapping.transform === undefined ? {} : { transform: mapping.transform }),
  }
}

function mergeMappings(
  mappings: readonly FlowDataMapping[],
  diagnostics: Diagnostic[],
): FlowDataMapping[] {
  const groups = new Map<string, FlowDataMapping[]>()
  for (const mapping of mappings) {
    const values = groups.get(mapping.id) ?? []
    values.push(mapping)
    groups.set(mapping.id, values)
  }

  const result: FlowDataMapping[] = []
  for (const [id, group] of [...groups.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    const semanticValues = group.map((mapping) => canonicalizeJson(semanticMapping(mapping)))
    if (new Set(semanticValues).size > 1) {
      diagnostics.push({
        code: DIAGNOSTIC_CODES.FLOW_DECLARED_MAPPING_CONFLICT,
        severity: 'error',
        message: `Declared mapping "${id}" has conflicting semantic definitions.`,
        source: group[0]?.sourcePointers[0],
        details: { mappingId: id },
      })
    }
    const selected = [...group].sort((left, right) =>
      canonicalizeJson(semanticMapping(left)).localeCompare(
        canonicalizeJson(semanticMapping(right)),
      ),
    )[0]!
    result.push({
      ...selected,
      aliases: uniqueByKey(
        group.flatMap(({ aliases }) => aliases),
        aliasKey,
      ),
      sourcePointers: uniqueByKey(
        group.flatMap(({ sourcePointers }) => sourcePointers),
        sourceKey,
      ),
    })
  }
  return result
}

function mergeNodes(nodes: readonly FlowNode[], diagnostics: Diagnostic[]): FlowNode[] {
  const groups = new Map<string, FlowNode[]>()
  for (const node of nodes) {
    const values = groups.get(node.id) ?? []
    values.push(node)
    groups.set(node.id, values)
  }

  const result: FlowNode[] = []
  for (const [id, group] of [...groups.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    const ordered = [...group].sort((left, right) =>
      canonicalizeJson(semanticNode(left)).localeCompare(canonicalizeJson(semanticNode(right))),
    )
    const selected = ordered[0]!
    if (new Set(ordered.map((node) => canonicalizeJson(semanticNode(node)))).size > 1) {
      diagnostics.push({
        code: DIAGNOSTIC_CODES.FLOW_NODE_IDENTITY_CONFLICT,
        severity: 'error',
        message: `Flow node "${id}" has conflicting definitions.`,
        source: selected.source,
        details: { nodeId: id },
      })
    }
    result.push(selected)
  }
  return result
}

function semanticEdge(edge: FlowEdge): unknown {
  return {
    id: edge.id,
    kind: edge.kind,
    sourceNodeId: edge.sourceNodeId,
    targetNodeId: edge.targetNodeId,
    provenance: edge.provenance,
    status: edge.status,
  }
}

function mergeEdges(edges: readonly FlowEdge[], diagnostics: Diagnostic[]): FlowEdge[] {
  const groups = new Map<string, FlowEdge[]>()
  for (const edge of edges) {
    const values = groups.get(edge.id) ?? []
    values.push(edge)
    groups.set(edge.id, values)
  }

  const result: FlowEdge[] = []
  for (const [id, group] of [...groups.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    const ordered = [...group].sort((left, right) =>
      canonicalizeJson(semanticEdge(left)).localeCompare(canonicalizeJson(semanticEdge(right))),
    )
    const selected = ordered[0]!
    if (new Set(ordered.map((edge) => canonicalizeJson(semanticEdge(edge)))).size > 1) {
      diagnostics.push({
        code: DIAGNOSTIC_CODES.FLOW_DECLARED_MAPPING_CONFLICT,
        severity: 'error',
        message: `Flow edge "${id}" has conflicting definitions.`,
        source: selected.sourceStandardRefs[0]?.source,
        details: { edgeId: id },
      })
    }
    result.push({
      ...selected,
      mappings: mergeMappings(
        group.flatMap(({ mappings }) => mappings),
        diagnostics,
      ),
      sourceStandardRefs: uniqueByKey(
        group.flatMap(({ sourceStandardRefs }) => sourceStandardRefs),
        standardRefKey,
      ),
    })
  }
  return result
}

export function assembleFlowGraph(input: AssembleFlowGraphInput): AssembleFlowGraphResult {
  const diagnostics: Diagnostic[] = []
  const nodes = mergeNodes(input.nodes, diagnostics)
  const nodeIds = new Set(nodes.map(({ id }) => id))
  const validEdges: FlowEdge[] = []

  for (const edge of input.edges) {
    if (edge.provenance !== DECLARED_FLOW_PROVENANCE || edge.status !== ACCEPTED_FLOW_STATUS) {
      diagnostics.push({
        code: DIAGNOSTIC_CODES.FLOW_PROJECTION_UNSUPPORTED,
        severity: 'error',
        message: `M2-B accepts only declared, accepted edges; edge "${edge.id}" was omitted.`,
        source: edge.sourceStandardRefs[0]?.source,
        details: { edgeId: edge.id, provenance: edge.provenance, status: edge.status },
      })
      continue
    }
    if (!nodeIds.has(edge.sourceNodeId)) {
      diagnostics.push({
        code: DIAGNOSTIC_CODES.FLOW_ENDPOINT_TARGET_UNRESOLVED,
        severity: 'error',
        message: `Flow edge "${edge.id}" references missing source node "${edge.sourceNodeId}".`,
        source: edge.sourceStandardRefs[0]?.source,
        details: { edgeId: edge.id, nodeId: edge.sourceNodeId, endpoint: 'source' },
      })
      continue
    }
    if (!nodeIds.has(edge.targetNodeId)) {
      diagnostics.push({
        code: DIAGNOSTIC_CODES.FLOW_ENDPOINT_TARGET_UNRESOLVED,
        severity: 'error',
        message: `Flow edge "${edge.id}" references missing target node "${edge.targetNodeId}".`,
        source: edge.sourceStandardRefs[0]?.source,
        details: { edgeId: edge.id, nodeId: edge.targetNodeId, endpoint: 'target' },
      })
      continue
    }
    if (edge.kind === 'data' && edge.mappings.length === 0) {
      diagnostics.push({
        code: DIAGNOSTIC_CODES.FLOW_DATA_MAPPING_INVALID,
        severity: 'error',
        message: `Data edge "${edge.id}" contains no mappings and was omitted.`,
        source: edge.sourceStandardRefs[0]?.source,
        details: { edgeId: edge.id },
      })
      continue
    }
    validEdges.push(edge)
  }

  const graph: FlowGraph = {
    schemaVersion: FLOW_GRAPH_SCHEMA_VERSION,
    id: input.id,
    kind: input.kind,
    title: input.title,
    sourceIds: [...new Set(input.sourceIds)].sort(),
    nodes,
    edges: mergeEdges(validEdges, diagnostics),
  }

  return { graph, diagnostics: sortDiagnostics(diagnostics) }
}
