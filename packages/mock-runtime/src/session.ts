import type { NormalizedOperation, NormalizedSchema } from '@api-schema-flow/domain'

export interface MockSessionSummary {
  readonly entityCount: number
  readonly revision: number
}

export interface MockResponse {
  readonly status: number
  readonly body: Readonly<Record<string, unknown>>
  readonly mutation: 'created' | 'read' | 'not-found'
  readonly summary: MockSessionSummary
}

interface ObjectShape {
  readonly properties: Readonly<Record<string, NormalizedSchema>>
  readonly required: ReadonlySet<string>
  readonly additionalProperties: boolean
}

function shape(schema: NormalizedSchema | undefined): ObjectShape | undefined {
  if (!schema || schema.anyOf.length || schema.oneOf.length) return undefined
  if (!schema.types.includes('object') && schema.allOf.length === 0) return undefined
  const parts = schema.allOf.length ? schema.allOf : [schema]
  if (parts.some((part) => part.allOf.length || part.anyOf.length || part.oneOf.length))
    return undefined
  return {
    properties: Object.assign({}, ...parts.map((part) => part.properties)) as Record<
      string,
      NormalizedSchema
    >,
    required: new Set(parts.flatMap((part) => part.required)),
    additionalProperties: parts.some((part) => part.additionalProperties !== false),
  }
}

function jsonSchema(operation: NormalizedOperation, status?: number): NormalizedSchema | undefined {
  const content =
    status === undefined
      ? operation.requestBody?.content
      : operation.responses.find((response) => response.statusCode === String(status))?.content
  return content?.find((item) => item.mediaType === 'application/json')?.schema
}

function fieldValid(value: unknown, schema: NormalizedSchema): boolean {
  if (value === null) return schema.nullable
  if (schema.enumValues.length && !schema.enumValues.includes(value)) return false
  if (schema.types.includes('integer')) return typeof value === 'number' && Number.isInteger(value)
  if (schema.types.includes('number')) return typeof value === 'number' && Number.isFinite(value)
  if (schema.types.includes('boolean')) return typeof value === 'boolean'
  if (schema.types.includes('string')) {
    if (typeof value !== 'string') return false
    if (schema.format === 'uuid')
      return /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/iu.test(value)
    if (schema.format === 'date-time') return !Number.isNaN(Date.parse(value))
    return true
  }
  return false
}

/** 只接受可明確建構的 POST collection → GET item 契約。 */
export function assessMockPair(
  create: NormalizedOperation,
  read: NormalizedOperation,
): string | null {
  if (create.method !== 'post' || read.method !== 'get' || read.path !== `${create.path}/{id}`)
    return 'Local Mock supports POST collection → GET collection/{id} only.'
  const request = shape(jsonSchema(create))
  const created = shape(jsonSchema(create, 201))
  const fetched = shape(jsonSchema(read, 200))
  if (!request || !created || !fetched)
    return 'Local Mock requires JSON object request, 201 response and 200 response schemas.'
  const id = created.properties.id
  if (!id?.types.includes('string') || (id.format && id.format !== 'uuid'))
    return 'Local Mock requires a string response id.'
  if (!fetched.properties.id?.types.includes('string'))
    return 'GET response must declare the same id field.'
  const generated = new Set(['id', 'createdAt', 'status'])
  if (
    [...created.required].some((name) => !request.required.has(name) && !generated.has(name)) ||
    [...fetched.required].some((name) => !created.required.has(name) && !generated.has(name))
  )
    return 'POST response has required fields that Local Mock cannot generate.'
  if (
    ((created.required.has('createdAt') || fetched.required.has('createdAt')) &&
      (!created.properties.createdAt?.types.includes('string') ||
        created.properties.createdAt.format !== 'date-time')) ||
    ((created.required.has('status') || fetched.required.has('status')) &&
      !created.properties.status?.enumValues.length)
  )
    return 'POST response has required fields that Local Mock cannot generate.'
  if ([...request.required].some((name) => !request.properties[name]))
    return 'POST request has required fields without a schema.'
  for (const [name, field] of Object.entries(request.properties)) {
    if (
      field.anyOf.length ||
      field.oneOf.length ||
      field.allOf.length ||
      !field.types.some((type) => ['string', 'number', 'integer', 'boolean'].includes(type))
    )
      return `Local Mock cannot validate request field "${name}".`
  }
  return null
}

function validateBody(
  body: unknown,
  operation: NormalizedOperation,
): asserts body is Record<string, unknown> {
  const request = shape(jsonSchema(operation))
  if (!request || !body || typeof body !== 'object' || Array.isArray(body))
    throw new Error('Enter a JSON object for the POST request body.')
  const values = body as Record<string, unknown>
  for (const name of request.required) {
    if (values[name] === undefined) throw new Error(`Required request field "${name}" is missing.`)
  }
  for (const [name, value] of Object.entries(values)) {
    const field = request.properties[name]
    if (!field) {
      if (!request.additionalProperties) throw new Error(`Unknown request field "${name}".`)
      continue
    }
    if (!fieldValid(value, field)) throw new Error(`Request field "${name}" has an invalid value.`)
  }
}

/** 單一記憶體工作階段；不連線、不寫入專案檔，可明確重設。 */
export class InMemoryMockSession {
  private readonly entities = new Map<string, Map<string, Readonly<Record<string, unknown>>>>()
  private nextId = 1
  private revision = 0

  get summary(): MockSessionSummary {
    return {
      entityCount: [...this.entities.values()].reduce((count, items) => count + items.size, 0),
      revision: this.revision,
    }
  }

  reset(): MockSessionSummary {
    this.entities.clear()
    this.nextId = 1
    this.revision += 1
    return this.summary
  }

  create(operation: NormalizedOperation, body: unknown): MockResponse {
    if (
      operation.method !== 'post' ||
      !operation.responses.some((item) => item.statusCode === '201')
    )
      throw new Error('Unsupported create operation.')
    validateBody(body, operation)
    const response = shape(jsonSchema(operation, 201))
    if (!response) throw new Error('POST 201 JSON schema is required.')
    const sequence = this.nextId++
    const id = `00000000-0000-4000-8000-${sequence.toString(16).padStart(12, '0')}`
    const generated: Record<string, unknown> = { id }
    if (response.properties.createdAt)
      generated.createdAt = new Date(Date.UTC(2025, 0, 1, 0, 0, sequence)).toISOString()
    if (response.properties.status?.enumValues.length)
      generated.status = response.properties.status.enumValues[0]
    const entity = { ...body, ...generated }
    const collection = this.entities.get(operation.path) ?? new Map()
    collection.set(id, entity)
    this.entities.set(operation.path, collection)
    this.revision += 1
    return { status: 201, body: entity, mutation: 'created', summary: this.summary }
  }

  read(operation: NormalizedOperation, id: string): MockResponse {
    if (operation.method !== 'get' || !operation.path.endsWith('/{id}'))
      throw new Error('Unsupported read operation.')
    const entity = this.entities.get(operation.path.slice(0, -5))?.get(id)
    if (!entity)
      return {
        status: 404,
        body: { code: 'not_found' },
        mutation: 'not-found',
        summary: this.summary,
      }
    return { status: 200, body: entity, mutation: 'read', summary: this.summary }
  }
}
