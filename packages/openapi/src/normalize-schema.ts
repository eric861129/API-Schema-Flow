import {
  appendSourcePointer,
  type NormalizedSchema,
  type SourcePointer,
} from '@api-schema-flow/domain'

import {
  booleanValue,
  isRecord,
  sortedRecordEntries,
  stringArray,
  stringValue,
} from './openapi-like.js'

const REDACTED_VALUE = '[REDACTED]'
const SECRET_SCHEMA_KEYS = new Set([
  'accesstoken',
  'apikey',
  'authorization',
  'clientsecret',
  'cookie',
  'idtoken',
  'password',
  'refreshtoken',
  'secret',
  'setcookie',
  'token',
  'xapikey',
])

export type SchemaReferenceResolver = (
  reference: string,
  source: SourcePointer,
) => SourcePointer | undefined

function normalizeTypes(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  return stringArray(value).sort()
}

function normalizeSecretKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function isSecretSchemaKey(key: string | undefined): boolean {
  return key !== undefined && SECRET_SCHEMA_KEYS.has(normalizeSecretKey(key))
}

export function redactSchemaProjection(value: unknown, sensitive = false): unknown {
  if (sensitive) return REDACTED_VALUE
  if (Array.isArray(value)) return value.map((entry) => redactSchemaProjection(entry))
  if (!isRecord(value)) return value

  const redacted: Record<string, unknown> = {}
  for (const [key, nestedValue] of Object.entries(value)) {
    redacted[key] = isSecretSchemaKey(key) ? REDACTED_VALUE : redactSchemaProjection(nestedValue)
  }
  return redacted
}

function emptySchema(source: SourcePointer, ref?: string): NormalizedSchema {
  return {
    source,
    ...(ref === undefined ? {} : { ref }),
    types: [],
    required: [],
    properties: {},
    enumValues: [],
    allOf: [],
    anyOf: [],
    oneOf: [],
    nullable: false,
    readOnly: false,
    writeOnly: false,
    deprecated: false,
  }
}

export function normalizeSchema(
  value: unknown,
  source: SourcePointer,
  ancestors: WeakSet<object> = new WeakSet(),
  propertyName?: string,
  referenceResolver?: SchemaReferenceResolver,
): NormalizedSchema | undefined {
  if (!isRecord(value)) return undefined

  if (ancestors.has(value)) {
    return emptySchema(source, stringValue(value.$ref) ?? '#circular')
  }

  ancestors.add(value)
  try {
    const properties: Record<string, NormalizedSchema> = {}
    for (const [name, property] of sortedRecordEntries(value.properties)) {
      const normalized = normalizeSchema(
        property,
        appendSourcePointer(source, ['properties', name]),
        ancestors,
        name,
        referenceResolver,
      )
      if (normalized) properties[name] = normalized
    }

    const normalizeCollection = (key: 'allOf' | 'anyOf' | 'oneOf'): NormalizedSchema[] => {
      if (!Array.isArray(value[key])) return []
      return value[key].flatMap((entry, index) => {
        const normalized = normalizeSchema(
          entry,
          appendSourcePointer(source, [key, String(index)]),
          ancestors,
          propertyName,
          referenceResolver,
        )
        return normalized ? [normalized] : []
      })
    }

    const items = normalizeSchema(
      value.items,
      appendSourcePointer(source, ['items']),
      ancestors,
      propertyName,
      referenceResolver,
    )
    const additionalProperties =
      typeof value.additionalProperties === 'boolean'
        ? value.additionalProperties
        : normalizeSchema(
            value.additionalProperties,
            appendSourcePointer(source, ['additionalProperties']),
            ancestors,
            propertyName,
            referenceResolver,
          )

    const ref = stringValue(value.$ref)
    const resolvedRef =
      ref === undefined
        ? undefined
        : referenceResolver?.(ref, appendSourcePointer(source, ['$ref']))
    const format = stringValue(value.format)
    const title = stringValue(value.title)
    const description = stringValue(value.description)
    const sensitive = isSecretSchemaKey(propertyName) || format === 'password'

    return {
      source,
      ...(ref === undefined ? {} : { ref }),
      ...(resolvedRef === undefined ? {} : { resolvedRef }),
      types: normalizeTypes(value.type),
      ...(format === undefined ? {} : { format }),
      ...(title === undefined ? {} : { title }),
      ...(description === undefined ? {} : { description }),
      required: [...new Set(stringArray(value.required))].sort(),
      properties,
      ...(items === undefined ? {} : { items }),
      enumValues: Array.isArray(value.enum)
        ? value.enum.map((entry) => redactSchemaProjection(entry, sensitive))
        : [],
      ...(!Object.hasOwn(value, 'example')
        ? {}
        : { example: redactSchemaProjection(value.example, sensitive) }),
      ...(!Object.hasOwn(value, 'default')
        ? {}
        : { defaultValue: redactSchemaProjection(value.default, sensitive) }),
      allOf: normalizeCollection('allOf'),
      anyOf: normalizeCollection('anyOf'),
      oneOf: normalizeCollection('oneOf'),
      ...(additionalProperties === undefined ? {} : { additionalProperties }),
      nullable: booleanValue(value.nullable),
      readOnly: booleanValue(value.readOnly),
      writeOnly: booleanValue(value.writeOnly),
      deprecated: booleanValue(value.deprecated),
    }
  } finally {
    ancestors.delete(value)
  }
}
