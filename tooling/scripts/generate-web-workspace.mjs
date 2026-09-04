import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
export const outputPath = resolve(root, 'apps/web/public/fixtures/reservation-workspace.json')

const sourceUri = 'fixture://reservation/openapi.yaml'
const openApiPath = resolve(root, 'fixtures/review/reservation/openapi.yaml')
const ruleSetVersion = 'm2c-v1'

const FNV_OFFSET_BASIS = 0xcbf29ce484222325n
const FNV_PRIME = 0x100000001b3n
const FNV_MASK = 0xffffffffffffffffn

function stableHash(value) {
  let hash = FNV_OFFSET_BASIS
  for (const character of value) {
    hash ^= BigInt(character.codePointAt(0) ?? 0)
    hash = (hash * FNV_PRIME) & FNV_MASK
  }
  return hash.toString(16).padStart(16, '0')
}

async function importBuilt(relativePath, packageName) {
  try {
    return await import(new URL(relativePath, import.meta.url))
  } catch (error) {
    throw new Error(
      `Workspace fixture generation requires a built ${packageName} package. Run "pnpm build" first.`,
      { cause: error },
    )
  }
}

async function loadRuntime() {
  const [domain, flow, openapi, review] = await Promise.all([
    importBuilt('../../packages/domain/dist/index.js', '@api-schema-flow/domain'),
    importBuilt('../../packages/flow/dist/index.js', '@api-schema-flow/flow'),
    importBuilt('../../packages/openapi/dist/index.js', '@api-schema-flow/openapi'),
    importBuilt('../../packages/review/dist/index.js', '@api-schema-flow/review'),
  ])

  return { domain, flow, openapi, review }
}

function sanitizeSchema(schema) {
  if (schema === undefined) return undefined

  const {
    example: _example,
    defaultValue: _defaultValue,
    properties,
    items,
    allOf,
    anyOf,
    oneOf,
    additionalProperties,
    ...rest
  } = schema

  return {
    ...rest,
    properties: Object.fromEntries(
      Object.entries(properties).map(([name, property]) => [name, sanitizeSchema(property)]),
    ),
    ...(items === undefined ? {} : { items: sanitizeSchema(items) }),
    allOf: allOf.map(sanitizeSchema),
    anyOf: anyOf.map(sanitizeSchema),
    oneOf: oneOf.map(sanitizeSchema),
    ...(typeof additionalProperties === 'object' && additionalProperties !== null
      ? { additionalProperties: sanitizeSchema(additionalProperties) }
      : additionalProperties === undefined
        ? {}
        : { additionalProperties }),
  }
}

function sanitizeMediaType(mediaType) {
  const { example: _example, schema, ...rest } = mediaType
  return {
    ...rest,
    ...(schema === undefined ? {} : { schema: sanitizeSchema(schema) }),
  }
}

function sanitizeApiDocument(document) {
  return {
    ...document,
    operations: document.operations.map((operation) => ({
      ...operation,
      parameters: operation.parameters.map((parameter) => ({
        ...parameter,
        ...(parameter.schema === undefined ? {} : { schema: sanitizeSchema(parameter.schema) }),
      })),
      ...(operation.requestBody === undefined
        ? {}
        : {
            requestBody: {
              ...operation.requestBody,
              content: operation.requestBody.content.map(sanitizeMediaType),
            },
          }),
      responses: operation.responses.map((response) => ({
        ...response,
        content: response.content.map(sanitizeMediaType),
      })),
    })),
    componentSchemas: document.componentSchemas.map((component) => ({
      ...component,
      schema: sanitizeSchema(component.schema),
    })),
  }
}

function pointer(pointer) {
  return { uri: sourceUri, pointer }
}

function requireOperation(apiDocument, method, path) {
  const operation = apiDocument.operations.find(
    (candidate) => candidate.method === method && candidate.path === path,
  )
  if (operation === undefined) {
    throw new Error(`Canonical Reservation OpenAPI is missing ${method.toUpperCase()} ${path}.`)
  }
  return operation
}

function sortPointers(sourcePointers) {
  return [...sourcePointers].sort((left, right) =>
    `${left.uri}${left.pointer}`.localeCompare(`${right.uri}${right.pointer}`),
  )
}

function createMapping(flow, source, target, sourcePointers, transform) {
  return {
    id: flow.createMappingId(source, target, transform),
    source,
    target,
    aliases: [],
    sourcePointers: sortPointers(sourcePointers),
    ...(transform === undefined ? {} : { transform }),
  }
}

function createEvidence(ruleId, kind, weight, message, sourcePointers) {
  return {
    ruleId,
    kind,
    weight,
    message,
    sourcePointers: sortPointers(sourcePointers),
  }
}

function createCandidate(flow, input) {
  const fingerprint = stableHash(
    flow.canonicalizeJson({
      ruleSetVersion,
      sourceOperationNodeId: input.sourceNode.id,
      targetOperationNodeId: input.targetNode.id,
      mapping: {
        source: input.mapping.source,
        target: input.mapping.target,
        ...(input.mapping.transform === undefined
          ? {}
          : { transform: input.mapping.transform }),
      },
    }),
  )

  return {
    schemaVersion: '1.0',
    id: `candidate:${fingerprint}`,
    fingerprint,
    ruleSetVersion,
    sourceOperationNodeId: input.sourceNode.id,
    targetOperationNodeId: input.targetNode.id,
    sourceOperationKey: input.sourceOperation.id,
    targetOperationKey: input.targetOperation.id,
    mapping: input.mapping,
    score: input.score,
    confidence: input.confidence,
    band: input.band,
    evidence: [...input.evidence].sort((left, right) => left.ruleId.localeCompare(right.ruleId)),
    blockers: [...input.blockers].sort((left, right) => left.ruleId.localeCompare(right.ruleId)),
    provenance: 'inferred',
    status: 'candidate',
  }
}

function createDecision(review, candidate, action, editedMapping) {
  const input = {
    schemaVersion: '1.0',
    candidateId: candidate.id,
    candidateFingerprint: candidate.fingerprint,
    ruleSetVersion: candidate.ruleSetVersion,
    revision: 1,
    action,
    ...(editedMapping === undefined ? {} : { editedMapping }),
  }

  return {
    ...input,
    id: review.createReviewDecisionId(input),
  }
}

function graphNode(flow, operation) {
  return {
    kind: 'endpoint',
    id: flow.createEndpointNodeId(sourceUri, operation.id),
    operationKey: operation.id,
    source: operation.source,
  }
}

function createDeclaredGraph(flow, operations, nodes, declaredMapping) {
  const createReservationNode = nodes.get(operations.createReservation.id)
  const getReservationNode = nodes.get(operations.getReservation.id)
  if (createReservationNode === undefined || getReservationNode === undefined) {
    throw new Error('Canonical Reservation graph nodes could not be created.')
  }

  const declaredEdge = {
    id: flow.createEdgeId('data', createReservationNode.id, getReservationNode.id, [
      declaredMapping,
    ]),
    kind: 'data',
    sourceNodeId: createReservationNode.id,
    targetNodeId: getReservationNode.id,
    provenance: 'declared',
    status: 'accepted',
    mappings: [declaredMapping],
    sourceStandardRefs: [
      {
        standard: 'openapi-link',
        source: pointer('#/paths/~1reservations/post/responses/201/links/GetReservation'),
      },
    ],
  }

  return {
    schemaVersion: '1.0',
    id: flow.createOperationGraphId([sourceUri]),
    kind: 'operation-topology',
    title: 'Reservation API declared topology',
    sourceIds: [sourceUri],
    nodes: [...nodes.values()].sort((left, right) => left.id.localeCompare(right.id)),
    edges: [declaredEdge],
  }
}

function assertMaterializedSnapshot(domain, snapshot, materialized) {
  if (materialized.diagnostics.some(({ severity }) => severity === 'error')) {
    throw new Error(
      `Review materialization failed: ${materialized.diagnostics
        .map(({ code, message }) => `${code} ${message}`)
        .join('; ')}`,
    )
  }

  if (!domain.isReviewWorkspaceSnapshot(snapshot)) {
    throw new Error('Generated Reservation workspace does not satisfy Snapshot 1.1.')
  }
}

export async function buildReservationSnapshot() {
  const { domain, flow, openapi, review } = await loadRuntime()
  const contents = await readFile(openApiPath, 'utf8')
  const parsed = await openapi.processOpenApi({
    uri: sourceUri,
    contents,
    mediaType: 'application/yaml',
    byteLength: Buffer.byteLength(contents),
  })

  if (parsed.document === undefined || parsed.diagnostics.some(({ severity }) => severity === 'error')) {
    throw new Error(
      `Canonical Reservation OpenAPI could not be normalized: ${parsed.diagnostics
        .map(({ code, message }) => `${code} ${message}`)
        .join('; ')}`,
    )
  }

  const apiDocument = sanitizeApiDocument(parsed.document)
  const operations = {
    login: requireOperation(apiDocument, 'post', '/auth/login'),
    listSpaces: requireOperation(apiDocument, 'get', '/spaces/available'),
    createReservation: requireOperation(apiDocument, 'post', '/reservations'),
    getReservation: requireOperation(apiDocument, 'get', '/reservations/{id}'),
  }
  const nodes = new Map(
    Object.values(operations).map((operation) => [operation.id, graphNode(flow, operation)]),
  )

  const loginNode = nodes.get(operations.login.id)
  const listSpacesNode = nodes.get(operations.listSpaces.id)
  const createReservationNode = nodes.get(operations.createReservation.id)
  const getReservationNode = nodes.get(operations.getReservation.id)
  if (
    loginNode === undefined ||
    listSpacesNode === undefined ||
    createReservationNode === undefined ||
    getReservationNode === undefined
  ) {
    throw new Error('Canonical Reservation graph nodes could not be indexed.')
  }

  const declaredReservationMapping = createMapping(
    flow,
    { kind: 'response-body', pointer: '#/id' },
    { kind: 'path-parameter', name: 'id' },
    [
      pointer('#/components/schemas/Reservation/allOf/1/properties/id'),
      pointer('#/paths/~1reservations~1{id}/get/parameters/0'),
    ],
  )
  const declaredGraph = createDeclaredGraph(
    flow,
    operations,
    nodes,
    declaredReservationMapping,
  )

  const tokenMapping = createMapping(
    flow,
    { kind: 'response-body', pointer: '#/token' },
    { kind: 'header-parameter', name: 'Authorization' },
    [
      pointer('#/components/schemas/LoginResponse/properties/token'),
      pointer('#/components/securitySchemes/bearerAuth'),
    ],
    { kind: 'template', raw: 'Bearer {$steps.source.outputs.token}' },
  )
  const tokenCandidate = createCandidate(flow, {
    sourceOperation: operations.login,
    targetOperation: operations.listSpaces,
    sourceNode: loginNode,
    targetNode: listSpacesNode,
    mapping: tokenMapping,
    score: 96,
    confidence: 0.96,
    band: 'high',
    evidence: [
      createEvidence(
        'INF-AUTH-BEARER',
        'positive',
        30,
        'The target authorization scheme is Bearer and accepts the response token.',
        tokenMapping.sourcePointers,
      ),
      createEvidence(
        'INF-SCHEMA-TYPE',
        'positive',
        12,
        'The source token and target header are string-compatible.',
        tokenMapping.sourcePointers,
      ),
    ],
    blockers: [],
  })

  const inferredSpaceMapping = createMapping(
    flow,
    { kind: 'response-body', pointer: '#/id' },
    { kind: 'request-body', pointer: '#/spaceId' },
    [
      pointer('#/components/schemas/Space/properties/id'),
      pointer('#/components/schemas/ReservationRequest/properties/spaceId'),
    ],
  )
  const editedSpaceMapping = createMapping(
    flow,
    { kind: 'response-body', pointer: '#/0/id' },
    { kind: 'request-body', pointer: '#/spaceId' },
    [
      pointer('#/components/schemas/Space/properties/id'),
      pointer('#/components/schemas/ReservationRequest/properties/spaceId'),
    ],
  )
  const spaceCandidate = createCandidate(flow, {
    sourceOperation: operations.listSpaces,
    targetOperation: operations.createReservation,
    sourceNode: listSpacesNode,
    targetNode: createReservationNode,
    mapping: inferredSpaceMapping,
    score: 84,
    confidence: 0.84,
    band: 'medium',
    evidence: [
      createEvidence(
        'INF-RESOURCE-ID',
        'positive',
        25,
        'Space resource identifiers align with the reservation spaceId field.',
        inferredSpaceMapping.sourcePointers,
      ),
      createEvidence(
        'INF-SCHEMA-TYPE',
        'positive',
        12,
        'The source and target identifiers are UUID strings.',
        inferredSpaceMapping.sourcePointers,
      ),
    ],
    blockers: [
      createEvidence(
        'INF-BLOCK-ARRAY-SELECTOR',
        'blocker',
        0,
        'The source response is an array and requires an explicit item selector.',
        [pointer('#/paths/~1spaces~1available/get/responses/200')],
      ),
    ],
  })

  const duplicateCandidate = createCandidate(flow, {
    sourceOperation: operations.createReservation,
    targetOperation: operations.getReservation,
    sourceNode: createReservationNode,
    targetNode: getReservationNode,
    mapping: declaredReservationMapping,
    score: 98,
    confidence: 0.98,
    band: 'high',
    evidence: [
      createEvidence(
        'INF-RESOURCE-ID',
        'positive',
        25,
        'Reservation identifiers align with the downstream path parameter.',
        declaredReservationMapping.sourcePointers,
      ),
      createEvidence(
        'INF-LIFECYCLE-CREATE-READ',
        'positive',
        20,
        'The mapping follows a create-then-read resource lifecycle.',
        declaredReservationMapping.sourcePointers,
      ),
    ],
    blockers: [],
  })

  const statusMapping = createMapping(
    flow,
    { kind: 'response-body', pointer: '#/status' },
    { kind: 'request-body', pointer: '#/spaceId' },
    [
      pointer('#/components/schemas/Reservation/allOf/1/properties/status'),
      pointer('#/components/schemas/ReservationRequest/properties/spaceId'),
    ],
  )
  const statusCandidate = createCandidate(flow, {
    sourceOperation: operations.createReservation,
    targetOperation: operations.createReservation,
    sourceNode: createReservationNode,
    targetNode: createReservationNode,
    mapping: statusMapping,
    score: 32,
    confidence: 0.32,
    band: 'low',
    evidence: [
      createEvidence(
        'INF-NAME-NORMALIZED',
        'penalty',
        -12,
        'The source and target names do not express the same value.',
        statusMapping.sourcePointers,
      ),
    ],
    blockers: [
      createEvidence(
        'INF-BLOCK-SAME-OPERATION',
        'blocker',
        0,
        'A response-to-request dependency within the same operation is not inferred.',
        statusMapping.sourcePointers,
      ),
    ],
  })

  const candidates = [tokenCandidate, spaceCandidate, duplicateCandidate, statusCandidate].sort(
    (left, right) => left.id.localeCompare(right.id),
  )
  const decisions = [
    createDecision(review, tokenCandidate, 'accept'),
    createDecision(review, spaceCandidate, 'edit', editedSpaceMapping),
  ]
  const reviewDecisionSet = review.canonicalizeDecisionSet({
    schemaVersion: '1.0',
    revision: 1,
    decisions,
    manualEdges: [],
  })
  const materialized = review.materializeReviewedOperationGraph({
    declaredOperationGraph: declaredGraph,
    candidates,
    decisionSet: reviewDecisionSet,
  })

  const snapshot = {
    schemaVersion: '1.1',
    generatedBy: { package: 'api-schema-flow', milestone: 'M3-B1' },
    project: {
      name: 'Reservation System',
      sourceName: apiDocument.info.title,
      sourceUri,
      openapiVersion: apiDocument.openapiVersion,
    },
    reviewContext: {
      projectFingerprint: 'project:reservation:v1',
      sourceRevision: 'source:reservation:openapi:v1',
    },
    apiDocument,
    declaredGraph,
    acceptedGraph: materialized.graph,
    inferenceCandidates: candidates,
    reviewDecisionSet,
    reviewOutcomes: materialized.outcomes,
    diagnostics: parsed.diagnostics,
  }

  assertMaterializedSnapshot(domain, snapshot, materialized)
  return snapshot
}

function stableArrayKey(item) {
  if (item === null || typeof item !== 'object') return undefined
  if (typeof item.id === 'string') return `id:${item.id}`
  if (typeof item.decisionId === 'string') {
    return `decision:${item.candidateId ?? ''}:${item.decisionId}:${item.state ?? ''}`
  }
  if (typeof item.code === 'string') {
    const source = item.source && typeof item.source === 'object'
      ? `${item.source.uri ?? ''}${item.source.pointer ?? ''}`
      : ''
    return `diagnostic:${item.severity ?? ''}:${item.code}:${source}`
  }
  if (typeof item.ruleId === 'string') return `rule:${item.ruleId}`
  return undefined
}

function sortValue(value) {
  if (Array.isArray(value)) {
    const items = value.map(sortValue)
    const keys = items.map(stableArrayKey)
    if (keys.every((key) => key !== undefined)) {
      return items
        .map((item, index) => ({ item, key: keys[index] }))
        .sort((left, right) => left.key.localeCompare(right.key))
        .map(({ item }) => item)
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
  if (/synthetic-jwt-token|synthetic-password|Bearer\s+[A-Za-z0-9._~-]{12,}/i.test(text)) {
    throw new Error('Representative secret found in workspace fixture')
  }
  if (/(?:\/Users\/|\/home\/runner\/|[A-Za-z]:\\\\Users\\\\)/.test(text)) {
    throw new Error('Absolute local path found in workspace fixture')
  }
  if (/"decidedAt"\s*:/.test(text)) {
    throw new Error('Non-deterministic decision timestamp found in workspace fixture')
  }
  return text
}

export async function generateReservationWorkspace(target = outputPath) {
  const snapshot = await buildReservationSnapshot()
  const text = serializeSnapshot(snapshot)
  await writeFile(target, text, 'utf8')
  return text
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  await generateReservationWorkspace()
  console.log('Generated ' + outputPath)
}
