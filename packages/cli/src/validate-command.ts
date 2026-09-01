import {
  DIAGNOSTIC_CODES,
  formatDiagnostic,
  hasDiagnosticErrors,
  sortDiagnostics,
  type Diagnostic,
} from '@api-schema-flow/diagnostics'
import { processOpenApi as defaultProcessOpenApi } from '@api-schema-flow/openapi'
import { redactSecrets, redactText } from '@api-schema-flow/redaction'
import { createSourceDocument } from '@api-schema-flow/source-loader'

import type { CliDependencies, CliIo } from './run-cli.js'

export interface ValidationReport {
  readonly schemaVersion: '1.0'
  readonly command: 'validate'
  readonly source: string
  readonly valid: boolean
  readonly openapiVersion?: string
  readonly compatibilityMode?: boolean
  readonly operationCount: number
  readonly schemaCount: number
  readonly diagnostics: readonly Diagnostic[]
}

const LOCAL_INPUT_ERROR_CODES = new Set(['EACCES', 'EISDIR', 'ENOENT', 'ENOTDIR', 'EPERM'])

function mediaTypeForPath(path: string): string | undefined {
  if (path.endsWith('.json')) return 'application/json'
  if (path.endsWith('.yaml') || path.endsWith('.yml')) return 'application/yaml'
  return undefined
}

function isLocalInputError(error: unknown): error is Error & { readonly code: string } {
  if (!(error instanceof Error) || !('code' in error)) return false
  return typeof error.code === 'string' && LOCAL_INPUT_ERROR_CODES.has(error.code)
}

function sanitizeDiagnostic(diagnostic: Diagnostic): Diagnostic {
  return {
    ...diagnostic,
    message: redactText(diagnostic.message),
    ...(diagnostic.details === undefined
      ? {}
      : { details: redactSecrets(diagnostic.details) }),
  }
}

function writeHumanReport(report: ValidationReport, io: CliIo): void {
  const writer = report.valid ? io.stdout : io.stderr
  const errors = report.diagnostics.filter(({ severity }) => severity === 'error').length
  const warnings = report.diagnostics.filter(({ severity }) => severity === 'warning').length
  const lines = [
    'API Schema Flow',
    '',
    report.valid ? '✓ OpenAPI document loaded' : '✗ OpenAPI document is invalid',
    ...(report.openapiVersion ? [`✓ OpenAPI ${report.openapiVersion} detected`] : []),
    `✓ ${report.operationCount} operations normalized`,
    `✓ ${report.schemaCount} schemas discovered`,
    `${errors === 0 ? '✓' : '✗'} ${errors} errors`,
    `${warnings === 0 ? '✓' : '⚠'} ${warnings} warnings`,
  ]

  if (report.diagnostics.length > 0) {
    lines.push('', ...report.diagnostics.map(formatDiagnostic))
  }
  lines.push('', report.valid ? 'Validation completed successfully.' : 'Validation failed.')
  writer(`${lines.join('\n')}\n`)
}

function writeReport(report: ValidationReport, json: boolean, io: CliIo): void {
  if (json) io.stdout(`${JSON.stringify(report, null, 2)}\n`)
  else writeHumanReport(report, io)
}

function createInputFailureReport(
  filePath: string,
  error: Error & { readonly code: string },
): ValidationReport {
  return {
    schemaVersion: '1.0',
    command: 'validate',
    source: filePath,
    valid: false,
    operationCount: 0,
    schemaCount: 0,
    diagnostics: [
      {
        code: DIAGNOSTIC_CODES.CLI_INPUT,
        severity: 'error',
        message: `Unable to read local file "${filePath}".`,
        source: { uri: filePath, pointer: '#' },
        details: {
          code: error.code,
          reason: redactText(error.message),
        },
      },
    ],
  }
}

export async function executeValidateCommand(
  filePath: string,
  json: boolean,
  dependencies: CliDependencies,
  io: CliIo,
): Promise<number> {
  let contents: string
  try {
    contents = await dependencies.readFile(filePath)
  } catch (error) {
    if (!isLocalInputError(error)) throw error
    writeReport(createInputFailureReport(filePath, error), json, io)
    return 2
  }

  const mediaType = mediaTypeForPath(filePath)
  const sourceResult = createSourceDocument({
    uri: filePath,
    contents,
    ...(mediaType === undefined ? {} : { mediaType }),
  })
  const processor = dependencies.processOpenApi ?? defaultProcessOpenApi
  const processed = sourceResult.source
    ? await processor(sourceResult.source)
    : { diagnostics: sourceResult.diagnostics }
  const diagnostics = sortDiagnostics(processed.diagnostics.map(sanitizeDiagnostic))
  const valid = Boolean(processed.document) && !hasDiagnosticErrors(diagnostics)
  const report: ValidationReport = {
    schemaVersion: '1.0',
    command: 'validate',
    source: filePath,
    valid,
    ...(processed.document === undefined
      ? {}
      : {
          openapiVersion: processed.document.openapiVersion,
          compatibilityMode: processed.document.compatibilityMode,
        }),
    operationCount: processed.document?.operations.length ?? 0,
    schemaCount: processed.document?.componentSchemas.length ?? 0,
    diagnostics,
  }

  writeReport(report, json, io)
  return valid ? 0 : sourceResult.source ? 1 : 2
}
