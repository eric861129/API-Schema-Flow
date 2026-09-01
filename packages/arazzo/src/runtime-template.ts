import type { SourcePointer } from '@api-schema-flow/domain'
import { DIAGNOSTIC_CODES, type Diagnostic } from '@api-schema-flow/diagnostics'

import {
  parseRuntimeExpression,
  type RuntimeExpression,
} from './runtime-expression.js'

export interface RuntimeTemplateLiteralSegment {
  readonly kind: 'literal'
  readonly value: string
}

export interface RuntimeTemplateExpressionSegment {
  readonly kind: 'expression'
  readonly expression: RuntimeExpression
}

export type RuntimeTemplateSegment =
  | RuntimeTemplateLiteralSegment
  | RuntimeTemplateExpressionSegment

export interface RuntimeTemplate {
  readonly kind: 'template'
  readonly raw: string
  readonly segments: readonly RuntimeTemplateSegment[]
  readonly source?: SourcePointer
}

export interface ParseRuntimeTemplateResult {
  readonly expression?: RuntimeExpression
  readonly template?: RuntimeTemplate
  readonly diagnostics: readonly Diagnostic[]
}

function invalidTemplate(raw: string, source?: SourcePointer): ParseRuntimeTemplateResult {
  return {
    diagnostics: [
      {
        code: DIAGNOSTIC_CODES.ARAZZO_RUNTIME_EXPRESSION_INVALID,
        severity: 'error',
        message: `Invalid Arazzo Runtime Expression template: "${raw}".`,
        ...(source === undefined ? {} : { source }),
        details: { raw },
      },
    ],
  }
}

export function parseRuntimeTemplate(
  raw: string,
  source?: SourcePointer,
): ParseRuntimeTemplateResult {
  if (raw.startsWith('$') && !raw.includes('{') && !raw.includes('}')) {
    const parsed = parseRuntimeExpression(raw, source)
    return {
      ...(parsed.expression === undefined ? {} : { expression: parsed.expression }),
      diagnostics: parsed.diagnostics,
    }
  }

  if (!raw.includes('{') && !raw.includes('}')) {
    return {
      template: {
        kind: 'template',
        raw,
        segments: [{ kind: 'literal', value: raw }],
        ...(source === undefined ? {} : { source }),
      },
      diagnostics: [],
    }
  }

  const segments: RuntimeTemplateSegment[] = []
  let cursor = 0
  while (cursor < raw.length) {
    const opening = raw.indexOf('{', cursor)
    const strayClosing = raw.indexOf('}', cursor)
    if (strayClosing !== -1 && (opening === -1 || strayClosing < opening)) {
      return invalidTemplate(raw, source)
    }

    if (opening === -1) {
      const literal = raw.slice(cursor)
      if (literal.length > 0) segments.push({ kind: 'literal', value: literal })
      break
    }

    const closing = raw.indexOf('}', opening + 1)
    if (closing === -1) return invalidTemplate(raw, source)
    const nestedOpening = raw.indexOf('{', opening + 1)
    if (nestedOpening !== -1 && nestedOpening < closing) {
      return invalidTemplate(raw, source)
    }

    const literal = raw.slice(cursor, opening)
    if (literal.length > 0) segments.push({ kind: 'literal', value: literal })

    const expressionRaw = raw.slice(opening + 1, closing)
    const parsed = parseRuntimeExpression(expressionRaw, source)
    if (!parsed.expression) return invalidTemplate(raw, source)
    segments.push({ kind: 'expression', expression: parsed.expression })
    cursor = closing + 1
  }

  if (segments.length === 0) return invalidTemplate(raw, source)
  return {
    template: {
      kind: 'template',
      raw,
      segments,
      ...(source === undefined ? {} : { source }),
    },
    diagnostics: [],
  }
}

export type RuntimeDependencyInput =
  | string
  | RuntimeExpression
  | RuntimeTemplate
  | undefined

export function runtimeExpressionStepDependencies(
  input: RuntimeDependencyInput,
): readonly string[] {
  if (input === undefined) return []
  if (typeof input === 'string') {
    const parsed = parseRuntimeTemplate(input)
    return runtimeExpressionStepDependencies(parsed.expression ?? parsed.template)
  }
  if (input.kind === 'step-output') return [input.stepId]
  if (input.kind !== 'template') return []

  return [
    ...new Set(
      input.segments.flatMap((segment) =>
        segment.kind === 'expression'
          ? runtimeExpressionStepDependencies(segment.expression)
          : [],
      ),
    ),
  ].sort()
}
