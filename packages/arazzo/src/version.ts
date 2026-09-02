import { createSourcePointer } from '@api-schema-flow/domain'
import { DIAGNOSTIC_CODES, type Diagnostic } from '@api-schema-flow/diagnostics'

import { isRecord, stringValue } from './object-utils.js'

export interface ArazzoVersionResult {
  readonly version?: string
  readonly compatibilityMode?: boolean
  readonly diagnostics: readonly Diagnostic[]
}

const SUPPORTED_ARAZZO_VERSION = /^1\.1\.\d+$/

export function detectArazzoVersion(input: unknown, sourceUri: string): ArazzoVersionResult {
  const version = isRecord(input) ? stringValue(input.arazzo) : undefined
  if (version !== undefined && SUPPORTED_ARAZZO_VERSION.test(version)) {
    return {
      version,
      compatibilityMode: false,
      diagnostics: [],
    }
  }

  return {
    diagnostics: [
      {
        code: DIAGNOSTIC_CODES.ARAZZO_VERSION_UNSUPPORTED,
        severity: 'error',
        message:
          version === undefined
            ? 'Arazzo version is missing or is not a string.'
            : `Arazzo version "${version}" is not supported; M2-A supports Arazzo 1.1.x.`,
        source: createSourcePointer(sourceUri, ['arazzo']),
        ...(version === undefined ? {} : { details: { version } }),
      },
    ],
  }
}
