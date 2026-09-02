import type { NormalizedArazzoDocument, ProcessArazzoResult } from '@api-schema-flow/arazzo'
import type { InferenceReport, NormalizedApiDocument } from '@api-schema-flow/domain'
import type { Diagnostic } from '@api-schema-flow/diagnostics'
import type { BuildDeclaredFlowGraphsInput, DeclaredFlowProjection } from '@api-schema-flow/flow'
import type { InferFlowCandidatesInput } from '@api-schema-flow/inference'
import type { ProcessOpenApiLocationOptions } from '@api-schema-flow/openapi'
import { redactText } from '@api-schema-flow/redaction'
import type { SourceAcquirer, SourceDocument, SourceLocation } from '@api-schema-flow/source-loader'

import { executeInferCommand } from './infer-command.js'
import { INFER_USAGE, parseInferArguments } from './infer-options.js'
import { executeValidateCommand } from './validate-command.js'
import { parseValidateArguments, VALIDATE_USAGE } from './validate-options.js'

export interface CliIo {
  readonly stdout: (message: string) => void
  readonly stderr: (message: string) => void
}

export interface CliProcessResult {
  readonly document?: NormalizedApiDocument
  readonly diagnostics: readonly Diagnostic[]
}

export interface CliArazzoProcessResult extends ProcessArazzoResult {
  readonly document?: NormalizedArazzoDocument
}

export interface CliDependencies {
  readonly createAcquirer?: () => SourceAcquirer
  readonly processOpenApiLocation?: (
    location: SourceLocation,
    options: ProcessOpenApiLocationOptions,
  ) => Promise<CliProcessResult>
  readonly processArazzoSource?: (
    source: SourceDocument,
  ) => CliArazzoProcessResult | Promise<CliArazzoProcessResult>
  readonly buildDeclaredFlowGraphs?: (input: BuildDeclaredFlowGraphsInput) => DeclaredFlowProjection
  readonly inferFlowCandidates?: (input: InferFlowCandidatesInput) => InferenceReport<Diagnostic>
  readonly resolvePath?: (...paths: string[]) => string
  readonly dirname?: (path: string) => string
  readonly cwd?: () => string
}

export async function runCli(
  argv: readonly string[],
  dependencies: CliDependencies,
  io: CliIo,
): Promise<number> {
  try {
    const [command, ...arguments_] = argv

    if (command === 'validate') {
      const parsed = parseValidateArguments(arguments_)
      if ('error' in parsed) {
        io.stderr(`${parsed.error}\n${VALIDATE_USAGE}\n`)
        return 2
      }
      return await executeValidateCommand(parsed.options, dependencies, io)
    }

    if (command === 'infer') {
      const parsed = parseInferArguments(argv)
      if (parsed.options === undefined) {
        const messages = parsed.diagnostics.map(({ message }) => message).join('\n')
        io.stderr(`${messages}\n${INFER_USAGE}\n`)
        return 2
      }
      return await executeInferCommand(parsed.options, dependencies, io)
    }

    io.stderr(`${VALIDATE_USAGE}\n${INFER_USAGE}\n`)
    return 2
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    io.stderr(`Unexpected error: ${redactText(message)}\n`)
    return 3
  }
}
