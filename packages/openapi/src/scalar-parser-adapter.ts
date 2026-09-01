import { DIAGNOSTIC_CODES, sortDiagnostics, type Diagnostic } from '@api-schema-flow/diagnostics'
import { validate } from '@scalar/openapi-parser'

import type { OpenApiParserAdapter, OpenApiParserResult } from './parser-adapter.js'

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  if (error !== null && typeof error === 'object' && 'message' in error) {
    const message = Reflect.get(error, 'message')
    if (typeof message === 'string') return message
  }
  return String(error)
}

export class ScalarOpenApiParserAdapter implements OpenApiParserAdapter {
  async parse(source: Parameters<OpenApiParserAdapter['parse']>[0]): Promise<OpenApiParserResult> {
    try {
      const result = await validate(source.contents)
      if (result.valid && result.schema) {
        return { document: result.schema, diagnostics: [] }
      }

      const errors = result.errors ?? []
      const diagnostics: Diagnostic[] =
        errors.length === 0
          ? [
              {
                code: DIAGNOSTIC_CODES.OPENAPI_PARSE_FAILED,
                severity: 'error',
                message: 'OpenAPI validation failed without a parser diagnostic.',
                source: { uri: source.uri, pointer: '#' },
              },
            ]
          : errors.map((error) => ({
              code: DIAGNOSTIC_CODES.OPENAPI_PARSE_FAILED,
              severity: 'error' as const,
              message: errorMessage(error),
              source: { uri: source.uri, pointer: '#' },
            }))

      return { diagnostics: sortDiagnostics(diagnostics) }
    } catch (error) {
      return {
        diagnostics: [
          {
            code: DIAGNOSTIC_CODES.OPENAPI_PARSE_FAILED,
            severity: 'error',
            message: errorMessage(error),
            source: { uri: source.uri, pointer: '#' },
          },
        ],
      }
    }
  }
}
