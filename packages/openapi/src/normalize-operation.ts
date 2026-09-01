import {
  HTTP_METHODS,
  appendSourcePointer,
  createOperationId,
  createSourcePointer,
  type HttpMethod,
  type NormalizedMediaType,
  type NormalizedOperation,
  type NormalizedParameter,
  type NormalizedRequestBody,
  type NormalizedResponse,
  type NormalizedSecurityRequirement,
  type NormalizedServer,
  type ParameterLocation,
  type SourcePointer,
} from '@api-schema-flow/domain'

import {
  booleanValue,
  isRecord,
  sortedRecordEntries,
  stringArray,
  stringValue,
  type UnknownRecord,
} from './openapi-like.js'
import {
  normalizeSchema,
  redactSchemaProjection,
  type SchemaReferenceResolver,
} from './normalize-schema.js'

const PARAMETER_LOCATIONS = new Set<ParameterLocation>([
  'path',
  'query',
  'querystring',
  'header',
  'cookie',
])

function normalizeSchemaAt(
  value: unknown,
  source: SourcePointer,
  referenceResolver?: SchemaReferenceResolver,
) {
  return normalizeSchema(value, source, new WeakSet(), undefined, referenceResolver)
}

function normalizeContent(
  value: unknown,
  source: SourcePointer,
  referenceResolver?: SchemaReferenceResolver,
): NormalizedMediaType[] {
  return sortedRecordEntries(value).map(([mediaType, mediaValue]) => {
    const mediaSource = appendSourcePointer(source, [mediaType])
    const media = isRecord(mediaValue) ? mediaValue : {}
    const schema = normalizeSchemaAt(
      media.schema,
      appendSourcePointer(mediaSource, ['schema']),
      referenceResolver,
    )
    return {
      mediaType,
      source: mediaSource,
      ...(schema === undefined ? {} : { schema }),
      ...(!Object.hasOwn(media, 'example')
        ? {}
        : { example: redactSchemaProjection(media.example) }),
    }
  })
}

function normalizeParameter(
  value: unknown,
  source: SourcePointer,
  referenceResolver?: SchemaReferenceResolver,
): NormalizedParameter | undefined {
  if (!isRecord(value)) return undefined
  const name = stringValue(value.name)
  const location = stringValue(value.in)
  if (!name || !location || !PARAMETER_LOCATIONS.has(location as ParameterLocation)) {
    return undefined
  }

  const schema = normalizeSchemaAt(
    value.schema,
    appendSourcePointer(source, ['schema']),
    referenceResolver,
  )
  const description = stringValue(value.description)
  return {
    name,
    location: location as ParameterLocation,
    required: location === 'path' ? true : booleanValue(value.required),
    deprecated: booleanValue(value.deprecated),
    ...(description === undefined ? {} : { description }),
    ...(schema === undefined ? {} : { schema }),
    source,
  }
}

function normalizeParameters(
  pathParameters: unknown,
  operationParameters: unknown,
  pathSource: SourcePointer,
  operationSource: SourcePointer,
  referenceResolver?: SchemaReferenceResolver,
): NormalizedParameter[] {
  const merged = new Map<string, NormalizedParameter>()

  const add = (value: unknown, source: SourcePointer) => {
    const parameter = normalizeParameter(value, source, referenceResolver)
    if (parameter) merged.set(`${parameter.location}:${parameter.name}`, parameter)
  }

  if (Array.isArray(pathParameters)) {
    pathParameters.forEach((value, index) =>
      add(value, appendSourcePointer(pathSource, ['parameters', String(index)])),
    )
  }
  if (Array.isArray(operationParameters)) {
    operationParameters.forEach((value, index) =>
      add(value, appendSourcePointer(operationSource, ['parameters', String(index)])),
    )
  }

  return [...merged.values()].sort(
    (left, right) =>
      left.location.localeCompare(right.location) || left.name.localeCompare(right.name),
  )
}

function normalizeRequestBody(
  value: unknown,
  source: SourcePointer,
  referenceResolver?: SchemaReferenceResolver,
): NormalizedRequestBody | undefined {
  if (!isRecord(value)) return undefined
  const description = stringValue(value.description)
  return {
    required: booleanValue(value.required),
    ...(description === undefined ? {} : { description }),
    content: normalizeContent(
      value.content,
      appendSourcePointer(source, ['content']),
      referenceResolver,
    ),
    source,
  }
}

function normalizeResponses(
  value: unknown,
  source: SourcePointer,
  referenceResolver?: SchemaReferenceResolver,
): NormalizedResponse[] {
  return sortedRecordEntries(value).map(([statusCode, responseValue]) => {
    const responseSource = appendSourcePointer(source, [statusCode])
    const response = isRecord(responseValue) ? responseValue : {}
    return {
      statusCode,
      description: stringValue(response.description) ?? '',
      content: normalizeContent(
        response.content,
        appendSourcePointer(responseSource, ['content']),
        referenceResolver,
      ),
      source: responseSource,
    }
  })
}

export function normalizeSecurity(value: unknown): NormalizedSecurityRequirement[] {
  if (!Array.isArray(value)) return []

  return value.flatMap((requirement, requirementIndex) => {
    if (!isRecord(requirement)) return []
    return sortedRecordEntries(requirement).map(([scheme, scopes]) => ({
      requirementIndex,
      scheme,
      scopes: [...new Set(stringArray(scopes))].sort(),
    }))
  })
}

export function normalizeServers(value: unknown, source: SourcePointer): NormalizedServer[] {
  if (!Array.isArray(value)) return []
  return value
    .flatMap((entry, index) => {
      if (!isRecord(entry)) return []
      const url = stringValue(entry.url)
      if (!url) return []
      const description = stringValue(entry.description)
      return [
        {
          url,
          ...(description === undefined ? {} : { description }),
          source: appendSourcePointer(source, [String(index)]),
        },
      ]
    })
    .sort((left, right) => left.url.localeCompare(right.url))
}

export interface NormalizeOperationInput {
  readonly sourceUri: string
  readonly path: string
  readonly method: HttpMethod
  readonly pathItem: UnknownRecord
  readonly operation: UnknownRecord
  readonly rootSecurity: unknown
  readonly rootServers: unknown
  readonly referenceResolver?: SchemaReferenceResolver
}

export function normalizeOperation(input: NormalizeOperationInput): NormalizedOperation {
  const pathSource = createSourcePointer(input.sourceUri, ['paths', input.path])
  const operationSource = appendSourcePointer(pathSource, [input.method])
  const securityValue = Object.hasOwn(input.operation, 'security')
    ? input.operation.security
    : input.rootSecurity

  let serverValue: unknown
  let serverSource: SourcePointer
  if (Object.hasOwn(input.operation, 'servers')) {
    serverValue = input.operation.servers
    serverSource = appendSourcePointer(operationSource, ['servers'])
  } else if (Object.hasOwn(input.pathItem, 'servers')) {
    serverValue = input.pathItem.servers
    serverSource = appendSourcePointer(pathSource, ['servers'])
  } else {
    serverValue = input.rootServers
    serverSource = createSourcePointer(input.sourceUri, ['servers'])
  }

  const requestBody = normalizeRequestBody(
    input.operation.requestBody,
    appendSourcePointer(operationSource, ['requestBody']),
    input.referenceResolver,
  )
  const operationId = stringValue(input.operation.operationId)
  const summary = stringValue(input.operation.summary)
  const description = stringValue(input.operation.description)

  return {
    id: createOperationId(input.method, input.path),
    ...(operationId === undefined ? {} : { operationId }),
    method: input.method,
    path: input.path,
    ...(summary === undefined ? {} : { summary }),
    ...(description === undefined ? {} : { description }),
    tags: [...new Set(stringArray(input.operation.tags))].sort(),
    deprecated: booleanValue(input.operation.deprecated),
    parameters: normalizeParameters(
      input.pathItem.parameters,
      input.operation.parameters,
      pathSource,
      operationSource,
      input.referenceResolver,
    ),
    ...(requestBody === undefined ? {} : { requestBody }),
    responses: normalizeResponses(
      input.operation.responses,
      appendSourcePointer(operationSource, ['responses']),
      input.referenceResolver,
    ),
    security: normalizeSecurity(securityValue),
    servers: normalizeServers(serverValue, serverSource),
    source: operationSource,
  }
}

export function operationMethodOrder(method: HttpMethod): number {
  return HTTP_METHODS.indexOf(method)
}
