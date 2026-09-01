import {
  formatDiagnostic,
  hasDiagnosticErrors,
  sortDiagnostics,
  type Diagnostic,
} from '@api-schema-flow/diagnostics'
import { processOpenApi as defaultProcessOpenApi } from '@api-schema-flow/openapi'
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

function mediaTypeForPath(path: string): string | undefined {
  if (path.endsWith('.json')) return 'application/json'
  if (path.endsWith('.yaml') || path.endsWith('.yml')) return 'application/yaml'
  return undefined
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

export async function executeValidateCommand(
  filePath: string,
  json: boolean,
  dependencies: CliDependencies,
  io: CliIo,
): Promise<number> {
  const contents = await dependencies.readFile(filePath)
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
  const diagnostics = sortDiagnostics(processed.diagnostics)
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

  if (json) io.stdout(`${JSON.stringify(report, null, 2)}\n`)
  else writeHumanReport(report, io)

  return valid ? 0 : sourceResult.source ? 1 : 2
}
