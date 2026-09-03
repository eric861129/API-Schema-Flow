import fs from 'node:fs/promises'
import path from 'node:path'

import {
  exportArazzo as defaultExportArazzo,
  type ArazzoExportArtifact,
  type ArazzoWorkflowPlan,
} from '@api-schema-flow/exporter-arazzo'
import {
  DIAGNOSTIC_CODES,
  formatDiagnostic,
  hasDiagnosticErrors,
  sortDiagnostics,
  type Diagnostic,
} from '@api-schema-flow/diagnostics'

import type { ExportArazzoCommandOptions } from './export-arazzo-options.js'
import { cliFailureExitCode, runReviewPipeline, sanitizeCliDiagnostic } from './review-command.js'
import type { CliDependencies, CliIo } from './run-cli.js'

export interface ExportArazzoCliReport {
  readonly schemaVersion: '1.0'
  readonly command: 'export-arazzo'
  readonly source: string
  readonly decisions: string
  readonly workflow: string
  readonly format: 'yaml' | 'json'
  readonly valid: boolean
  readonly fileName?: string
  readonly mediaType?: string
  readonly contentHash?: string
  readonly outputPath?: string
  readonly contents?: string
  readonly diagnostics: readonly Diagnostic[]
}

function resolveFilePath(target: string, dependencies: CliDependencies): string {
  const resolvePath = dependencies.resolvePath ?? path.resolve
  const cwd = dependencies.cwd?.() ?? process.cwd()
  return resolvePath(cwd, target)
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseWorkflowPlan(
  value: unknown,
  filePath: string,
): {
  readonly workflowPlan?: ArazzoWorkflowPlan
  readonly diagnostics: readonly Diagnostic[]
} {
  if (!isObject(value)) {
    return {
      diagnostics: [
        {
          code: DIAGNOSTIC_CODES.EXPORT_WORKFLOW_PLAN_INVALID,
          severity: 'error',
          message: 'Workflow plan must be a JSON object.',
          source: { uri: filePath, pointer: '#' },
        },
      ],
    }
  }
  const sources = value.sourceDescriptions
  const steps = value.steps
  const validSources =
    Array.isArray(sources) &&
    sources.every(
      (entry) =>
        isObject(entry) &&
        typeof entry.sourceId === 'string' &&
        typeof entry.name === 'string' &&
        typeof entry.url === 'string',
    )
  const validSteps =
    Array.isArray(steps) &&
    steps.every(
      (entry) =>
        isObject(entry) &&
        typeof entry.stepId === 'string' &&
        typeof entry.operationNodeId === 'string' &&
        (entry.description === undefined || typeof entry.description === 'string'),
    )
  if (
    value.schemaVersion !== '1.0' ||
    typeof value.workflowId !== 'string' ||
    (value.summary !== undefined && typeof value.summary !== 'string') ||
    (value.description !== undefined && typeof value.description !== 'string') ||
    !validSources ||
    !validSteps
  ) {
    return {
      diagnostics: [
        {
          code: DIAGNOSTIC_CODES.EXPORT_WORKFLOW_PLAN_INVALID,
          severity: 'error',
          message: 'Workflow plan has an invalid M2-D structure.',
          source: { uri: filePath, pointer: '#' },
        },
      ],
    }
  }
  return {
    workflowPlan: value as unknown as ArazzoWorkflowPlan,
    diagnostics: [],
  }
}

async function readWorkflowPlan(
  filePath: string,
  dependencies: CliDependencies,
): Promise<{
  readonly workflowPlan?: ArazzoWorkflowPlan
  readonly diagnostics: readonly Diagnostic[]
}> {
  const resolved = resolveFilePath(filePath, dependencies)
  try {
    const readTextFile =
      dependencies.readTextFile ?? ((value: string) => fs.readFile(value, 'utf8'))
    const contents = await readTextFile(resolved)
    try {
      return parseWorkflowPlan(JSON.parse(contents), filePath)
    } catch {
      return {
        diagnostics: [
          {
            code: DIAGNOSTIC_CODES.CLI_INPUT,
            severity: 'error',
            message: `Input JSON file "${filePath}" is invalid.`,
            source: { uri: filePath, pointer: '#' },
          },
        ],
      }
    }
  } catch {
    return {
      diagnostics: [
        {
          code: DIAGNOSTIC_CODES.CLI_INPUT,
          severity: 'error',
          message: `Unable to read input file "${filePath}".`,
          source: { uri: filePath, pointer: '#' },
        },
      ],
    }
  }
}

async function writeArtifact(
  outputPath: string,
  artifact: ArazzoExportArtifact,
  force: boolean,
  dependencies: CliDependencies,
): Promise<readonly Diagnostic[]> {
  const resolved = resolveFilePath(outputPath, dependencies)
  const writeTextFile =
    dependencies.writeTextFile ??
    ((value: string, contents: string, options?: { readonly flag?: string }) =>
      fs.writeFile(value, contents, { encoding: 'utf8', flag: options?.flag ?? 'w' }))
  const renameFile = dependencies.renameFile ?? fs.rename
  const removeFile = dependencies.removeFile ?? ((value: string) => fs.rm(value, { force: true }))
  try {
    if (!force) {
      await writeTextFile(resolved, artifact.contents, { flag: 'wx' })
      return []
    }
    const temporary = `${resolved}.schema-flow-${process.pid}-${Date.now()}.tmp`
    try {
      await writeTextFile(temporary, artifact.contents, { flag: 'wx' })
      await renameFile(temporary, resolved)
    } catch (error) {
      await removeFile(temporary).catch(() => undefined)
      throw error
    }
    return []
  } catch (error) {
    const exists = isObject(error) && Reflect.get(error, 'code') === 'EEXIST'
    return [
      {
        code: DIAGNOSTIC_CODES.CLI_INPUT,
        severity: 'error',
        message: exists
          ? `Output file "${outputPath}" already exists; use --force to replace it.`
          : `Unable to write output file "${outputPath}".`,
        source: { uri: outputPath, pointer: '#' },
      },
    ]
  }
}

function reportFor(
  options: ExportArazzoCommandOptions,
  artifact: ArazzoExportArtifact | undefined,
  diagnostics: readonly Diagnostic[],
  outputPath?: string,
): ExportArazzoCliReport {
  const valid =
    artifact !== undefined && artifact.contents.length > 0 && !hasDiagnosticErrors(diagnostics)
  return {
    schemaVersion: '1.0',
    command: 'export-arazzo',
    source: options.target,
    decisions: options.decisionsPath,
    workflow: options.workflowPath,
    format: options.format,
    valid,
    ...(artifact === undefined
      ? {}
      : {
          fileName: artifact.fileName,
          mediaType: artifact.mediaType,
          contentHash: artifact.contentHash,
        }),
    ...(outputPath === undefined ? {} : { outputPath }),
    ...(options.json && outputPath === undefined && artifact !== undefined
      ? { contents: artifact.contents }
      : {}),
    diagnostics: sortDiagnostics(diagnostics.map(sanitizeCliDiagnostic)),
  }
}

function writeHumanReport(report: ExportArazzoCliReport, io: CliIo): void {
  const writer = report.valid ? io.stdout : io.stderr
  const lines = [
    'API Schema Flow',
    '',
    report.valid ? '✓ Arazzo export completed' : '✗ Arazzo export failed',
    ...(report.fileName ? [`Artifact: ${report.fileName}`] : []),
    ...(report.outputPath ? [`Output: ${report.outputPath}`] : []),
    ...(report.contentHash ? [`SHA-256: ${report.contentHash}`] : []),
  ]
  if (report.diagnostics.length > 0) lines.push('', ...report.diagnostics.map(formatDiagnostic))
  lines.push('', report.valid ? 'Export completed successfully.' : 'Export failed.')
  writer(`${lines.join('\n')}\n`)
}

export async function executeExportArazzoCommand(
  options: ExportArazzoCommandOptions,
  dependencies: CliDependencies,
  io: CliIo,
): Promise<number> {
  const review = await runReviewPipeline(
    {
      target: options.target,
      decisionsPath: options.decisionsPath,
      json: true,
      validateArguments: options.validateArguments,
    },
    dependencies,
  )
  if (!review.report.valid || review.graph === undefined || review.openApiSource === undefined) {
    const report = reportFor(options, undefined, review.report.diagnostics)
    if (options.json) io.stdout(`${JSON.stringify(report, null, 2)}\n`)
    else writeHumanReport(report, io)
    return cliFailureExitCode(report.diagnostics)
  }

  const parsedPlan = await readWorkflowPlan(options.workflowPath, dependencies)
  if (parsedPlan.workflowPlan === undefined) {
    const report = reportFor(options, undefined, [
      ...review.report.diagnostics,
      ...parsedPlan.diagnostics,
    ])
    if (options.json) io.stdout(`${JSON.stringify(report, null, 2)}\n`)
    else writeHumanReport(report, io)
    return cliFailureExitCode(report.diagnostics)
  }

  const exporter = dependencies.exportArazzo ?? defaultExportArazzo
  const artifact = await exporter({
    title: `${review.openApiSource.document.info.title} workflows`,
    version: review.openApiSource.document.info.version,
    format: options.format,
    workflowPlan: parsedPlan.workflowPlan,
    openApiSources: [review.openApiSource],
    acceptedOperationGraph: review.graph,
  })
  let diagnostics = [...review.report.diagnostics, ...artifact.diagnostics]
  let resolvedOutput: string | undefined
  if (!hasDiagnosticErrors(diagnostics) && options.outputPath !== undefined) {
    resolvedOutput = resolveFilePath(options.outputPath, dependencies)
    diagnostics = [
      ...diagnostics,
      ...(await writeArtifact(options.outputPath, artifact, options.force, dependencies)),
    ]
  }
  const report = reportFor(options, artifact, diagnostics, resolvedOutput)

  if (options.json) {
    io.stdout(`${JSON.stringify(report, null, 2)}\n`)
  } else if (options.outputPath === undefined && report.valid) {
    io.stdout(artifact.contents)
    if (report.diagnostics.length > 0) {
      io.stderr(`${report.diagnostics.map(formatDiagnostic).join('\n')}\n`)
    }
  } else {
    writeHumanReport(report, io)
  }
  return report.valid ? 0 : cliFailureExitCode(report.diagnostics)
}
