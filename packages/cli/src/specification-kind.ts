import { DIAGNOSTIC_CODES, type Diagnostic } from '@api-schema-flow/diagnostics'
import type { SourceDocument } from '@api-schema-flow/source-loader'

export type SpecificationKind = 'openapi' | 'arazzo'

export interface DetectSpecificationKindResult {
  readonly kind?: SpecificationKind
  readonly diagnostics: readonly Diagnostic[]
}

function jsonKind(contents: string): SpecificationKind | undefined {
  try {
    const parsed: unknown = JSON.parse(contents)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return undefined
    if ('arazzo' in parsed) return 'arazzo'
    if ('openapi' in parsed || 'swagger' in parsed) return 'openapi'
  } catch {
    return undefined
  }
  return undefined
}

function yamlKind(contents: string): SpecificationKind | undefined {
  for (const rawLine of contents.split(/\r?\n/u)) {
    const line = rawLine.trimEnd()
    if (line.trim().length === 0 || line.trimStart().startsWith('#') || line.trim() === '---') {
      continue
    }
    if (/^arazzo\s*:/u.test(line)) return 'arazzo'
    if (/^(?:openapi|swagger)\s*:/u.test(line)) return 'openapi'
    return undefined
  }
  return undefined
}

export function detectSpecificationKind(source: SourceDocument): DetectSpecificationKindResult {
  const trimmed = source.contents.trimStart()
  const kind = trimmed.startsWith('{') ? jsonKind(source.contents) : yamlKind(source.contents)
  if (kind) return { kind, diagnostics: [] }

  return {
    diagnostics: [
      {
        code: DIAGNOSTIC_CODES.CLI_SPECIFICATION_UNKNOWN,
        severity: 'error',
        message: 'Source is neither a recognizable OpenAPI nor Arazzo document.',
        source: { uri: source.uri, pointer: '#' },
      },
    ],
  }
}
