import path from 'node:path'

import type { InferenceCandidate, InferenceMetrics, InferenceReport } from '@api-schema-flow/domain'
import {
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
  createSourceRetrievalPolicy,
  type SourceLocation,
  type SourceRetrievalPolicy,
} from '@api-schema-flow/source-loader'
import { createNodeSourceAcquirer } from '@api-schema-flow/source-loader/node'

import { createMemoizedSourceAcquirer } from './memoized-source-acquirer.js'
import { parseValidateArguments } from './validate-options.js'
import type { InferCommandOptions } from './infer-options.js'
import type { CliDependencies, CliIo } from './run-cli.js'

export interface InferenceCliReport {
  readonly schemaVersion: '1.0'
  readonly command: 'infer'
  readonly source: string
  readonly valid: boolean
  readonly openapiVersion?: string
  readonly ruleSetVersion?: string
  readonly candidates: readonly InferenceCandidate[]
  readonly metrics?: InferenceMetrics
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

function sourceLocation(target: string, dependencies: CliDependencies): SourceLocation {
  return isUrlTarget(target)
    ? { kind: 'url', url: target }
    : { kind: 'file', path: resolveFilePath(target, dependencies) }
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

function parsedValidateOptions(options: InferCommandOptions) {
  const parsed = parseValidateArguments(options.validateArguments.slice(1))
  if ('error' in parsed) throw new Error(parsed.error)
  return parsed.options
}

function sanitizeDiagnostic(diagnostic: Diagnostic): Diagnostic {
  return {
    ...diagnostic,
    message: redactText(diagnostic.message),
    ...(diagnostic.details === undefined ? {} : { details: redactSecrets(diagnostic.details) }),
  }
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

function writeHumanReport(report: InferenceCliReport, io: CliIo): void {
  const writer = report.valid ? io.stdout : io.stderr
  const metrics = report.metrics
  const lines = [
    'API Schema Flow',
    '',
    report.valid ? '✓ Inference completed' : '✗ Inference failed',
    ...(report.openapiVersion ? [`✓ OpenAPI ${report.openapiVersion} detected`] : []),
    ...(metrics
      ? [
          `✓ ${metrics.emittedCandidateCount} candidate mappings`,
          `High: ${metrics.highConfidenceCount} | Medium: ${metrics.mediumConfidenceCount} | Low: ${metrics.lowConfidenceCount}`,
          `Pairs: ${metrics.generatedPairCount} generated | ${metrics.blockedPairCount} blocked | ${metrics.suppressedDeclaredCount} declared suppressed`,
        ]
      : []),
  ]

  for (const candidate of report.candidates.slice(0, 5)) {
    lines.push(
      `- ${candidate.sourceOperationKey} -> ${candidate.targetOperationKey} (${candidate.band}, ${candidate.confidence.toFixed(2)})`,
      `  Evidence: ${candidate.evidence.map(({ ruleId }) => ruleId).join(', ')}`,
    )
  }

  if (report.diagnostics.length > 0) {
    lines.push('', ...report.diagnostics.map(formatDiagnostic))
  }
  lines.push('', report.valid ? 'Inference completed successfully.' : 'Inference failed.')
  writer(`${lines.join('\n')}\n`)
}

function writeReport(report: InferenceCliReport, json: boolean, io: CliIo): void {
  if (json) io.stdout(`${JSON.stringify(report, null, 2)}\n`)
  else writeHumanReport(report, io)
}

function emptyReport(source: string, diagnostics: readonly Diagnostic[]): InferenceCliReport {
  return {
    schemaVersion: '1.0',
    command: 'infer',
    source,
    valid: false,
    candidates: [],
    diagnostics,
  }
}

export async function executeInferCommand(
  options: InferCommandOptions,
  dependencies: CliDependencies,
  io: CliIo,
): Promise<number> {
  const validateOptions = parsedValidateOptions(options)
  const location = sourceLocation(options.target, dependencies)
  const policy = retrievalPolicy(validateOptions, location, dependencies)
  const baseAcquirer = dependencies.createAcquirer?.() ?? createNodeSourceAcquirer()
  const acquirer = createMemoizedSourceAcquirer(baseAcquirer)
  const processor = dependencies.processOpenApiLocation ?? defaultProcessOpenApiLocation
  const processed = await processor(location, { acquirer, policy })
  const parserDiagnostics = sortDiagnostics(processed.diagnostics.map(sanitizeDiagnostic))

  if (processed.document === undefined || hasDiagnosticErrors(parserDiagnostics)) {
    const report = emptyReport(options.target, parserDiagnostics)
    writeReport(report, options.json, io)
    return failureExitCode(parserDiagnostics)
  }

  const openApiSource = {
    sourceId: 'cli',
    sourceName: processed.document.info.title,
    document: processed.document,
  }
  const buildDeclaredFlowGraphs =
    dependencies.buildDeclaredFlowGraphs ?? defaultBuildDeclaredFlowGraphs
  const declared = buildDeclaredFlowGraphs({ openApiSources: [openApiSource] })
  const graphDiagnostics = sortDiagnostics(declared.diagnostics.map(sanitizeDiagnostic))

  if (hasDiagnosticErrors(graphDiagnostics)) {
    const diagnostics = sortDiagnostics([...parserDiagnostics, ...graphDiagnostics])
    const report = emptyReport(options.target, diagnostics)
    writeReport(report, options.json, io)
    return failureExitCode(diagnostics)
  }

  const inferFlowCandidates = dependencies.inferFlowCandidates ?? defaultInferFlowCandidates
  const inference = inferFlowCandidates({
    openApiSources: [openApiSource],
    declaredOperationGraph: declared.operationGraph,
    config: {
      ...(options.minimumConfidence === undefined
        ? {}
        : { minimumConfidence: options.minimumConfidence }),
      ...(options.topKPerTarget === undefined ? {} : { topKPerTarget: options.topKPerTarget }),
      ...(options.maxCandidates === undefined ? {} : { maxCandidates: options.maxCandidates }),
      ...(options.includeLowConfidence === undefined
        ? {}
        : { includeLowConfidence: options.includeLowConfidence }),
    },
  }) as InferenceReport<Diagnostic>
  const diagnostics = sortDiagnostics(
    [...parserDiagnostics, ...graphDiagnostics, ...inference.diagnostics].map(sanitizeDiagnostic),
  )
  const valid = !hasDiagnosticErrors(diagnostics)
  const report: InferenceCliReport = {
    schemaVersion: '1.0',
    command: 'infer',
    source: options.target,
    valid,
    openapiVersion: processed.document.openapiVersion,
    ruleSetVersion: inference.ruleSetVersion,
    candidates: inference.candidates,
    metrics: inference.metrics,
    diagnostics,
  }

  writeReport(report, options.json, io)
  return valid ? 0 : failureExitCode(diagnostics)
}
