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

function normalizeTypes(value: unknown): string[] {
  if (typeof value === 'string') return [value]
  return stringArray(value).sort()
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
        )
        return normalized ? [normalized] : []
      })
    }

    const items = normalizeSchema(value.items, appendSourcePointer(source, ['items']), ancestors)
    const additionalProperties =
      typeof value.additionalProperties === 'boolean'
        ? value.additionalProperties
        : normalizeSchema(
            value.additionalProperties,
            appendSourcePointer(source, ['additionalProperties']),
            ancestors,
          )

    const ref = stringValue(value.$ref)
    const format = stringValue(value.format)
    const title = stringValue(value.title)
    const description = stringValue(value.description)

    return {
      source,
      ...(ref === undefined ? {} : { ref }),
      types: normalizeTypes(value.type),
      ...(format === undefined ? {} : { format }),
      ...(title === undefined ? {} : { title }),
      ...(description === undefined ? {} : { description }),
      required: [...new Set(stringArray(value.required))].sort(),
      properties,
      ...(items === undefined ? {} : { items }),
      enumValues: Array.isArray(value.enum) ? [...value.enum] : [],
      ...(!Object.hasOwn(value, 'example') ? {} : { example: value.example }),
      ...(!Object.hasOwn(value, 'default') ? {} : { defaultValue: value.default }),
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
