import fs from 'node:fs/promises'
import path from 'node:path'

import type {
  FlowGraph,
  InferenceMetrics,
  InferenceReport,
  ReviewDecisionOutcome,
} from '@api-schema-flow/domain'
import {
  DIAGNOSTIC_CODES,
  formatDiagnostic,
  hasDiagnosticErrors,
  sortDiagnostics,
  type Diagnostic,
} from '@api-schema-flow/diagnostics'
import { buildDeclaredFlowGraphs as defaultBuildDeclaredFlowGraphs } from '@api-schema-flow/flow'
import { inferFlowCandidates as defaultInferFlowCandidates } from '@api-schema-flow/inference'
import { processOpenApiLocation as defaultProcessOpenApiLocation } from '@api-schema-flow/openapi'
import { redactSecrets, redactText } from '@api-schema-flow/redaction'
import {
  materializeReviewedOperationGraph as defaultMaterializeReviewedOperationGraph,
  parseReviewDecisionSet as defaultParseReviewDecisionSet,
} from '@api-schema-flow/review'
import {
  createSourceRetrievalPolicy,
  type SourceLocation,
  type SourceRetrievalPolicy,
} from '@api-schema-flow/source-loader'
import { createNodeSourceAcquirer } from '@api-schema-flow/source-loader/node'

import { createMemoizedSourceAcquirer } from './memoized-source-acquirer.js'
import type { ReviewCommandOptions } from './review-options.js'
import type { CliDependencies, CliIo } from './run-cli.js'
import { parseValidateArguments } from './validate-options.js'

export interface ReviewCliReport {
  readonly schemaVersion: '1.0'
  readonly command: 'review'
  readonly source: string
  readonly decisions: string
  readonly valid: boolean
  readonly openapiVersion?: string
  readonly ruleSetVersion?: string
  readonly graph?: FlowGraph
  readonly outcomes: readonly ReviewDecisionOutcome[]
  readonly metrics?: InferenceMetrics & {
    readonly appliedCount: number
    readonly rejectedCount: number
    readonly staleCount: number
    readonly orphanedCount: number
    readonly supersededCount: number
    readonly alreadyPresentCount: number
  }
  readonly diagnostics: readonly Diagnostic[]
}

export interface ReviewPipelineResult {
  readonly report: ReviewCliReport
  readonly openApiSource?: {
    readonly sourceId: string
    readonly sourceName: string
    readonly document: NonNullable<
      Awaited<ReturnType<typeof defaultProcessOpenApiLocation>>['document']
    >
  }
  readonly inference?: InferenceReport<Diagnostic>
  readonly graph?: FlowGraph
}

function isUrlTarget(target: string): boolean {
  return /^https?:\/\//iu.test(target)
}

function resolveFilePath(target: string, dependencies: CliDependencies): string {
  const resolvePath = dependencies.resolvePath ?? path.resolve
  const cwd = dependencies.cwd?.() ?? process.cwd()
  return resolvePath(cwd, target)
}

function sourceLocation(target: string, dependencies: CliDependencies): SourceLocation {
  return isUrlTarget(target)
    ? { kind: 'url', url: target }
    : { kind: 'file', path: resolveFilePath(target, dependencies) }
}

function parsedValidateOptions(options: ReviewCommandOptions) {
  const parsed = parseValidateArguments(options.validateArguments.slice(1))
  if ('error' in parsed) throw new Error(parsed.error)
  return parsed.options
}

function retrievalPolicy(
  options: ReturnType<typeof parsedValidateOptions>,
  location: SourceLocation,
  dependencies: CliDependencies,
): SourceRetrievalPolicy {
  const dirname = dependencies.dirname ?? path.dirname
  const extraRoots = options.allowPaths.map((allowedPath) =>
    resolveFilePath(allowedPath, dependencies),
  )
  const allowedFileRoots = [
    ...new Set([...(location.kind === 'file' ? [dirname(location.path)] : []), ...extraRoots]),
  ]
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

export function sanitizeCliDiagnostic(diagnostic: Diagnostic): Diagnostic {
  return {
    ...diagnostic,
    message: redactText(diagnostic.message),
    ...(diagnostic.details === undefined ? {} : { details: redactSecrets(diagnostic.details) }),
  }
}

export function cliFailureExitCode(diagnostics: readonly Diagnostic[]): number {
  const codes = diagnostics.filter(({ severity }) => severity === 'error').map(({ code }) => code)
  if (codes.some((code) => code.startsWith('ASF-INT-'))) return 3
  if (codes.some((code) => code.startsWith('ASF-SRC-') || code.startsWith('ASF-CLI-'))) return 2
  return 1
}

function emptyReport(
  options: ReviewCommandOptions,
  diagnostics: readonly Diagnostic[],
): ReviewCliReport {
  return {
    schemaVersion: '1.0',
    command: 'review',
    source: options.target,
    decisions: options.decisionsPath,
    valid: false,
    outcomes: [],
    diagnostics: sortDiagnostics(diagnostics),
  }
}

async function readJsonFile(
  filePath: string,
  dependencies: CliDependencies,
): Promise<{ readonly value?: unknown; readonly diagnostics: readonly Diagnostic[] }> {
  const resolved = resolveFilePath(filePath, dependencies)
  try {
    const readTextFile =
      dependencies.readTextFile ?? ((value: string) => fs.readFile(value, 'utf8'))
    const contents = await readTextFile(resolved)
    try {
      return { value: JSON.parse(contents), diagnostics: [] }
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

export async function runReviewPipeline(
  options: ReviewCommandOptions,
  dependencies: CliDependencies,
): Promise<ReviewPipelineResult> {
  const validateOptions = parsedValidateOptions(options)
  const location = sourceLocation(options.target, dependencies)
  const policy = retrievalPolicy(validateOptions, location, dependencies)
  const baseAcquirer = dependencies.createAcquirer?.() ?? createNodeSourceAcquirer()
  const acquirer = createMemoizedSourceAcquirer(baseAcquirer)
  const processor = dependencies.processOpenApiLocation ?? defaultProcessOpenApiLocation
  const processed = await processor(location, { acquirer, policy })
  const parserDiagnostics = sortDiagnostics(processed.diagnostics.map(sanitizeCliDiagnostic))
  if (processed.document === undefined || hasDiagnosticErrors(parserDiagnostics)) {
    return { report: emptyReport(options, parserDiagnostics) }
  }

  const openApiSource = {
    sourceId: 'cli',
    sourceName: processed.document.info.title,
    document: processed.document,
  }
  const buildDeclaredFlowGraphs =
    dependencies.buildDeclaredFlowGraphs ?? defaultBuildDeclaredFlowGraphs
  const declared = buildDeclaredFlowGraphs({ openApiSources: [openApiSource] })
  const graphDiagnostics = declared.diagnostics.map(sanitizeCliDiagnostic)
  if (hasDiagnosticErrors(graphDiagnostics)) {
    return { report: emptyReport(options, [...parserDiagnostics, ...graphDiagnostics]) }
  }

  const inferFlowCandidates = dependencies.inferFlowCandidates ?? defaultInferFlowCandidates
  const inference = inferFlowCandidates({
    openApiSources: [openApiSource],
    declaredOperationGraph: declared.operationGraph,
  }) as InferenceReport<Diagnostic>
  const decisionFile = await readJsonFile(options.decisionsPath, dependencies)
  if (decisionFile.value === undefined) {
    return { report: emptyReport(options, decisionFile.diagnostics), openApiSource, inference }
  }
  const parseReviewDecisionSet =
    dependencies.parseReviewDecisionSet ?? defaultParseReviewDecisionSet
  const parsed = parseReviewDecisionSet(decisionFile.value)
  const decisionDiagnostics = parsed.diagnostics.map(sanitizeCliDiagnostic)
  if (parsed.decisionSet === undefined || hasDiagnosticErrors(decisionDiagnostics)) {
    return {
      report: emptyReport(options, [
        ...parserDiagnostics,
        ...graphDiagnostics,
        ...inference.diagnostics.map(sanitizeCliDiagnostic),
        ...decisionDiagnostics,
      ]),
      openApiSource,
      inference,
    }
  }

  const materialize =
    dependencies.materializeReviewedOperationGraph ?? defaultMaterializeReviewedOperationGraph
  const reviewed = materialize({
    declaredOperationGraph: declared.operationGraph,
    candidates: inference.candidates,
    decisionSet: parsed.decisionSet,
  })
  const diagnostics = sortDiagnostics(
    [
      ...parserDiagnostics,
      ...graphDiagnostics,
      ...inference.diagnostics,
      ...reviewed.diagnostics,
    ].map(sanitizeCliDiagnostic),
  )
  const valid = !hasDiagnosticErrors(diagnostics)
  const report: ReviewCliReport = {
    schemaVersion: '1.0',
    command: 'review',
    source: options.target,
    decisions: options.decisionsPath,
    valid,
    openapiVersion: processed.document.openapiVersion,
    ruleSetVersion: inference.ruleSetVersion,
    graph: reviewed.graph,
    outcomes: reviewed.outcomes,
    metrics: { ...inference.metrics, ...reviewed.metrics },
    diagnostics,
  }
  return { report, openApiSource, inference, graph: reviewed.graph }
}

function writeHumanReport(report: ReviewCliReport, io: CliIo): void {
  const writer = report.valid ? io.stdout : io.stderr
  const lines = [
    'API Schema Flow',
    '',
    report.valid ? '✓ Review decisions applied' : '✗ Review failed',
    ...(report.metrics
      ? [
          `Applied: ${report.metrics.appliedCount} | Rejected: ${report.metrics.rejectedCount}`,
          `Stale: ${report.metrics.staleCount} | Orphaned: ${report.metrics.orphanedCount} | Superseded: ${report.metrics.supersededCount}`,
          `Accepted graph edges: ${report.graph?.edges.length ?? 0}`,
        ]
      : []),
  ]
  if (report.diagnostics.length > 0) lines.push('', ...report.diagnostics.map(formatDiagnostic))
  lines.push('', report.valid ? 'Review completed successfully.' : 'Review failed.')
  writer(`${lines.join('\n')}\n`)
}

export async function executeReviewCommand(
  options: ReviewCommandOptions,
  dependencies: CliDependencies,
  io: CliIo,
): Promise<number> {
  const result = await runReviewPipeline(options, dependencies)
  if (options.json) io.stdout(`${JSON.stringify(result.report, null, 2)}\n`)
  else writeHumanReport(result.report, io)
  return result.report.valid ? 0 : cliFailureExitCode(result.report.diagnostics)
}
