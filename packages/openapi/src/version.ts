import { createSourcePointer } from '@api-schema-flow/domain'
import { DIAGNOSTIC_CODES, type Diagnostic } from '@api-schema-flow/diagnostics'

import { isRecord, stringValue } from './openapi-like.js'

export interface OpenApiVersionResult {
  readonly version?: string
  readonly compatibilityMode: boolean
  readonly diagnostics: readonly Diagnostic[]
}

export function detectOpenApiVersion(input: unknown, sourceUri: string): OpenApiVersionResult {
  const version = isRecord(input) ? stringValue(input.openapi) : undefined
  const source = createSourcePointer(sourceUri, ['openapi'])

  if (!version || !/^3\.\d+\.\d+(?:[-+].*)?$/.test(version)) {
    return {
      compatibilityMode: false,
      diagnostics: [
        {
          code: DIAGNOSTIC_CODES.OPENAPI_VERSION_UNSUPPORTED,
          severity: 'error',
          message: 'A supported OpenAPI 3.x version is required.',
          source,
        },
      ],
    }
  }

  if (version.startsWith('3.0.') || version.startsWith('3.1.')) {
    return { version, compatibilityMode: false, diagnostics: [] }
  }

  if (version.startsWith('3.2.')) {
    return {
      version,
      compatibilityMode: true,
      diagnostics: [
        {
          code: DIAGNOSTIC_CODES.OPENAPI_COMPATIBILITY_MODE,
          severity: 'warning',
          message: 'OpenAPI 3.2 is loaded in compatibility mode; unknown semantics are preserved.',
          source,
        },
      ],
    }
  }

  return {
    compatibilityMode: false,
    diagnostics: [
      {
        code: DIAGNOSTIC_CODES.OPENAPI_VERSION_UNSUPPORTED,
        severity: 'error',
        message: `OpenAPI ${version} is not supported by this release.`,
        source,
      },
    ],
  }
}
