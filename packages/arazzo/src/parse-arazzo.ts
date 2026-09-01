import { createSourcePointer } from '@api-schema-flow/domain'
import {
  DIAGNOSTIC_CODES,
  sortDiagnostics,
  type Diagnostic,
} from '@api-schema-flow/diagnostics'
import type { SourceDocument } from '@api-schema-flow/source-loader'
import { parseDocument } from 'yaml'

import { isRecord, type UnknownRecord } from './object-utils.js'
import { detectArazzoVersion } from './version.js'

export interface ParseArazzoSourceResult {
  readonly document?: UnknownRecord
  readonly version?: string
  readonly compatibilityMode?: boolean
  readonly diagnostics: readonly Diagnostic[]
}

function parserMessage(source: SourceDocument, reasons: readonly string[]): Diagnostic {
  return {
    code: DIAGNOSTIC_CODES.ARAZZO_PARSE_FAILED,
    severity: 'error',
    message:
      reasons.length === 0
        ? 'Arazzo source could not be parsed as JSON or YAML.'
        : reasons.join('; '),
    source: createSourcePointer(source.uri),
  }
}

function parseValue(source: SourceDocument): {
  readonly value?: unknown
  readonly diagnostics: readonly Diagnostic[]
} {
  if (source.contents.trim().length === 0) {
    return {
      diagnostics: [parserMessage(source, ['Arazzo source document is empty.'])],
    }
  }

  try {
    const parsed = parseDocument(source.contents, {
      customTags: [],
      merge: false,
      prettyErrors: false,
      schema: 'core',
      strict: true,
      uniqueKeys: true,
    })
    const reasons = [
      ...parsed.errors.map(({ message }) => message),
      ...parsed.warnings.map(({ message }) => message),
    ]
    if (reasons.length > 0) {
      return { diagnostics: [parserMessage(source, reasons)] }
    }

    return {
      value: parsed.toJS({ maxAliasCount: 100 }),
      diagnostics: [],
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return { diagnostics: [parserMessage(source, [message])] }
  }
}

export function parseArazzoSource(source: SourceDocument): ParseArazzoSourceResult {
  const parsed = parseValue(source)
  if (parsed.value === undefined || parsed.diagnostics.length > 0) {
    return { diagnostics: sortDiagnostics(parsed.diagnostics) }
  }

  if (!isRecord(parsed.value)) {
    return {
      diagnostics: [
        {
          code: DIAGNOSTIC_CODES.ARAZZO_ROOT_INVALID,
          severity: 'error',
          message: 'Arazzo source must contain a JSON or YAML object.',
          source: createSourcePointer(source.uri),
        },
      ],
    }
  }

  const version = detectArazzoVersion(parsed.value, source.uri)
  if (!version.version) {
    return { diagnostics: sortDiagnostics(version.diagnostics) }
  }

  return {
    document: parsed.value,
    version: version.version,
    compatibilityMode: version.compatibilityMode ?? false,
    diagnostics: sortDiagnostics(version.diagnostics),
  }
}

export function looksLikeArazzoSource(source: SourceDocument): boolean {
  const parsed = parseValue(source)
  return (
    parsed.diagnostics.length === 0 &&
    isRecord(parsed.value) &&
    typeof parsed.value.arazzo === 'string'
  )
}
