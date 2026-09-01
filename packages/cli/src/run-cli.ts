import type { NormalizedApiDocument } from '@api-schema-flow/domain'
import type { Diagnostic } from '@api-schema-flow/diagnostics'
import { redactText } from '@api-schema-flow/redaction'
import type { SourceDocument } from '@api-schema-flow/source-loader'

import { executeValidateCommand } from './validate-command.js'

export interface CliIo {
  readonly stdout: (message: string) => void
  readonly stderr: (message: string) => void
}

export interface CliProcessResult {
  readonly document?: NormalizedApiDocument
  readonly diagnostics: readonly Diagnostic[]
}

export interface CliDependencies {
  readonly readFile: (path: string) => Promise<string>
  readonly processOpenApi?: (source: SourceDocument) => Promise<CliProcessResult>
}

const USAGE = 'Usage: schema-flow validate <file> [--json]'

export async function runCli(
  argv: readonly string[],
  dependencies: CliDependencies,
  io: CliIo,
): Promise<number> {
  try {
    const [command, ...arguments_] = argv
    if (command !== 'validate') {
      io.stderr(`${USAGE}\n`)
      return 2
    }

    const json = arguments_.includes('--json')
    const positional = arguments_.filter((argument) => argument !== '--json')
    if (
      positional.length !== 1 ||
      arguments_.some((argument) => argument.startsWith('--') && argument !== '--json')
    ) {
      io.stderr(`${USAGE}\n`)
      return 2
    }

    return await executeValidateCommand(positional[0]!, json, dependencies, io)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    io.stderr(`Unexpected error: ${redactText(message)}\n`)
    return 3
  }
}
