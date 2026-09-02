import type {
  NormalizedApiDocument,
  NormalizedOperation,
  NormalizedParameter,
  NormalizedResponse,
  NormalizedSchema,
  SourcePointer,
} from '@api-schema-flow/domain'
import { buildDeclaredFlowGraphs, type FlowOpenApiSource } from '@api-schema-flow/flow'

const URI = 'memory://inference/openapi.yaml'

export function pointer(value: string): SourcePointer {
  return { uri: URI, pointer: value }
}

function scalarSchema(
  source: SourcePointer,
  options: {
    readonly type?: string
    readonly format?: string
    readonly readOnly?: boolean
    readonly writeOnly?: boolean
  } = {},
): NormalizedSchema {
  return {
    types: [options.type ?? 'string'],
    ...(options.format === undefined ? {} : { format: options.format }),
    required: [],
    readOnly: options.readOnly ?? false,
    writeOnly: options.writeOnly ?? false,
    nullable: false,
    enumValues: [],
    properties: {},
    allOf: [],
    oneOf: [],
    anyOf: [],
    source,
  }
}

function objectSchema(
  source: SourcePointer,
  properties: Readonly<Record<string, NormalizedSchema>>,
): NormalizedSchema {
  return {
    types: ['object'],
    required: Object.keys(properties),
    readOnly: false,
    writeOnly: false,
    nullable: false,
    enumValues: [],
    properties,
    allOf: [],
    oneOf: [],
    anyOf: [],
    source,
  }
}

function arraySchema(source: SourcePointer, items: NormalizedSchema): NormalizedSchema {
  return {
    types: ['array'],
    required: [],
    readOnly: false,
    writeOnly: false,
    nullable: false,
    enumValues: [],
    properties: {},
    items,
    allOf: [],
    oneOf: [],
    anyOf: [],
    source,
  }
}

function response(
  operationPointer: string,
  statusCode: string,
  schema?: NormalizedSchema,
  links: NormalizedResponse['links'] = [],
): NormalizedResponse {
  return {
    statusCode,
    description: 'Synthetic response',
    content:
      schema === undefined
        ? []
        : [
            {
              mediaType: 'application/json',
              schema,
              source: pointer(`${operationPointer}/responses/${statusCode}/content/application~1json`),
            },
          ],
    links,
    source: pointer(`${operationPointer}/responses/${statusCode}`),
  }
}

function parameter(
  operationPointer: string,
  name: string,
  location: NormalizedParameter['location'],
  schema: NormalizedSchema,
  index = 0,
): NormalizedParameter {
  return {
    name,
    location,
    required: location === 'path',
    deprecated: false,
    schema,
    source: pointer(`${operationPointer}/parameters/${index}`),
  }
}

function operation(
  method: NormalizedOperation['method'],
  path: string,
  operationId: string,
  options: {
    readonly tags?: readonly string[]
    readonly parameters?: readonly NormalizedParameter[]
    readonly responses?: readonly NormalizedResponse[]
    readonly security?: NormalizedOperation['security']
  } = {},
): NormalizedOperation {
  const encodedPath = path.replaceAll('~', '~0').replaceAll('/', '~1')
  return {
    id: `operation:${method}:${path}`,
    operationId,
    method,
    path,
    tags: options.tags ?? [],
    deprecated: false,
    parameters: options.parameters ?? [],
    responses: options.responses ?? [],
    security: options.security ?? [],
    servers: [],
    source: pointer(`#/paths/${encodedPath}/${method}`),
  }
}

export function createInferenceSource(options: { readonly declaredLink?: boolean } = {}): FlowOpenApiSource {
  const loginPointer = '#/paths/~1auth~1login/post'
  const createPointer = '#/paths/~1reservations/post'
  const getPointer = '#/paths/~1reservations~1{id}/get'
  const spacesPointer = '#/paths/~1spaces~1available/get'
  const userPointer = '#/paths/~1users~1{id}/get'

  const loginSchema = objectSchema(pointer(`${loginPointer}/responses/200/schema`), {
    token: scalarSchema(pointer(`${loginPointer}/responses/200/schema/properties/token`)),
  })
  const reservationSchema = objectSchema(pointer(`${createPointer}/responses/201/schema`), {
    id: scalarSchema(pointer(`${createPointer}/responses/201/schema/properties/id`), {
      format: 'uuid',
    }),
  })
  const spacesSchema = arraySchema(
    pointer(`${spacesPointer}/responses/200/schema`),
    objectSchema(pointer(`${spacesPointer}/responses/200/schema/items`), {
      id: scalarSchema(pointer(`${spacesPointer}/responses/200/schema/items/properties/id`), {
        format: 'uuid',
      }),
    }),
  )
  const idSchema = scalarSchema(pointer(`${getPointer}/parameters/0/schema`), {
    format: 'uuid',
  })
  const userIdSchema = scalarSchema(pointer(`${userPointer}/parameters/0/schema`), {
    format: 'uuid',
  })
  const link = {
    name: 'GetReservation',
    target: { type: 'operationId' as const, operationId: 'getReservation' },
    resolvedOperationKey: 'operation:get:/reservations/{id}',
    parameters: [{ target: 'id', expression: '$response.body#/id' }],
    source: pointer(`${createPointer}/responses/201/links/GetReservation`),
  }

  const operations = [
    operation('post', '/auth/login', 'login', {
      tags: ['Auth'],
      responses: [response(loginPointer, '200', loginSchema)],
    }),
    operation('get', '/spaces/available', 'listAvailableSpaces', {
      tags: ['Spaces'],
      responses: [response(spacesPointer, '200', spacesSchema)],
      security: [{ requirementIndex: 0, scheme: 'bearerAuth', scopes: [] }],
    }),
    operation('post', '/reservations', 'createReservation', {
      tags: ['Reservations'],
      responses: [response(createPointer, '201', reservationSchema, options.declaredLink ? [link] : [])],
      security: [{ requirementIndex: 0, scheme: 'bearerAuth', scopes: [] }],
    }),
    operation('get', '/reservations/{id}', 'getReservation', {
      tags: ['Reservations'],
      parameters: [parameter(getPointer, 'id', 'path', idSchema)],
      responses: [response(getPointer, '200', reservationSchema)],
      security: [{ requirementIndex: 0, scheme: 'bearerAuth', scopes: [] }],
    }),
    operation('get', '/users/{id}', 'getUser', {
      tags: ['Users'],
      parameters: [parameter(userPointer, 'id', 'path', userIdSchema)],
      responses: [response(userPointer, '200')],
    }),
  ]

  const document: NormalizedApiDocument = {
    schemaVersion: '1.0',
    sourceUri: URI,
    openapiVersion: '3.1.0',
    compatibilityMode: false,
    info: { title: 'Inference fixture', version: '1.0.0' },
    tags: ['Auth', 'Spaces', 'Reservations', 'Users'],
    servers: [],
    operations,
    componentSchemas: [],
  }

  return { sourceId: 'api', sourceName: 'api', document }
}

export function createInferenceInput(options: { readonly declaredLink?: boolean } = {}) {
  const source = createInferenceSource(options)
  const declared = buildDeclaredFlowGraphs({ openApiSources: [source] })
  return {
    source,
    input: {
      openApiSources: [source],
      declaredOperationGraph: declared.operationGraph,
    },
  }
}
