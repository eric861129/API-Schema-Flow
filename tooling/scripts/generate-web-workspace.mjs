import { readFile, writeFile } from 'node:fs/promises'
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
  security:
    path === '/auth/login' ? [] : [{ requirementIndex: 0, schemeName: 'bearerAuth', scopes: [] }],
  servers: [],
  source: { uri: sourceUri, pointer: '#/paths/' + path.replaceAll('/', '~1') + '/' + method },
})

const operations = [
  operation(
    'post',
    '/auth/login',
    'login',
    'Sign in and receive an access token',
    'Auth',
    {
      requestBody: {
        required: true,
        mediaTypes: [
          {
            mediaType: 'application/json',
            schema: {
              type: 'object',
              properties: {
                username: { type: 'string' },
                password: { type: 'string', writeOnly: true },
              },
              required: ['username', 'password'],
            },
          },
        ],
      },
    },
    [
      {
        statusCode: '200',
        description: 'Authenticated',
        mediaTypes: [
          {
            mediaType: 'application/json',
            schema: { type: 'object', properties: { token: { type: 'string' } } },
          },
        ],
        headers: [],
        links: [],
      },
    ],
  ),
  operation(
    'get',
    '/spaces/available',
    'listAvailableSpaces',
    'List spaces that can be reserved',
    'Spaces',
    null,
    [
      {
        statusCode: '200',
        description: 'Available spaces',
        mediaTypes: [
          {
            mediaType: 'application/json',
            schema: {
              type: 'array',
              items: {
                type: 'object',
                properties: { spaceId: { type: 'string' }, name: { type: 'string' } },
              },
            },
          },
        ],
        headers: [],
        links: [],
      },
    ],
  ),
  operation(
    'post',
    '/reservations',
    'createReservation',
    'Create a reservation',
    'Reservations',
    {
      requestBody: {
        required: true,
        mediaTypes: [
          {
            mediaType: 'application/json',
            schema: {
              type: 'object',
              properties: {
                spaceId: { type: 'string' },
                startsAt: { type: 'string', format: 'date-time' },
              },
              required: ['spaceId'],
            },
          },
        ],
      },
    },
    [
      {
        statusCode: '201',
        description: 'Reservation created',
        mediaTypes: [
          {
            mediaType: 'application/json',
            schema: {
              type: 'object',
              properties: { reservationId: { type: 'string' }, status: { type: 'string' } },
            },
          },
        ],
        headers: [],
        links: [],
      },
    ],
  ),
  operation(
    'get',
    '/reservations/{id}',
    'getReservation',
    'Get one reservation',
    'Reservations',
    {
      parameters: [
        {
          name: 'id',
          location: 'path',
          required: true,
          schema: { type: 'string' },
          source: { uri: sourceUri, pointer: '#/paths/~1reservations~1{id}/get/parameters/0' },
        },
      ],
    },
    [
      {
        statusCode: '200',
        description: 'Reservation found',
        mediaTypes: [
          {
            mediaType: 'application/json',
            schema: {
              type: 'object',
              properties: { reservationId: { type: 'string' }, status: { type: 'string' } },
            },
          },
        ],
        headers: [],
        links: [],
      },
    ],
  ),
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
  sourceStandardRefs:
    provenance === 'declared'
      ? [{ standard: 'openapi-link', source: { uri: sourceUri, pointer: '#/paths' } }]
      : [],
  review:
    provenance === 'declared'
      ? undefined
      : {
          action: provenance === 'manual' ? 'edit' : 'accept',
          candidateId: 'candidate:' + id,
          evidenceRuleIds,
        },
})

export function buildReservationSnapshot() {
  const graphNodes = operations.map((item) => node(item.id, item.source.pointer))
  const graphEdges = [
    edge(
      'edge:token-to-auth',
      operations[0].id,
      operations[1].id,
      'inferred',
      mapping(
        'mapping:token-to-auth',
        { kind: 'response-body', pointer: '#/token' },
        {
          kind: 'operation-parameter',
          operationKey: operations[1].id,
          location: 'header',
          name: 'Authorization',
        },
      ),
      ['INF-AUTH-BEARER', 'INF-SCHEMA-TYPE'],
    ),
    edge(
      'edge:space-to-reservation',
      operations[1].id,
      operations[2].id,
      'manual',
      mapping(
        'mapping:space-to-reservation',
        { kind: 'response-body', pointer: '#/0/spaceId' },
        { kind: 'request-body', operationKey: operations[2].id, pointer: '#/spaceId' },
      ),
      ['INF-RESOURCE-ID', 'INF-SCHEMA-TYPE'],
    ),
    edge(
      'edge:reservation-to-get',
      operations[2].id,
      operations[3].id,
      'declared',
      mapping(
        'mapping:reservation-to-get',
        { kind: 'response-body', pointer: '#/reservationId' },
        {
          kind: 'operation-parameter',
          operationKey: operations[3].id,
          location: 'path',
          name: 'id',
        },
      ),
      ['OPENAPI-LINK'],
    ),
  ]

  return {
    schemaVersion: '1.0',
    generatedBy: { package: 'api-schema-flow', milestone: 'M3-A' },
    project: {
      name: 'Reservation System',
      sourceName: 'Reservation API',
      sourceUri,
      openapiVersion: '3.1.0',
    },
    apiDocument: {
      schemaVersion: '1.0',
      sourceUri,
      openapiVersion: '3.1.0',
      compatibilityMode: false,
      info: {
        title: 'Reservation API',
        version: '1.0.0',
        description: 'Canonical read-only workspace fixture.',
      },
      tags: ['Auth', 'Reservations', 'Spaces'],
      servers: [],
      operations,
      componentSchemas: [],
    },
    acceptedGraph: {
      schemaVersion: '1.0',
      id: 'graph:reservation',
      kind: 'operation-topology',
      title: 'Reservation API topology',
      sourceIds: [sourceUri],
      nodes: graphNodes,
      edges: graphEdges,
    },
    inferenceCandidates: graphEdges
      .filter((item) => item.provenance !== 'declared')
      .map((item) => ({
        id: item.review.candidateId,
        fingerprint: item.id,
        ruleSetVersion: 'm2c-v1',
        sourceOperationKey: item.sourceNodeId,
        targetOperationKey: item.targetNodeId,
        source: item.mappings[0].source,
        target: item.mappings[0].target,
        score: 92,
        confidence: 0.92,
        band: 'high',
        evidence: item.review.evidenceRuleIds.map((ruleId) => ({
          ruleId,
          kind: 'positive',
          weight: 20,
          summary: ruleId,
          sourcePointers: [],
          details: {},
        })),
        blockers: [],
        provenance: 'inferred',
        status: 'candidate',
      })),
    reviewOutcomes: graphEdges
      .filter((item) => item.review)
      .map((item) => ({
        decisionId: 'decision:' + item.id,
        state: 'applied',
        candidateId: item.review.candidateId,
        action: item.review.action,
        edgeId: item.id,
        diagnostics: [],
      })),
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
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, sortValue(item)]),
    )
  }
  return value
}

export function serializeSnapshot(snapshot) {
  const text = JSON.stringify(sortValue(snapshot), null, 2) + '\n'
  if (/synthetic-jwt-token|synthetic-password|Bearer\s+[A-Za-z0-9._~-]{12,}/i.test(text))
    throw new Error('Representative secret found in workspace fixture')
  if (/(?:\/Users\/|\/home\/runner\/|[A-Za-z]:\\\\Users\\\\)/.test(text))
    throw new Error('Absolute local path found in workspace fixture')
  return text
}

export async function generateReservationWorkspace(target = outputPath) {
  const source = await readFile(resolve(root, 'fixtures/review/reservation/openapi.yaml'), 'utf8')
  for (const endpoint of ['/auth/login', '/spaces/available', '/reservations']) {
    if (!source.includes(endpoint))
      throw new Error('Canonical source no longer contains ' + endpoint)
  }
  const text = serializeSnapshot(buildReservationSnapshot())
  await writeFile(target, text, 'utf8')
  return text
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await generateReservationWorkspace()
  console.log('Generated ' + outputPath)
}
