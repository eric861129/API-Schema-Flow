import { mkdir, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

async function write(path, content) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, content.endsWith('\n') ? content : content + '\n', 'utf8')
}

await rm('.m3a-upload', { recursive: true, force: true })

await write(
  'packages/layout/src/index.ts',
  String.raw`import ELK from 'elkjs/lib/elk.bundled.js'

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

      const result = await elk.layout({
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
      })

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
`,
)

await write(
  'packages/layout/tests/unit/layout.test.ts',
  String.raw`import { describe, expect, test } from 'vitest'

import type { FlowGraph } from '@api-schema-flow/domain'

import { createElkFlowLayoutEngine } from '../../src/index.js'

function graph(nodeIds: string[], pairs: Array<[string, string, string]> = []): FlowGraph {
  return {
    schemaVersion: '1.0',
    id: 'graph:test',
    kind: 'operation-topology',
    title: 'Test graph',
    sourceIds: ['test'],
    nodes: nodeIds.map((id) => ({
      kind: 'endpoint',
      id,
      operationKey: id,
      source: { uri: 'fixture://test', pointer: '#/paths' },
    })),
    edges: pairs.map(([id, sourceNodeId, targetNodeId]) => ({
      id,
      kind: 'data',
      sourceNodeId,
      targetNodeId,
      provenance: 'declared',
      status: 'accepted',
      mappings: [],
      sourceStandardRefs: [],
    })),
  }
}

describe('ELK flow layout', () => {
  test('returns a valid empty layout', async () => {
    const result = await createElkFlowLayoutEngine().layout(graph([]))
    expect(result).toEqual({ graphId: 'graph:test', width: 0, height: 0, nodes: [], edges: [] })
  })

  test('lays out a directed graph deterministically regardless of input order', async () => {
    const engine = createElkFlowLayoutEngine()
    const first = await engine.layout(graph(['b', 'a', 'c'], [['e2', 'b', 'c'], ['e1', 'a', 'b']]))
    const second = await engine.layout(graph(['c', 'b', 'a'], [['e1', 'a', 'b'], ['e2', 'b', 'c']]))
    expect(first).toEqual(second)
    expect(first.nodes.map((node) => node.id)).toEqual(['a', 'b', 'c'])
    expect(first.nodes.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y))).toBe(true)
  })

  test('supports down layout and cycles without throwing', async () => {
    const result = await createElkFlowLayoutEngine().layout(
      graph(['a', 'b'], [['ab', 'a', 'b'], ['ba', 'b', 'a']]),
      { direction: 'down' },
    )
    expect(result.nodes).toHaveLength(2)
    expect(result.edges).toHaveLength(2)
  })
})
`,
)

await write(
  'packages/layout/tests/integration/performance.integration.test.ts',
  String.raw`import { expect, test } from 'vitest'

import type { FlowGraph } from '@api-schema-flow/domain'

import { createElkFlowLayoutEngine } from '../../src/index.js'

test('lays out 500 nodes within the M3-A performance budget', async () => {
  const nodeIds = Array.from({ length: 500 }, (_, index) => 'operation:get:/items/' + index)
  const graph: FlowGraph = {
    schemaVersion: '1.0',
    id: 'graph:performance',
    kind: 'operation-topology',
    title: 'Performance graph',
    sourceIds: ['synthetic'],
    nodes: nodeIds.map((id) => ({
      kind: 'endpoint',
      id,
      operationKey: id,
      source: { uri: 'fixture://performance', pointer: '#/paths' },
    })),
    edges: nodeIds.slice(1).map((targetNodeId, index) => ({
      id: 'edge:' + index,
      kind: 'data',
      sourceNodeId: nodeIds[index] ?? nodeIds[0] ?? '',
      targetNodeId,
      provenance: 'declared',
      status: 'accepted',
      mappings: [],
      sourceStandardRefs: [],
    })),
  }
  const started = performance.now()
  const result = await createElkFlowLayoutEngine().layout(graph)
  expect(result.nodes).toHaveLength(500)
  expect(performance.now() - started).toBeLessThan(5_000)
}, 10_000)
`,
)

await write(
  'tooling/scripts/generate-web-workspace.mjs',
  String.raw`import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export const outputPath = resolve(root, 'apps/web/public/fixtures/reservation-workspace.json')

const sourceUri = 'fixture://reservation/openapi.yaml'
const operation = (method, path, operationId, summary, tag, request = null, responses = []) => ({
  id: 'operation:' + method + ':' + path,
  method,
  path,
  operationId,
  summary,
  tags: [tag],
  parameters: request?.parameters ?? [],
  requestBody: request?.requestBody,
  responses,
  security: path === '/auth/login' ? [] : [{ requirementIndex: 0, schemeName: 'bearerAuth', scopes: [] }],
  servers: [],
  source: { uri: sourceUri, pointer: '#/paths/' + path.replaceAll('/', '~1') + '/' + method },
})

const operations = [
  operation('post', '/auth/login', 'login', 'Sign in and receive an access token', 'Auth', {
    requestBody: { required: true, mediaTypes: [{ mediaType: 'application/json', schema: { type: 'object', properties: { username: { type: 'string' }, password: { type: 'string', writeOnly: true } }, required: ['username', 'password'] } }] },
  }, [{ statusCode: '200', description: 'Authenticated', mediaTypes: [{ mediaType: 'application/json', schema: { type: 'object', properties: { token: { type: 'string' } } } }], headers: [], links: [] }]),
  operation('get', '/spaces/available', 'listAvailableSpaces', 'List spaces that can be reserved', 'Spaces', null, [{ statusCode: '200', description: 'Available spaces', mediaTypes: [{ mediaType: 'application/json', schema: { type: 'array', items: { type: 'object', properties: { spaceId: { type: 'string' }, name: { type: 'string' } } } } }], headers: [], links: [] }]),
  operation('post', '/reservations', 'createReservation', 'Create a reservation', 'Reservations', {
    requestBody: { required: true, mediaTypes: [{ mediaType: 'application/json', schema: { type: 'object', properties: { spaceId: { type: 'string' }, startsAt: { type: 'string', format: 'date-time' } }, required: ['spaceId'] } }] },
  }, [{ statusCode: '201', description: 'Reservation created', mediaTypes: [{ mediaType: 'application/json', schema: { type: 'object', properties: { reservationId: { type: 'string' }, status: { type: 'string' } } } }], headers: [], links: [] }]),
  operation('get', '/reservations/{id}', 'getReservation', 'Get one reservation', 'Reservations', {
    parameters: [{ name: 'id', location: 'path', required: true, schema: { type: 'string' }, source: { uri: sourceUri, pointer: '#/paths/~1reservations~1{id}/get/parameters/0' } }],
  }, [{ statusCode: '200', description: 'Reservation found', mediaTypes: [{ mediaType: 'application/json', schema: { type: 'object', properties: { reservationId: { type: 'string' }, status: { type: 'string' } } } }], headers: [], links: [] }]),
]

const node = (operationKey, pointer) => ({
  kind: 'endpoint',
  id: operationKey,
  operationKey,
  source: { uri: sourceUri, pointer },
})

const mapping = (id, source, target) => ({ id, source, target })
const edge = (id, sourceNodeId, targetNodeId, provenance, map, evidenceRuleIds) => ({
  id,
  kind: 'data',
  sourceNodeId,
  targetNodeId,
  provenance,
  status: 'accepted',
  mappings: [map],
  sourceStandardRefs: provenance === 'declared' ? [{ standard: 'openapi-link', source: { uri: sourceUri, pointer: '#/paths' } }] : [],
  review: provenance === 'declared' ? undefined : { action: provenance === 'manual' ? 'edit' : 'accept', candidateId: 'candidate:' + id, evidenceRuleIds },
})

export function buildReservationSnapshot() {
  const graphNodes = operations.map((item) => node(item.id, item.source.pointer))
  const graphEdges = [
    edge('edge:token-to-auth', operations[0].id, operations[1].id, 'inferred', mapping('mapping:token-to-auth', { kind: 'response-body', pointer: '#/token' }, { kind: 'operation-parameter', operationKey: operations[1].id, location: 'header', name: 'Authorization' }), ['INF-AUTH-BEARER', 'INF-SCHEMA-TYPE']),
    edge('edge:space-to-reservation', operations[1].id, operations[2].id, 'manual', mapping('mapping:space-to-reservation', { kind: 'response-body', pointer: '#/0/spaceId' }, { kind: 'request-body', operationKey: operations[2].id, pointer: '#/spaceId' }), ['INF-RESOURCE-ID', 'INF-SCHEMA-TYPE']),
    edge('edge:reservation-to-get', operations[2].id, operations[3].id, 'declared', mapping('mapping:reservation-to-get', { kind: 'response-body', pointer: '#/reservationId' }, { kind: 'operation-parameter', operationKey: operations[3].id, location: 'path', name: 'id' }), ['OPENAPI-LINK']),
  ]

  return {
    schemaVersion: '1.0',
    generatedBy: { package: 'api-schema-flow', milestone: 'M3-A' },
    project: { name: 'Reservation System', sourceName: 'Reservation API', sourceUri, openapiVersion: '3.1.0' },
    apiDocument: { schemaVersion: '1.0', sourceUri, openapiVersion: '3.1.0', compatibilityMode: false, info: { title: 'Reservation API', version: '1.0.0', description: 'Canonical read-only workspace fixture.' }, tags: ['Auth', 'Reservations', 'Spaces'], servers: [], operations, componentSchemas: [] },
    acceptedGraph: { schemaVersion: '1.0', id: 'graph:reservation', kind: 'operation-topology', title: 'Reservation API topology', sourceIds: [sourceUri], nodes: graphNodes, edges: graphEdges },
    inferenceCandidates: graphEdges.filter((item) => item.provenance !== 'declared').map((item) => ({ id: item.review.candidateId, fingerprint: item.id, ruleSetVersion: 'm2c-v1', sourceOperationKey: item.sourceNodeId, targetOperationKey: item.targetNodeId, source: item.mappings[0].source, target: item.mappings[0].target, score: 92, confidence: 0.92, band: 'high', evidence: item.review.evidenceRuleIds.map((ruleId) => ({ ruleId, kind: 'positive', weight: 20, summary: ruleId, sourcePointers: [], details: {} })), blockers: [], provenance: 'inferred', status: 'candidate' })),
    reviewOutcomes: graphEdges.filter((item) => item.review).map((item) => ({ decisionId: 'decision:' + item.id, state: 'applied', candidateId: item.review.candidateId, action: item.review.action, edgeId: item.id, diagnostics: [] })),
    diagnostics: [],
  }
}

function sortValue(value) {
  if (Array.isArray(value)) {
    const items = value.map(sortValue)
    if (items.every((item) => item && typeof item === 'object' && typeof item.id === 'string')) {
      return items.toSorted((left, right) => left.id.localeCompare(right.id))
    }
    return items
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, sortValue(item)]))
  }
  return value
}

export function serializeSnapshot(snapshot) {
  const text = JSON.stringify(sortValue(snapshot), null, 2) + '\n'
  if (/synthetic-jwt-token|synthetic-password|Bearer\s+[A-Za-z0-9._~-]{12,}/i.test(text)) throw new Error('Representative secret found in workspace fixture')
  if (/(?:\/Users\/|\/home\/runner\/|[A-Za-z]:\\\\Users\\\\)/.test(text)) throw new Error('Absolute local path found in workspace fixture')
  return text
}

export async function generateReservationWorkspace(target = outputPath) {
  const source = await readFile(resolve(root, 'fixtures/review/reservation/openapi.yaml'), 'utf8')
  for (const endpoint of ['/auth/login', '/spaces/available', '/reservations']) {
    if (!source.includes(endpoint)) throw new Error('Canonical source no longer contains ' + endpoint)
  }
  const text = serializeSnapshot(buildReservationSnapshot())
  await writeFile(target, text, 'utf8')
  return text
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await generateReservationWorkspace()
  console.log('Generated ' + outputPath)
}
`,
)

await write(
  'tooling/scripts/check-web-workspace.mjs',
  String.raw`import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { generateReservationWorkspace, outputPath } from './generate-web-workspace.mjs'

const directory = await mkdtemp(join(tmpdir(), 'api-schema-flow-web-fixture-'))
const candidate = join(directory, 'reservation-workspace.json')
try {
  await generateReservationWorkspace(candidate)
  const [expected, actual] = await Promise.all([readFile(outputPath), readFile(candidate)])
  if (!expected.equals(actual)) {
    throw new Error('Web fixture drift detected. Run: pnpm generate:web-fixture')
  }
  console.log('Web workspace fixture is deterministic and current.')
} finally {
  await rm(directory, { recursive: true, force: true })
}
`,
)

await write(
  'tooling/scripts/check-web-bundle.mjs',
  String.raw`import { readdir, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const directory = resolve(process.argv[2] ?? 'apps/web/dist')
const forbidden = /node:(?:fs|path|os|crypto|http|https)|@api-schema-flow\/(?:openapi|arazzo|source-loader|inference|review|exporter-arazzo|cli|mock-runtime|execution)|\brequire\(['"](?:fs|path|os|crypto)['"]\)/

async function walk(path) {
  const entries = await readdir(path, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const child = join(path, entry.name)
    if (entry.isDirectory()) files.push(...await walk(child))
    else if (entry.isFile() && /\.(?:js|mjs|html)$/.test(entry.name)) files.push(child)
  }
  return files
}

for (const file of await walk(directory)) {
  const content = await readFile(file, 'utf8')
  if (forbidden.test(content)) throw new Error('Forbidden browser dependency marker in ' + file)
}
console.log('Web bundle contains no prohibited Node-only dependency markers.')
`,
)

await write(
  'apps/web/src/data/types.ts',
  String.raw`export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options' | 'trace'

export interface SourcePointer { readonly uri: string; readonly pointer: string }
export interface SchemaValue { readonly type?: string; readonly format?: string; readonly properties?: Readonly<Record<string, SchemaValue>>; readonly items?: SchemaValue; readonly required?: readonly string[]; readonly readOnly?: boolean; readonly writeOnly?: boolean }
export interface ParameterValue { readonly name: string; readonly location: string; readonly required: boolean; readonly schema?: SchemaValue; readonly source?: SourcePointer }
export interface MediaValue { readonly mediaType: string; readonly schema?: SchemaValue }
export interface ResponseValue { readonly statusCode: string; readonly description?: string; readonly mediaTypes: readonly MediaValue[]; readonly headers: readonly unknown[]; readonly links: readonly unknown[] }
export interface OperationValue { readonly id: string; readonly method: HttpMethod; readonly path: string; readonly operationId?: string; readonly summary?: string; readonly tags: readonly string[]; readonly parameters: readonly ParameterValue[]; readonly requestBody?: { readonly required: boolean; readonly mediaTypes: readonly MediaValue[] }; readonly responses: readonly ResponseValue[]; readonly security: readonly unknown[]; readonly source: SourcePointer }
export interface EndpointNodeValue { readonly kind: 'endpoint'; readonly id: string; readonly operationKey: string; readonly source: SourcePointer }
export interface MappingValue { readonly id: string; readonly source: Readonly<Record<string, unknown>>; readonly target: Readonly<Record<string, unknown>> }
export interface EdgeReviewValue { readonly action: 'accept' | 'edit'; readonly candidateId: string; readonly evidenceRuleIds: readonly string[] }
export interface EdgeValue { readonly id: string; readonly kind: string; readonly sourceNodeId: string; readonly targetNodeId: string; readonly provenance: 'declared' | 'inferred' | 'manual'; readonly status: 'accepted'; readonly mappings: readonly MappingValue[]; readonly sourceStandardRefs: readonly unknown[]; readonly review?: EdgeReviewValue }
export interface DiagnosticValue { readonly code: string; readonly severity: 'info' | 'warning' | 'error'; readonly message: string; readonly source?: SourcePointer }
export interface WorkspaceSnapshot { readonly schemaVersion: '1.0'; readonly project: { readonly name: string; readonly sourceName: string; readonly sourceUri: string; readonly openapiVersion: string }; readonly apiDocument: { readonly operations: readonly OperationValue[] }; readonly acceptedGraph: { readonly id: string; readonly nodes: readonly EndpointNodeValue[]; readonly edges: readonly EdgeValue[] }; readonly inferenceCandidates: readonly unknown[]; readonly reviewOutcomes: readonly unknown[]; readonly diagnostics: readonly DiagnosticValue[] }
export type SelectedElement = { readonly kind: 'node' | 'edge'; readonly id: string } | null
`,
)

await write(
  'apps/web/src/data/load-workspace.ts',
  String.raw`import type { WorkspaceSnapshot } from './types'

export class WorkspaceLoadError extends Error {
  constructor(readonly code: 'network' | 'invalid-json' | 'unsupported' | 'invalid-shape', message: string) {
    super(message)
    this.name = 'WorkspaceLoadError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export async function loadWorkspaceSnapshot(url = '/fixtures/reservation-workspace.json', fetcher: typeof fetch = fetch): Promise<WorkspaceSnapshot> {
  let response: Response
  try { response = await fetcher(url) } catch { throw new WorkspaceLoadError('network', 'The Reservation workspace could not be loaded. Check the local server and retry.') }
  if (!response.ok) throw new WorkspaceLoadError('network', 'The Reservation workspace returned HTTP ' + response.status + '.')
  let value: unknown
  try { value = await response.json() } catch { throw new WorkspaceLoadError('invalid-json', 'The workspace fixture is not valid JSON.') }
  if (!isRecord(value)) throw new WorkspaceLoadError('invalid-shape', 'The workspace fixture root must be an object.')
  if (value.schemaVersion !== '1.0') throw new WorkspaceLoadError('unsupported', 'This build supports workspace snapshot 1.0, but received ' + String(value.schemaVersion) + '.')
  if (!isRecord(value.apiDocument) || !Array.isArray(value.apiDocument.operations) || !isRecord(value.acceptedGraph) || !Array.isArray(value.acceptedGraph.nodes) || !Array.isArray(value.acceptedGraph.edges)) {
    throw new WorkspaceLoadError('invalid-shape', 'The workspace fixture is missing operations or graph data.')
  }
  return value as unknown as WorkspaceSnapshot
}
`,
)

await write(
  'apps/web/src/workspace/operation-view-model.ts',
  String.raw`import type { EdgeValue, HttpMethod, OperationValue, WorkspaceSnapshot } from '../data/types'

export interface OperationViewModel {
  readonly nodeId: string
  readonly operation: OperationValue
  readonly tag: string
  readonly incoming: number
  readonly outgoing: number
}

export interface OperationFilters { readonly query: string; readonly methods: readonly HttpMethod[] }

export function buildOperationViewModels(snapshot: WorkspaceSnapshot): readonly OperationViewModel[] {
  const edges = snapshot.acceptedGraph.edges
  const nodeByOperation = new Map(snapshot.acceptedGraph.nodes.map((node) => [node.operationKey, node.id]))
  return snapshot.apiDocument.operations.map((operation) => {
    const nodeId = nodeByOperation.get(operation.id) ?? operation.id
    return {
      nodeId,
      operation,
      tag: operation.tags[0] ?? 'Untagged',
      incoming: edges.filter((edge: EdgeValue) => edge.targetNodeId === nodeId).length,
      outgoing: edges.filter((edge: EdgeValue) => edge.sourceNodeId === nodeId).length,
    }
  }).toSorted((left, right) => left.tag.localeCompare(right.tag) || left.operation.path.localeCompare(right.operation.path) || left.operation.method.localeCompare(right.operation.method))
}

export function filterOperationViewModels(models: readonly OperationViewModel[], filters: OperationFilters): readonly OperationViewModel[] {
  const query = filters.query.trim().toLocaleLowerCase()
  const methods = new Set(filters.methods)
  return models.filter((model) => {
    const searchable = [model.operation.path, model.operation.operationId ?? '', model.operation.summary ?? ''].join(' ').toLocaleLowerCase()
    return (query.length === 0 || searchable.includes(query)) && (methods.size === 0 || methods.has(model.operation.method))
  })
}

export function groupOperationViewModels(models: readonly OperationViewModel[]): ReadonlyMap<string, readonly OperationViewModel[]> {
  const groups = new Map<string, OperationViewModel[]>()
  for (const model of models) groups.set(model.tag, [...(groups.get(model.tag) ?? []), model])
  return new Map([...groups.entries()].sort(([left], [right]) => left.localeCompare(right)))
}
`,
)

await write(
  'apps/web/src/components/operations-panel.tsx',
  String.raw`import type { KeyboardEvent } from 'react'

import type { HttpMethod } from '../data/types'
import { filterOperationViewModels, groupOperationViewModels, type OperationViewModel } from '../workspace/operation-view-model'

const methods: readonly HttpMethod[] = ['get', 'post', 'put', 'patch', 'delete']

interface OperationsPanelProps {
  readonly models: readonly OperationViewModel[]
  readonly query: string
  readonly activeMethods: readonly HttpMethod[]
  readonly selectedNodeId: string | null
  readonly onQueryChange: (query: string) => void
  readonly onMethodsChange: (methods: readonly HttpMethod[]) => void
  readonly onSelect: (nodeId: string) => void
  readonly onCollapse: () => void
}

export function MethodBadge({ method }: { readonly method: HttpMethod }) {
  return <span className={'method-badge method-' + method}><span aria-hidden="true">◆</span>{method.toUpperCase()}</span>
}

export function OperationsPanel(props: OperationsPanelProps) {
  const visible = filterOperationViewModels(props.models, { query: props.query, methods: props.activeMethods })
  const groups = groupOperationViewModels(visible)

  function toggle(method: HttpMethod) {
    props.onMethodsChange(props.activeMethods.includes(method) ? props.activeMethods.filter((item) => item !== method) : [...props.activeMethods, method])
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowDown', 'ArrowUp'].includes(event.key)) return
    const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[data-operation-row]')]
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement)
    const next = event.key === 'ArrowDown' ? Math.min(buttons.length - 1, current + 1) : Math.max(0, current - 1)
    buttons[next]?.focus()
    event.preventDefault()
  }

  return (
    <aside className="operations-panel" aria-label="API operations">
      <header className="panel-heading"><div><span className="eyebrow">OPERATIONS</span><strong>{visible.length} visible</strong></div><button className="icon-button" onClick={props.onCollapse} aria-label="Collapse operations panel">‹</button></header>
      <label className="search-field"><span className="sr-only">Search operations</span><span aria-hidden="true">⌕</span><input value={props.query} onChange={(event) => props.onQueryChange(event.target.value)} placeholder="Search path or operation ID" /></label>
      <div className="method-filters" aria-label="Filter by HTTP method">
        {methods.map((method) => <button key={method} aria-pressed={props.activeMethods.includes(method)} onClick={() => toggle(method)}>{method.toUpperCase()}</button>)}
      </div>
      <div className="operation-list" onKeyDown={handleKeyDown}>
        {visible.length === 0 ? <div className="empty-filter"><strong>No matching operations</strong><p>Clear the search or method filters to restore the topology.</p><button onClick={() => { props.onQueryChange(''); props.onMethodsChange([]) }}>Clear filters</button></div> : null}
        {[...groups.entries()].map(([tag, items]) => <section key={tag} aria-labelledby={'tag-' + tag}><h2 id={'tag-' + tag}>{tag}</h2>{items.map((model) => <button data-operation-row key={model.nodeId} className="operation-row" aria-pressed={props.selectedNodeId === model.nodeId} onClick={() => props.onSelect(model.nodeId)}><MethodBadge method={model.operation.method} /><span className="operation-copy"><code>{model.operation.path}</code><small>{model.operation.summary ?? model.operation.operationId}</small></span><span className="connection-count" aria-label={model.incoming + ' incoming and ' + model.outgoing + ' outgoing relationships'}>{model.incoming}↓ {model.outgoing}↑</span></button>)}</section>)}
      </div>
    </aside>
  )
}
`,
)

await write(
  'apps/web/src/graph/flow-canvas.tsx',
  String.raw`import { useMemo } from 'react'
import { Background, Controls, Handle, MarkerType, Position, ReactFlow, type Edge, type Node, type NodeProps } from '@xyflow/react'

import type { EdgeValue, OperationValue, SelectedElement, WorkspaceSnapshot } from '../data/types'
import { MethodBadge } from '../components/operations-panel'
import type { PositionedFlowGraph } from '@api-schema-flow/layout'

interface EndpointData extends Record<string, unknown> { readonly operation: OperationValue; readonly incoming: number; readonly outgoing: number; readonly selected: boolean }

function EndpointNode({ data }: NodeProps<Node<EndpointData>>) {
  return <article className={'endpoint-node' + (data.selected ? ' is-selected' : '')} aria-label={data.operation.method.toUpperCase() + ' ' + data.operation.path}><Handle type="target" position={Position.Left} isConnectable={false} /><div className="endpoint-title"><MethodBadge method={data.operation.method} /><code>{data.operation.path}</code></div><p>{data.operation.summary ?? data.operation.operationId}</p><footer><span>{data.operation.tags[0] ?? 'Untagged'}</span><span>{data.incoming} in · {data.outgoing} out</span></footer><Handle type="source" position={Position.Right} isConnectable={false} /></article>
}

function selectorLabel(value: Readonly<Record<string, unknown>>): string {
  if (typeof value.pointer === 'string') return value.pointer.replace(/^#\//, '').split('/').at(-1) ?? value.pointer
  if (typeof value.name === 'string') return value.name
  return String(value.kind ?? 'value')
}

function edgeStyle(item: EdgeValue, selected: boolean) {
  const base = { strokeWidth: selected ? 3 : 2, stroke: selected ? '#7ee7ef' : item.provenance === 'manual' ? '#c39cff' : item.provenance === 'declared' ? '#58d3a3' : '#63aef6' }
  return item.provenance === 'inferred' ? { ...base, strokeDasharray: '8 6' } : item.provenance === 'manual' ? { ...base, strokeDasharray: '2 5' } : base
}

interface FlowCanvasProps { readonly snapshot: WorkspaceSnapshot; readonly positioned: PositionedFlowGraph; readonly selected: SelectedElement; readonly onSelect: (selected: SelectedElement) => void }

export function FlowCanvas({ snapshot, positioned, selected, onSelect }: FlowCanvasProps) {
  const operationById = useMemo(() => new Map(snapshot.apiDocument.operations.map((item) => [item.id, item])), [snapshot])
  const positionById = useMemo(() => new Map(positioned.nodes.map((item) => [item.id, item])), [positioned])
  const nodes = useMemo<Node<EndpointData>[]>(() => snapshot.acceptedGraph.nodes.map((item) => {
    const operation = operationById.get(item.operationKey)
    if (!operation) throw new Error('Missing operation for graph node ' + item.id)
    const position = positionById.get(item.id) ?? { x: 0, y: 0 }
    return { id: item.id, type: 'endpoint', position: { x: position.x, y: position.y }, data: { operation, incoming: snapshot.acceptedGraph.edges.filter((edge) => edge.targetNodeId === item.id).length, outgoing: snapshot.acceptedGraph.edges.filter((edge) => edge.sourceNodeId === item.id).length, selected: selected?.kind === 'node' && selected.id === item.id }, draggable: false, selectable: true }
  }), [operationById, positionById, selected, snapshot])
  const edges = useMemo<Edge[]>(() => snapshot.acceptedGraph.edges.map((item) => ({ id: item.id, source: item.sourceNodeId, target: item.targetNodeId, label: item.mappings[0] ? selectorLabel(item.mappings[0].source) + ' → ' + selectorLabel(item.mappings[0].target) : item.kind, markerEnd: { type: MarkerType.ArrowClosed }, style: edgeStyle(item, selected?.kind === 'edge' && selected.id === item.id), className: 'mapping-edge provenance-' + item.provenance, animated: false, selectable: true })), [selected, snapshot])

  return <section className="canvas-region" aria-label="Accepted API topology"><ReactFlow nodes={nodes} edges={edges} nodeTypes={{ endpoint: EndpointNode }} nodesDraggable={false} nodesConnectable={false} edgesReconnectable={false} deleteKeyCode={null} multiSelectionKeyCode={null} minZoom={0.3} maxZoom={1.8} fitView fitViewOptions={{ padding: 0.2 }} onPaneClick={() => onSelect(null)} onNodeClick={(_, node) => onSelect({ kind: 'node', id: node.id })} onEdgeClick={(_, edge) => onSelect({ kind: 'edge', id: edge.id })}><Background gap={22} size={1} color="#18314a" /><Controls showInteractive={false} /></ReactFlow></section>
}
`,
)

await write(
  'apps/web/src/inspector/inspector-panel.tsx',
  String.raw`import type { EdgeValue, OperationValue, SchemaValue, SelectedElement, WorkspaceSnapshot } from '../data/types'
import { MethodBadge } from '../components/operations-panel'

function schemaText(schema: SchemaValue | undefined): string {
  if (!schema) return 'No schema declared'
  if (schema.type === 'array') return 'array of ' + schemaText(schema.items)
  const properties = Object.keys(schema.properties ?? {})
  return properties.length > 0 ? (schema.type ?? 'object') + ' · ' + properties.join(', ') : schema.format ? (schema.type ?? 'value') + ' · ' + schema.format : schema.type ?? 'unknown'
}

function selectorText(value: Readonly<Record<string, unknown>>): string {
  if (typeof value.pointer === 'string') return String(value.kind) + ' ' + value.pointer
  if (typeof value.name === 'string') return String(value.location ?? value.kind) + '.' + value.name
  return String(value.kind ?? 'value')
}

function NodeInspector({ operation, snapshot, onSelect }: { readonly operation: OperationValue; readonly snapshot: WorkspaceSnapshot; readonly onSelect: (selected: SelectedElement) => void }) {
  const node = snapshot.acceptedGraph.nodes.find((item) => item.operationKey === operation.id)
  const connections = snapshot.acceptedGraph.edges.filter((edge) => edge.sourceNodeId === node?.id || edge.targetNodeId === node?.id)
  return <><div className="inspector-title"><MethodBadge method={operation.method} /><code>{operation.path}</code></div><p className="inspector-summary">{operation.summary ?? operation.operationId}</p><section><h3>Overview</h3><dl><div><dt>Operation ID</dt><dd>{operation.operationId ?? 'Not declared'}</dd></div><div><dt>Tags</dt><dd>{operation.tags.join(', ') || 'Untagged'}</dd></div><div><dt>Security</dt><dd>{operation.security.length > 0 ? 'Required' : 'Public'}</dd></div><div><dt>Source</dt><dd><code>{operation.source.pointer}</code></dd></div></dl></section><section><h3>Request</h3>{operation.parameters.length === 0 && !operation.requestBody ? <p className="muted">No request payload.</p> : null}{operation.parameters.map((parameter) => <div className="schema-line" key={parameter.location + parameter.name}><strong>{parameter.location}.{parameter.name}</strong><span>{schemaText(parameter.schema)}</span></div>)}{operation.requestBody?.mediaTypes.map((media) => <div className="schema-line" key={media.mediaType}><strong>{media.mediaType}</strong><span>{schemaText(media.schema)}</span></div>)}</section><section><h3>Responses</h3>{operation.responses.map((response) => <div className="response-line" key={response.statusCode}><strong>{response.statusCode}</strong><span>{response.description}</span><small>{response.mediaTypes.map((media) => schemaText(media.schema)).join(' · ')}</small></div>)}</section><section><h3>Connections</h3>{connections.length === 0 ? <p className="muted">No accepted relationships.</p> : connections.map((edge) => <button className="connection-row" key={edge.id} onClick={() => onSelect({ kind: 'edge', id: edge.id })}><span>{edge.sourceNodeId === node?.id ? 'Outgoing' : 'Incoming'}</span><strong>{edge.mappings[0] ? selectorText(edge.mappings[0].source) + ' → ' + selectorText(edge.mappings[0].target) : edge.kind}</strong><small>{edge.provenance}</small></button>)}</section></>
}

function EdgeInspector({ edge, snapshot }: { readonly edge: EdgeValue; readonly snapshot: WorkspaceSnapshot }) {
  const operationByNode = new Map(snapshot.acceptedGraph.nodes.map((node) => [node.id, snapshot.apiDocument.operations.find((operation) => operation.id === node.operationKey)]))
  const source = operationByNode.get(edge.sourceNodeId)
  const target = operationByNode.get(edge.targetNodeId)
  return <><div className="edge-heading"><span className={'provenance-token provenance-' + edge.provenance}>{edge.provenance === 'inferred' ? 'Accepted inferred' : edge.provenance === 'manual' ? 'Manual' : 'Declared'}</span><span className="accepted-token">Accepted</span></div><section><h3>Source</h3><strong>{source?.method.toUpperCase()} {source?.path}</strong><code className="block-code">{edge.mappings[0] ? selectorText(edge.mappings[0].source) : 'No mapping'}</code></section><section><h3>Target</h3><strong>{target?.method.toUpperCase()} {target?.path}</strong><code className="block-code">{edge.mappings[0] ? selectorText(edge.mappings[0].target) : 'No mapping'}</code></section><section><h3>Review evidence</h3>{edge.review ? <><dl><div><dt>Action</dt><dd>{edge.review.action}</dd></div><div><dt>Candidate</dt><dd><code>{edge.review.candidateId}</code></dd></div></dl><ul className="evidence-list">{edge.review.evidenceRuleIds.map((rule) => <li key={rule}>✓ {rule}</li>)}</ul></> : <p className="muted">Declared by the source specification.</p>}</section><section><h3>Relationship ID</h3><code className="block-code">{edge.id}</code></section></>
}

export function InspectorPanel({ snapshot, selected, onClose, onSelect }: { readonly snapshot: WorkspaceSnapshot; readonly selected: Exclude<SelectedElement, null>; readonly onClose: () => void; readonly onSelect: (selected: SelectedElement) => void }) {
  const node = selected.kind === 'node' ? snapshot.acceptedGraph.nodes.find((item) => item.id === selected.id) : undefined
  const operation = node ? snapshot.apiDocument.operations.find((item) => item.id === node.operationKey) : undefined
  const edge = selected.kind === 'edge' ? snapshot.acceptedGraph.edges.find((item) => item.id === selected.id) : undefined
  return <aside className="inspector-panel" aria-label={selected.kind === 'node' ? 'Endpoint inspector' : 'Relationship inspector'}><header className="panel-heading"><div><span className="eyebrow">INSPECTOR</span><strong>{selected.kind === 'node' ? 'Endpoint' : 'Relationship'}</strong></div><button className="icon-button" onClick={onClose} aria-label="Close inspector">×</button></header><div className="inspector-scroll">{operation ? <NodeInspector operation={operation} snapshot={snapshot} onSelect={onSelect} /> : edge ? <EdgeInspector edge={edge} snapshot={snapshot} /> : <p>Selection is no longer available.</p>}</div></aside>
}
`,
)

await write(
  'apps/web/src/outline/outline-view.tsx',
  String.raw`import type { SelectedElement, WorkspaceSnapshot } from '../data/types'
import type { OperationViewModel } from '../workspace/operation-view-model'
import { MethodBadge } from '../components/operations-panel'

function short(value: Readonly<Record<string, unknown>>): string { return typeof value.pointer === 'string' ? value.pointer : typeof value.name === 'string' ? String(value.location ?? value.kind) + '.' + value.name : String(value.kind ?? 'value') }

export function OutlineView({ snapshot, models, onSelect }: { readonly snapshot: WorkspaceSnapshot; readonly models: readonly OperationViewModel[]; readonly onSelect: (selected: SelectedElement) => void }) {
  const operationByNode = new Map(snapshot.acceptedGraph.nodes.map((node) => [node.id, snapshot.apiDocument.operations.find((operation) => operation.id === node.operationKey)]))
  return <section className="outline-view" aria-labelledby="outline-title"><header><span className="eyebrow">ACCESSIBLE ALTERNATIVE</span><h1 id="outline-title">Operation and relationship outline</h1><p>The tables contain the same accepted topology shown on the canvas.</p></header><div className="table-shell"><table><caption>API operations</caption><thead><tr><th>Method</th><th>Path</th><th>Tag</th><th>Incoming</th><th>Outgoing</th></tr></thead><tbody>{models.map((model) => <tr key={model.nodeId}><td><MethodBadge method={model.operation.method} /></td><td><button className="table-link" onClick={() => onSelect({ kind: 'node', id: model.nodeId })}>{model.operation.path}</button></td><td>{model.tag}</td><td>{model.incoming}</td><td>{model.outgoing}</td></tr>)}</tbody></table></div><div className="table-shell"><table><caption>Accepted data mappings</caption><thead><tr><th>Source</th><th>Selector</th><th>Target</th><th>Target field</th><th>Provenance</th></tr></thead><tbody>{snapshot.acceptedGraph.edges.map((edge) => <tr key={edge.id}><td>{operationByNode.get(edge.sourceNodeId)?.path}</td><td><code>{edge.mappings[0] ? short(edge.mappings[0].source) : '—'}</code></td><td>{operationByNode.get(edge.targetNodeId)?.path}</td><td><button className="table-link" onClick={() => onSelect({ kind: 'edge', id: edge.id })}><code>{edge.mappings[0] ? short(edge.mappings[0].target) : '—'}</code></button></td><td><span className={'provenance-token provenance-' + edge.provenance}>{edge.provenance}</span></td></tr>)}</tbody></table></div></section>
}
`,
)

await write(
  'apps/web/src/diagnostics/diagnostics-drawer.tsx',
  String.raw`import type { WorkspaceSnapshot } from '../data/types'

export function DiagnosticsDrawer({ snapshot, open, onToggle }: { readonly snapshot: WorkspaceSnapshot; readonly open: boolean; readonly onToggle: () => void }) {
  const blocking = snapshot.diagnostics.filter((item) => item.severity === 'error').length
  return <section className={'diagnostics-drawer' + (open ? ' is-open' : '')} aria-label="Workspace diagnostics"><button className="diagnostics-summary" onClick={onToggle} aria-expanded={open}><span className="ready-dot" aria-hidden="true" />Ready · {snapshot.apiDocument.operations.length} operations · {snapshot.acceptedGraph.edges.length} accepted relationships · {blocking} blocking errors<span aria-hidden="true">{open ? '⌄' : '⌃'}</span></button>{open ? <div className="diagnostics-content">{snapshot.diagnostics.length === 0 ? <p>No diagnostics were reported for this workspace.</p> : snapshot.diagnostics.toSorted((left, right) => left.severity.localeCompare(right.severity) || left.code.localeCompare(right.code)).map((item) => <article key={item.code + item.message}><strong>{item.severity.toUpperCase()} · {item.code}</strong><p>{item.message}</p>{item.source ? <code>{item.source.uri}{item.source.pointer}</code> : null}</article>)}</div> : null}</section>
}
`,
)

await write(
  'apps/web/src/app.tsx',
  String.raw`import { useEffect, useMemo, useState } from 'react'
import '@xyflow/react/dist/style.css'

import type { FlowLayoutDirection, PositionedFlowGraph } from '@api-schema-flow/layout'

import { OperationsPanel } from './components/operations-panel'
import { DiagnosticsDrawer } from './diagnostics/diagnostics-drawer'
import { loadWorkspaceSnapshot, WorkspaceLoadError } from './data/load-workspace'
import type { HttpMethod, SelectedElement, WorkspaceSnapshot } from './data/types'
import { FlowCanvas } from './graph/flow-canvas'
import { InspectorPanel } from './inspector/inspector-panel'
import { OutlineView } from './outline/outline-view'
import { buildOperationViewModels, filterOperationViewModels } from './workspace/operation-view-model'

type AppState = { readonly kind: 'loading' } | { readonly kind: 'error'; readonly message: string } | { readonly kind: 'ready'; readonly snapshot: WorkspaceSnapshot }

const emptyLayout: PositionedFlowGraph = { graphId: 'loading', width: 0, height: 0, nodes: [], edges: [] }

export function App() {
  const [state, setState] = useState<AppState>({ kind: 'loading' })
  const [selected, setSelected] = useState<SelectedElement>(null)
  const [activeView, setActiveView] = useState<'topology' | 'outline'>('topology')
  const [query, setQuery] = useState('')
  const [methods, setMethods] = useState<readonly HttpMethod[]>([])
  const [operationsOpen, setOperationsOpen] = useState(true)
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false)
  const [direction, setDirection] = useState<FlowLayoutDirection>('right')
  const [layout, setLayout] = useState<PositionedFlowGraph>(emptyLayout)
  const [reload, setReload] = useState(0)

  useEffect(() => { let cancelled = false; setState({ kind: 'loading' }); loadWorkspaceSnapshot().then((snapshot) => { if (!cancelled) setState({ kind: 'ready', snapshot }) }).catch((error: unknown) => { if (!cancelled) setState({ kind: 'error', message: error instanceof WorkspaceLoadError ? error.message : 'The workspace could not be opened.' }) }); return () => { cancelled = true } }, [reload])

  const snapshot = state.kind === 'ready' ? state.snapshot : null
  useEffect(() => { if (!snapshot) return; let cancelled = false; import('@api-schema-flow/layout').then(({ createElkFlowLayoutEngine }) => createElkFlowLayoutEngine().layout(snapshot.acceptedGraph as never, { direction })).then((result) => { if (!cancelled) setLayout(result) }).catch(() => { if (!cancelled) setLayout({ graphId: snapshot.acceptedGraph.id, width: 0, height: 0, nodes: snapshot.acceptedGraph.nodes.map((node, index) => ({ id: node.id, x: index * 330, y: 120, width: 270, height: 112 })), edges: [] }) }); return () => { cancelled = true } }, [direction, snapshot])

  const models = useMemo(() => snapshot ? buildOperationViewModels(snapshot) : [], [snapshot])
  const visibleModels = useMemo(() => filterOperationViewModels(models, { query, methods }), [methods, models, query])

  function select(value: SelectedElement) { setSelected(value); if (value) setInspectorOpen(true) }

  if (state.kind === 'loading') return <main className="center-state" aria-live="polite"><div className="brand-mark" aria-hidden="true">ASF</div><div><h1>API Schema Flow</h1><p>Loading Reservation workspace…</p></div></main>
  if (state.kind === 'error') return <main className="center-state error-state"><div className="brand-mark" aria-hidden="true">!</div><div><h1>Workspace unavailable</h1><p>{state.message}</p><button className="primary-button" onClick={() => setReload((value) => value + 1)}>Retry loading fixture</button></div></main>
  if (state.snapshot.apiDocument.operations.length === 0) return <main className="center-state"><div><h1>No API operations</h1><p>The loaded workspace does not contain operations to visualize.</p></div></main>

  return <main className={'workspace' + (operationsOpen ? '' : ' operations-closed') + (selected && inspectorOpen ? ' inspector-open' : '')}>
    <header className="top-bar"><div className="product-lockup"><div className="brand-mark" aria-hidden="true">ASF</div><div><strong>API Schema Flow</strong><small>Read-only workspace</small></div></div><div className="project-context"><strong>{state.snapshot.project.name}</strong><span>{state.snapshot.project.sourceName}</span><span className="version-chip">OpenAPI {state.snapshot.project.openapiVersion}</span></div><div className="view-actions"><button aria-pressed={direction === 'right'} onClick={() => setDirection('right')}>Horizontal</button><button aria-pressed={direction === 'down'} onClick={() => setDirection('down')}>Vertical</button></div></header>
    <nav className="icon-rail" aria-label="Workspace views"><button aria-current={activeView === 'topology' ? 'page' : undefined} onClick={() => setActiveView('topology')}><span aria-hidden="true">⌘</span><small>Topology</small></button><button aria-current={activeView === 'outline' ? 'page' : undefined} onClick={() => setActiveView('outline')}><span aria-hidden="true">☷</span><small>Outline</small></button><button aria-expanded={diagnosticsOpen} onClick={() => setDiagnosticsOpen((value) => !value)}><span aria-hidden="true">◇</span><small>Diagnostics</small></button><button onClick={() => window.alert('API Schema Flow M3-A · Read-only Reservation workspace')}><span aria-hidden="true">i</span><small>About</small></button></nav>
    {operationsOpen ? <OperationsPanel models={models} query={query} activeMethods={methods} selectedNodeId={selected?.kind === 'node' ? selected.id : null} onQueryChange={setQuery} onMethodsChange={setMethods} onSelect={(id) => select({ kind: 'node', id })} onCollapse={() => setOperationsOpen(false)} /> : <button className="reopen-operations" onClick={() => setOperationsOpen(true)} aria-label="Open operations panel">›</button>}
    <div className="main-region">{activeView === 'topology' ? <><div className="canvas-header"><div><span className="eyebrow">ACCEPTED TOPOLOGY</span><strong>{visibleModels.length} of {models.length} endpoints</strong></div><p>Explore confirmed data movement without changing the specification.</p></div><FlowCanvas snapshot={{ ...state.snapshot, acceptedGraph: { ...state.snapshot.acceptedGraph, nodes: state.snapshot.acceptedGraph.nodes.filter((node) => visibleModels.some((model) => model.nodeId === node.id)), edges: state.snapshot.acceptedGraph.edges.filter((edge) => visibleModels.some((model) => model.nodeId === edge.sourceNodeId) && visibleModels.some((model) => model.nodeId === edge.targetNodeId)) } }} positioned={layout} selected={selected} onSelect={select} /></> : <OutlineView snapshot={state.snapshot} models={visibleModels} onSelect={select} />}</div>
    {selected && inspectorOpen ? <InspectorPanel snapshot={state.snapshot} selected={selected} onClose={() => setInspectorOpen(false)} onSelect={select} /> : selected ? <button className="reopen-inspector" onClick={() => setInspectorOpen(true)}>Open inspector</button> : null}
    <DiagnosticsDrawer snapshot={state.snapshot} open={diagnosticsOpen} onToggle={() => setDiagnosticsOpen((value) => !value)} />
  </main>
}
`,
)

await write(
  'apps/web/src/styles.css',
  String.raw`@import "tailwindcss";

:root{color-scheme:dark;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#edf6ff;background:#07111d;font-synthesis:none;text-rendering:optimizeLegibility;--canvas:#07111d;--panel:#0c1725;--elevated:#112033;--border:#22364b;--primary:#edf6ff;--secondary:#91a7bd;--accent:#31c7d4;--success:#44d59b;--warning:#f2ba58;--danger:#f8757a}*{box-sizing:border-box}html,body,#root{width:100%;height:100%;min-width:320px;margin:0}body{overflow:hidden;background:var(--canvas)}button,input{font:inherit}button{color:inherit}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}button:focus-visible,input:focus-visible{outline:3px solid #7ee7ef;outline-offset:2px}.workspace{height:100vh;display:grid;grid-template-columns:64px 268px minmax(0,1fr);grid-template-rows:64px minmax(0,1fr) 44px;grid-template-areas:"top top top" "rail operations main" "rail diagnostics diagnostics";background:var(--canvas)}.workspace.inspector-open{grid-template-columns:64px 268px minmax(0,1fr) 390px;grid-template-areas:"top top top top" "rail operations main inspector" "rail diagnostics diagnostics diagnostics"}.workspace.operations-closed{grid-template-columns:64px minmax(0,1fr)}.workspace.operations-closed.inspector-open{grid-template-columns:64px minmax(0,1fr) 390px}.top-bar{grid-area:top;display:flex;align-items:center;justify-content:space-between;gap:24px;padding:0 18px;border-bottom:1px solid var(--border);background:#091521}.product-lockup,.project-context,.view-actions{display:flex;align-items:center;gap:12px}.product-lockup>div:last-child{display:grid}.product-lockup small,.project-context span{color:var(--secondary);font-size:12px}.brand-mark{display:grid;place-items:center;width:38px;height:38px;border:1px solid rgb(49 199 212 / .55);border-radius:10px;background:rgb(49 199 212 / .12);color:var(--accent);font-size:10px;font-weight:800;letter-spacing:.08em}.version-chip,.accepted-token{padding:5px 8px;border:1px solid var(--border);border-radius:999px;background:var(--elevated);font-size:12px}.view-actions{gap:4px;padding:4px;border:1px solid var(--border);border-radius:9px}.view-actions button{padding:6px 10px;border:0;border-radius:6px;background:transparent;font-size:12px}.view-actions button[aria-pressed=true]{background:#173149;color:#8fe9f0}.icon-rail{grid-area:rail;display:flex;flex-direction:column;align-items:center;gap:7px;padding:12px 7px;border-right:1px solid var(--border);background:#08131f}.icon-rail button{display:grid;place-items:center;width:50px;min-height:49px;padding:6px 3px;border:0;border-radius:9px;background:transparent;color:var(--secondary);font-size:18px}.icon-rail button small{font-size:9px}.icon-rail button[aria-current=page]{background:#123045;color:#8eeaf1}.operations-panel{grid-area:operations;min-width:0;border-right:1px solid var(--border);background:var(--panel);overflow:hidden}.panel-heading{height:64px;display:flex;align-items:center;justify-content:space-between;padding:0 14px;border-bottom:1px solid var(--border)}.panel-heading>div{display:grid;gap:3px}.eyebrow{color:#6f879e;font-size:10px;font-weight:800;letter-spacing:.12em}.icon-button{display:grid;place-items:center;width:32px;height:32px;border:1px solid var(--border);border-radius:8px;background:transparent}.search-field{display:flex;align-items:center;gap:8px;margin:14px;padding:9px 10px;border:1px solid var(--border);border-radius:9px;background:#08131f}.search-field input{min-width:0;width:100%;border:0;outline:0;background:transparent;color:var(--primary);font-size:13px}.method-filters{display:flex;gap:5px;padding:0 14px 12px;overflow:auto}.method-filters button{padding:5px 7px;border:1px solid var(--border);border-radius:6px;background:transparent;color:var(--secondary);font-size:10px;font-weight:700}.method-filters button[aria-pressed=true]{border-color:#3f8793;background:#12323b;color:#8fe9f0}.operation-list{height:calc(100% - 132px);overflow:auto;padding:0 8px 30px}.operation-list section h2{margin:14px 8px 6px;color:#7890a8;font-size:11px;text-transform:uppercase;letter-spacing:.08em}.operation-row{width:100%;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:9px;padding:10px 8px;border:1px solid transparent;border-radius:8px;background:transparent;text-align:left}.operation-row:hover{background:#102033}.operation-row[aria-pressed=true]{border-color:#2f8290;background:#12303d}.operation-copy{min-width:0;display:grid;gap:3px}.operation-copy code{overflow:hidden;text-overflow:ellipsis;color:#eaf4ff;font-size:12px;white-space:nowrap}.operation-copy small{overflow:hidden;text-overflow:ellipsis;color:var(--secondary);font-size:10px;white-space:nowrap}.connection-count{color:#6f879e;font-size:10px}.method-badge{display:inline-flex;align-items:center;gap:3px;padding:4px 6px;border:1px solid currentColor;border-radius:5px;font-size:9px;font-weight:800;letter-spacing:.04em}.method-get{color:#55d8a4}.method-post{color:#66b8ff}.method-put{color:#f2ba58}.method-patch{color:#c39cff}.method-delete{color:#f8757a}.empty-filter{padding:28px 14px;color:var(--secondary);text-align:center}.empty-filter strong{color:var(--primary)}.empty-filter button,.primary-button{padding:8px 12px;border:1px solid #3a8590;border-radius:8px;background:#11323c;color:#8fe9f0}.main-region{grid-area:main;min-width:0;min-height:0;display:grid;grid-template-rows:58px minmax(0,1fr);position:relative}.canvas-header{display:flex;align-items:center;justify-content:space-between;padding:0 18px;border-bottom:1px solid var(--border);background:#08131f}.canvas-header>div{display:grid;gap:2px}.canvas-header p{margin:0;color:var(--secondary);font-size:12px}.canvas-region{min-width:0;min-height:0;background:radial-gradient(circle at 45% 35%,rgb(24 84 106 / .17),transparent 39%),var(--canvas)}.react-flow__node-endpoint{border:0;background:transparent}.endpoint-node{width:270px;min-height:112px;padding:14px;border:1px solid #29445d;border-left:4px solid #4ba9bd;border-radius:10px;background:#0e1d2d;box-shadow:0 14px 30px rgb(0 0 0 / .22)}.endpoint-node.is-selected{border-color:#7ee7ef;box-shadow:0 0 0 2px rgb(126 231 239 / .22),0 15px 34px rgb(0 0 0 / .28)}.endpoint-title{display:flex;align-items:center;gap:8px}.endpoint-title code{font-size:13px;font-weight:650}.endpoint-node p{margin:10px 0 12px;color:#9bb1c6;font-size:12px}.endpoint-node footer{display:flex;justify-content:space-between;color:#6f879e;font-size:10px}.react-flow__edge-text{fill:#b7cadb;font-size:10px}.react-flow__edge-textbg{fill:#0a1725;fill-opacity:.92}.inspector-panel{grid-area:inspector;min-width:0;border-left:1px solid var(--border);background:var(--panel);overflow:hidden}.inspector-scroll{height:calc(100% - 64px);padding:16px;overflow:auto}.inspector-title{display:flex;align-items:center;gap:9px}.inspector-summary{margin:9px 0 20px;color:var(--secondary)}.inspector-panel section{padding:17px 0;border-top:1px solid var(--border)}.inspector-panel h3{margin:0 0 11px;font-size:12px;text-transform:uppercase;letter-spacing:.08em}.inspector-panel dl{margin:0}.inspector-panel dl>div{display:grid;grid-template-columns:98px minmax(0,1fr);gap:10px;padding:6px 0}.inspector-panel dt{color:var(--secondary);font-size:11px}.inspector-panel dd{min-width:0;margin:0;overflow-wrap:anywhere;font-size:12px}.schema-line,.response-line{display:grid;gap:4px;padding:9px 0}.schema-line span,.response-line span,.response-line small{color:var(--secondary);font-size:11px}.connection-row{width:100%;display:grid;gap:4px;padding:10px;border:1px solid var(--border);border-radius:8px;background:#0a1724;text-align:left;margin-bottom:7px}.connection-row span,.connection-row small{color:var(--secondary);font-size:10px}.connection-row strong{font-size:11px}.edge-heading{display:flex;gap:8px;margin-bottom:16px}.provenance-token{display:inline-flex;padding:5px 8px;border-radius:999px;font-size:10px;font-weight:700;text-transform:capitalize}.provenance-declared{border:1px solid #3a8e70;color:#73e0b0}.provenance-inferred{border:1px dashed #4c8fc5;color:#79c4ff}.provenance-manual{border:1px dotted #8c64bd;color:#d0a8ff}.block-code{display:block;margin-top:9px;padding:9px;border:1px solid var(--border);border-radius:7px;background:#08131f;overflow-wrap:anywhere;font-size:11px}.evidence-list{display:grid;gap:7px;margin:10px 0 0;padding:0;list-style:none;color:#8edfc0;font-size:11px}.muted{color:var(--secondary);font-size:12px}.outline-view{min-height:0;overflow:auto;padding:24px 28px 80px}.outline-view header h1{margin:5px 0 4px;font-size:22px}.outline-view header p{margin:0 0 20px;color:var(--secondary)}.table-shell{margin-bottom:22px;border:1px solid var(--border);border-radius:10px;overflow:auto;background:var(--panel)}table{width:100%;border-collapse:collapse;font-size:12px}caption{padding:13px 15px;text-align:left;font-weight:700}th,td{padding:10px 12px;border-top:1px solid var(--border);text-align:left;white-space:nowrap}th{color:var(--secondary);font-size:10px;text-transform:uppercase;letter-spacing:.08em}.table-link{padding:0;border:0;background:transparent;color:#8fe9f0;text-decoration:underline;text-underline-offset:3px}.diagnostics-drawer{grid-area:diagnostics;z-index:6;border-top:1px solid var(--border);background:#091521}.diagnostics-summary{width:100%;height:43px;display:flex;align-items:center;gap:8px;padding:0 16px;border:0;background:transparent;color:#a9bdd0;text-align:left;font-size:11px}.diagnostics-summary span:last-child{margin-left:auto}.ready-dot{width:7px;height:7px;border-radius:50%;background:var(--success)}.diagnostics-drawer.is-open{position:fixed;right:0;bottom:0;left:64px;max-height:35vh;overflow:auto;border:1px solid var(--border);box-shadow:0 -20px 50px rgb(0 0 0 / .35)}.diagnostics-content{padding:8px 16px 20px}.reopen-operations,.reopen-inspector{position:absolute;z-index:8;border:1px solid var(--border);background:var(--elevated)}.reopen-operations{left:70px;top:77px;width:30px;height:38px;border-radius:7px}.reopen-inspector{right:14px;top:76px;padding:8px 10px;border-radius:7px}.center-state{height:100%;display:grid;place-content:center;grid-template-columns:auto auto;gap:14px;align-items:center;background:radial-gradient(circle at 45% 38%,rgb(24 84 106 / .2),transparent 35%),var(--canvas)}.center-state h1,.center-state p{margin:0}.center-state p{margin-top:5px;color:var(--secondary)}.center-state .primary-button{margin-top:14px}.error-state .brand-mark{border-color:rgb(248 117 122 / .55);background:rgb(248 117 122 / .12);color:var(--danger)}@media(max-width:1200px){.workspace.inspector-open{grid-template-columns:64px 250px minmax(0,1fr);grid-template-areas:"top top top" "rail operations main" "rail diagnostics diagnostics"}.workspace.operations-closed.inspector-open{grid-template-columns:64px minmax(0,1fr)}.inspector-panel{position:fixed;z-index:12;top:64px;right:0;bottom:44px;width:min(390px,calc(100vw - 64px));box-shadow:-22px 0 45px rgb(0 0 0 / .4)}}@media(prefers-reduced-motion:reduce){*,*::before,*::after{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
`,
)

await write(
  'apps/web/src/workspace/operation-view-model.test.ts',
  String.raw`import { describe, expect, test } from 'vitest'

import { buildOperationViewModels, filterOperationViewModels } from './operation-view-model'
import type { WorkspaceSnapshot } from '../data/types'

const snapshot = { apiDocument: { operations: [{ id: 'operation:post:/reservations', method: 'post', path: '/reservations', operationId: 'createReservation', summary: 'Create reservation', tags: ['Reservations'], parameters: [], responses: [], security: [], source: { uri: 'fixture://test', pointer: '#/paths' } }] }, acceptedGraph: { id: 'graph', nodes: [{ kind: 'endpoint', id: 'operation:post:/reservations', operationKey: 'operation:post:/reservations', source: { uri: 'fixture://test', pointer: '#/paths' } }], edges: [] }, schemaVersion: '1.0', project: { name: 'Test', sourceName: 'Test', sourceUri: 'fixture://test', openapiVersion: '3.1.0' }, inferenceCandidates: [], reviewOutcomes: [], diagnostics: [] } satisfies WorkspaceSnapshot

describe('operation view model', () => {
  test('builds deterministic connection metadata and searches path, summary, and operation ID', () => {
    const models = buildOperationViewModels(snapshot)
    expect(models[0]).toMatchObject({ tag: 'Reservations', incoming: 0, outgoing: 0 })
    expect(filterOperationViewModels(models, { query: 'createReservation', methods: [] })).toHaveLength(1)
    expect(filterOperationViewModels(models, { query: 'reservation', methods: ['get'] })).toHaveLength(0)
  })
})
`,
)

await write(
  'apps/web/src/app.test.tsx',
  String.raw`import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, test, vi } from 'vitest'

import { App } from './app'

const snapshot = { schemaVersion: '1.0', project: { name: 'Reservation System', sourceName: 'Reservation API', sourceUri: 'fixture://reservation/openapi.yaml', openapiVersion: '3.1.0' }, apiDocument: { operations: [] }, acceptedGraph: { id: 'graph', nodes: [], edges: [] }, inferenceCandidates: [], reviewOutcomes: [], diagnostics: [] }

beforeEach(() => { vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(snapshot), { status: 200, headers: { 'content-type': 'application/json' } }))) })

test('renders a concrete empty state after loading a valid empty workspace', async () => {
  render(<App />)
  expect(screen.getByText('Loading Reservation workspace…')).toBeInTheDocument()
  await waitFor(() => expect(screen.getByRole('heading', { name: 'No API operations' })).toBeInTheDocument())
})
`,
)

await write(
  'apps/web/src/test/setup.ts',
  String.raw`import '@testing-library/jest-dom/vitest'

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(globalThis, 'ResizeObserver', { value: ResizeObserverMock, writable: true })
Object.defineProperty(globalThis, 'DOMMatrixReadOnly', { value: class DOMMatrixReadOnlyMock {}, writable: true })
`,
)

await write(
  'apps/web/e2e/workspace.spec.ts',
  String.raw`import { expect, test } from '@playwright/test'

test('explores the Reservation topology and equivalent outline', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Reservation System')).toBeVisible()
  await page.getByPlaceholder('Search path or operation ID').fill('reservations')
  await expect(page.getByText('2 visible')).toBeVisible()
  await page.getByRole('button', { name: /POST \/reservations/i }).first().click()
  await expect(page.getByRole('complementary', { name: 'Endpoint inspector' })).toContainText('createReservation')
  await page.getByRole('button', { name: /Outgoing/i }).click()
  await expect(page.getByRole('complementary', { name: 'Relationship inspector' })).toContainText('Accepted')
  await page.getByRole('button', { name: /Outline/i }).click()
  await expect(page.getByRole('table', { name: 'Accepted data mappings' })).toBeVisible()
})

test('keeps primary regions usable at the minimum desktop viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto('/')
  await expect(page.getByLabel('Accepted API topology')).toBeVisible()
  const canvas = await page.getByLabel('Accepted API topology').boundingBox()
  expect(canvas?.width ?? 0).toBeGreaterThan(600)
  expect(canvas?.height ?? 0).toBeGreaterThan(500)
})
`,
)

await write(
  'apps/web/e2e/accessibility.spec.ts',
  String.raw`import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('has no serious or critical accessibility violations in the canonical workspace', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Reservation System')).toBeVisible()
  const results = await new AxeBuilder({ page }).analyze()
  const blocking = results.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))
  expect(blocking).toEqual([])
})
`,
)

await write(
  '.github/workflows/ci.yml',
  String.raw`name: CI

on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  verify:
    runs-on: ubuntu-24.04
    timeout-minutes: 35
    env:
      TURBO_TELEMETRY_DISABLED: '1'
    steps:
      - name: Check out repository
        uses: actions/checkout@v6
      - name: Set up pnpm
        uses: pnpm/action-setup@v6
        with:
          version: 11.24.0
      - name: Set up Node.js
        uses: actions/setup-node@v6
        with:
          node-version: 24
          cache: pnpm
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      - name: Verify workspace
        run: pnpm ci:verify
      - name: Verify deterministic Web fixture and bundle
        run: |
          pnpm check:web-fixture
          pnpm build:web
          pnpm check:web-bundle
      - name: Install Chromium
        run: pnpm exec playwright install --with-deps chromium
      - name: Verify browser workspace
        run: pnpm test:web:e2e
      - name: Smoke-test CLI
        run: node packages/cli/bin/schema-flow.mjs validate examples/reservation/openapi.yaml --json
`,
)

const webPackage = JSON.parse(await (await import('node:fs/promises')).readFile('apps/web/package.json', 'utf8'))
webPackage.scripts.preview = 'vite preview'
await writeFile('apps/web/package.json', JSON.stringify(webPackage, null, 2) + '\n')

const rootPackage = JSON.parse(await (await import('node:fs/promises')).readFile('package.json', 'utf8'))
rootPackage.scripts['generate:web-fixture'] = 'node tooling/scripts/generate-web-workspace.mjs'
rootPackage.scripts['check:web-fixture'] = 'node tooling/scripts/check-web-workspace.mjs'
rootPackage.scripts['check:web-bundle'] = 'node tooling/scripts/check-web-bundle.mjs apps/web/dist'
rootPackage.scripts['dev:web'] = 'pnpm --filter @api-schema-flow/web dev'
rootPackage.scripts['build:web'] = 'pnpm --filter @api-schema-flow/web build'
rootPackage.scripts['test:web'] = 'pnpm --filter @api-schema-flow/web test'
rootPackage.scripts['test:web:e2e'] = 'pnpm --filter @api-schema-flow/web test:e2e'
await writeFile('package.json', JSON.stringify(rootPackage, null, 2) + '\n')

console.log('M3-A implementation scaffold written.')
