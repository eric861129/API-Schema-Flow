import type { NormalizedApiDocument } from '@api-schema-flow/domain'
import type { Diagnostic } from '@api-schema-flow/diagnostics'
import type { ProcessOpenApiLocationOptions } from '@api-schema-flow/openapi'
import { redactText } from '@api-schema-flow/redaction'
import type { SourceAcquirer, SourceLocation } from '@api-schema-flow/source-loader'

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

export interface CliDependencies {
  readonly createAcquirer?: () => SourceAcquirer
  readonly processOpenApiLocation?: (
    location: SourceLocation,
    options: ProcessOpenApiLocationOptions,
  ) => Promise<CliProcessResult>
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
    if (command !== 'validate') {
      io.stderr(`${VALIDATE_USAGE}\n`)
      return 2
    }

    const parsed = parseValidateArguments(arguments_)
    if ('error' in parsed) {
      io.stderr(`${parsed.error}\n${VALIDATE_USAGE}\n`)
      return 2
    }

    return await executeValidateCommand(parsed.options, dependencies, io)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    io.stderr(`Unexpected error: ${redactText(message)}\n`)
    return 3
  }
}
