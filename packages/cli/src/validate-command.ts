import path from 'node:path'

import {
  formatDiagnostic,
  hasDiagnosticErrors,
  sortDiagnostics,
  type Diagnostic,
} from '@api-schema-flow/diagnostics'
import { processOpenApiLocation as defaultProcessOpenApiLocation } from '@api-schema-flow/openapi'
import { redactSecrets, redactText } from '@api-schema-flow/redaction'
import {
  createSourceRetrievalPolicy,
  type SourceLocation,
  type SourceRetrievalPolicy,
} from '@api-schema-flow/source-loader'
import { createNodeSourceAcquirer } from '@api-schema-flow/source-loader/node'

import type { CliDependencies, CliIo } from './run-cli.js'
import type { ValidateCommandOptions } from './validate-options.js'

export interface ValidationReport {
  readonly schemaVersion: '1.0'
  readonly command: 'validate'
  readonly source: string
  readonly valid: boolean
  readonly openapiVersion?: string
  readonly compatibilityMode?: boolean
  readonly fingerprint?: string
  readonly sourceCount?: number
  readonly referenceCount?: number
  readonly operationCount: number
  readonly schemaCount: number
  readonly diagnostics: readonly Diagnostic[]
}

function isUrlTarget(target: string): boolean {
  return /^https?:\/\//i.test(target)
}

function resolveFilePath(target: string, dependencies: CliDependencies): string {
  const resolvePath = dependencies.resolvePath ?? path.resolve
  const cwd = dependencies.cwd?.() ?? process.cwd()
  return resolvePath(cwd, target)
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)]
}

function sourceLocation(
  options: ValidateCommandOptions,
  dependencies: CliDependencies,
): SourceLocation {
  return isUrlTarget(options.target)
    ? { kind: 'url', url: options.target }
    : { kind: 'file', path: resolveFilePath(options.target, dependencies) }
}

function retrievalPolicy(
  options: ValidateCommandOptions,
  location: SourceLocation,
  dependencies: CliDependencies,
): SourceRetrievalPolicy {
  const dirname = dependencies.dirname ?? path.dirname
  const extraRoots = options.allowPaths.map((allowedPath) =>
    resolveFilePath(allowedPath, dependencies),
  )
  const allowedFileRoots = unique([
    ...(location.kind === 'file' ? [dirname(location.path)] : []),
    ...extraRoots,
  ])

  return createSourceRetrievalPolicy({
    mode: 'local-cli',
    allowedFileRoots,
    allowHttp: options.allowHttp,
    allowPrivateNetwork: options.allowPrivateNetwork,
    ...(options.maxDocuments === undefined ? {} : { maxDocuments: options.maxDocuments }),
    ...(options.maxTotalBytes === undefined ? {} : { maxTotalBytes: options.maxTotalBytes }),
    ...(options.maxReferenceDepth === undefined
      ? {}
      : { maxReferenceDepth: options.maxReferenceDepth }),
  })
}

function sanitizeDiagnostic(diagnostic: Diagnostic): Diagnostic {
  return {
    ...diagnostic,
    message: redactText(diagnostic.message),
    ...(diagnostic.details === undefined ? {} : { details: redactSecrets(diagnostic.details) }),
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
    ...(report.sourceCount === undefined ? [] : [`✓ ${report.sourceCount} sources loaded`]),
    ...(report.referenceCount === undefined
      ? []
      : [`✓ ${report.referenceCount} references inspected`]),
    `${errors === 0 ? '✓' : '✗'} ${errors} errors`,
    `${warnings === 0 ? '✓' : '⚠'} ${warnings} warnings`,
  ]

  if (report.fingerprint !== undefined) lines.push(`Fingerprint: ${report.fingerprint}`)
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

function failureExitCode(diagnostics: readonly Diagnostic[]): number {
  const errorCodes = diagnostics
    .filter(({ severity }) => severity === 'error')
    .map(({ code }) => code)

  if (errorCodes.some((code) => code.startsWith('ASF-INT-'))) return 3
  if (errorCodes.some((code) => code.startsWith('ASF-SRC-') || code.startsWith('ASF-CLI-'))) {
    return 2
  }
  return 1
}

export async function executeValidateCommand(
  options: ValidateCommandOptions,
  dependencies: CliDependencies,
  io: CliIo,
): Promise<number> {
  const location = sourceLocation(options, dependencies)
  const policy = retrievalPolicy(options, location, dependencies)
  const acquirer = dependencies.createAcquirer?.() ?? createNodeSourceAcquirer()
  const processor = dependencies.processOpenApiLocation ?? defaultProcessOpenApiLocation
  const processed = await processor(location, { acquirer, policy })
  const diagnostics = sortDiagnostics(processed.diagnostics.map(sanitizeDiagnostic))
  const valid = Boolean(processed.document) && !hasDiagnosticErrors(diagnostics)
  const report: ValidationReport = {
    schemaVersion: '1.0',
    command: 'validate',
    source: options.target,
    valid,
    ...(processed.document === undefined
      ? {}
      : {
          openapiVersion: processed.document.openapiVersion,
          compatibilityMode: processed.document.compatibilityMode,
          ...(processed.document.fingerprint === undefined
            ? {}
            : { fingerprint: processed.document.fingerprint }),
          ...(processed.document.sourceCount === undefined
            ? {}
            : { sourceCount: processed.document.sourceCount }),
          ...(processed.document.referenceCount === undefined
            ? {}
            : { referenceCount: processed.document.referenceCount }),
        }),
    operationCount: processed.document?.operations.length ?? 0,
    schemaCount: processed.document?.componentSchemas.length ?? 0,
    diagnostics,
  }

  writeReport(report, options.json, io)
  return valid ? 0 : failureExitCode(diagnostics)
}
