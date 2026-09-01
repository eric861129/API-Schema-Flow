import { appendSourcePointer, type SourcePointer } from '@api-schema-flow/domain'
import type { Diagnostic } from '@api-schema-flow/diagnostics'

import { isRecord } from './object-utils.js'
import type { NormalizedArazzoValue } from './model.js'
import { parseRuntimeTemplate } from './runtime-template.js'

export interface NormalizeArazzoValueOptions {
  readonly parseRuntimeExpressions?: boolean
}

export interface NormalizeArazzoValueResult {
  readonly value: NormalizedArazzoValue
  readonly diagnostics: readonly Diagnostic[]
}

export function clonePreservedValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(clonePreservedValue)
  if (!isRecord(value)) return value

  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, clonePreservedValue(nested)]),
  )
}

function shouldParseRuntimeExpression(value: string): boolean {
  return value.includes('{$') || (value.startsWith('$') && !/\s/u.test(value))
}

export function normalizeArazzoValue(
  input: unknown,
  source: SourcePointer,
  options: NormalizeArazzoValueOptions = {},
): NormalizeArazzoValueResult {
  if (
    typeof input === 'string' &&
    options.parseRuntimeExpressions !== false &&
    shouldParseRuntimeExpression(input)
  ) {
    const parsed = parseRuntimeTemplate(input, source)
    if (parsed.expression) {
      return {
        value: { kind: 'expression', expression: parsed.expression, source },
        diagnostics: parsed.diagnostics,
      }
    }
    if (parsed.template) {
      return {
        value: { kind: 'template', template: parsed.template, source },
        diagnostics: parsed.diagnostics,
      }
    }
    return {
      value: { kind: 'literal', value: input, source },
      diagnostics: parsed.diagnostics,
    }
  }

  if (Array.isArray(input)) {
    const diagnostics: Diagnostic[] = []
    const items = input.map((entry, index) => {
      const normalized = normalizeArazzoValue(
        entry,
        appendSourcePointer(source, [String(index)]),
        options,
      )
      diagnostics.push(...normalized.diagnostics)
      return normalized.value
    })
    return { value: { kind: 'array', items, source }, diagnostics }
  }

  if (isRecord(input)) {
    const diagnostics: Diagnostic[] = []
    const properties: Record<string, NormalizedArazzoValue> = {}
    for (const [key, nested] of Object.entries(input).sort(([left], [right]) =>
      left.localeCompare(right),
    )) {
      const normalized = normalizeArazzoValue(
        nested,
        appendSourcePointer(source, [key]),
        options,
      )
      diagnostics.push(...normalized.diagnostics)
      properties[key] = normalized.value
    }
    return { value: { kind: 'object', properties, source }, diagnostics }
  }

  return {
    value: { kind: 'literal', value: clonePreservedValue(input), source },
    diagnostics: [],
  }
}
