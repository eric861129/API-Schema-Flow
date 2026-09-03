import { DIAGNOSTIC_CODES, type Diagnostic } from '@api-schema-flow/diagnostics'

export const REVIEW_USAGE =
  'Usage: schema-flow review <openapi-file-or-url> --decisions <decision-set.json> [--json] [--allow-path <dir>] [--allow-http] [--allow-private-network] [--max-documents <n>] [--max-total-bytes <n>] [--max-ref-depth <n>]'

export interface ReviewCommandOptions {
  readonly target: string
  readonly decisionsPath: string
  readonly json: boolean
  readonly validateArguments: readonly string[]
}

export interface ParseReviewArgumentsResult {
  readonly options?: ReviewCommandOptions
  readonly diagnostics: readonly Diagnostic[]
}

export const SOURCE_BOOLEAN_FLAGS = new Set(['--allow-http', '--allow-private-network'])
export const SOURCE_VALUE_FLAGS = new Set([
  '--allow-path',
  '--max-documents',
  '--max-total-bytes',
  '--max-ref-depth',
])

export function cliUsage<TOptions = ReviewCommandOptions>(
  message: string,
): { readonly options?: TOptions; readonly diagnostics: readonly Diagnostic[] } {
  return {
    diagnostics: [
      {
        code: DIAGNOSTIC_CODES.CLI_USAGE,
        severity: 'error',
        message,
      },
    ],
  }
}

export function forwardSourceOption(
  argv: readonly string[],
  index: number,
  validateArguments: string[],
): { readonly handled: boolean; readonly nextIndex: number; readonly error?: string } {
  const argument = argv[index]!
  if (SOURCE_BOOLEAN_FLAGS.has(argument)) {
    validateArguments.push(argument)
    return { handled: true, nextIndex: index }
  }
  if (SOURCE_VALUE_FLAGS.has(argument)) {
    const value = argv[index + 1]
    if (value === undefined || value.startsWith('--')) {
      return { handled: true, nextIndex: index, error: `${argument} requires a value.` }
    }
    validateArguments.push(argument, value)
    return { handled: true, nextIndex: index + 1 }
  }
  return { handled: false, nextIndex: index }
}

export function parseReviewArguments(argv: readonly string[]): ParseReviewArgumentsResult {
  if (argv[0] !== 'review') return cliUsage('Expected the review command.')
  const target = argv[1]
  if (target === undefined || target.startsWith('--')) return cliUsage(REVIEW_USAGE)

  let decisionsPath: string | undefined
  let json = false
  const validateArguments = ['validate', target]

  for (let index = 2; index < argv.length; index += 1) {
    const argument = argv[index]!
    if (argument === '--json') {
      json = true
      continue
    }
    if (argument === '--decisions') {
      const value = argv[index + 1]
      if (value === undefined || value.startsWith('--')) {
        return cliUsage('--decisions requires a value.')
      }
      decisionsPath = value
      index += 1
      continue
    }
    const forwarded = forwardSourceOption(argv, index, validateArguments)
    if (forwarded.error !== undefined) return cliUsage(forwarded.error)
    if (forwarded.handled) {
      index = forwarded.nextIndex
      continue
    }
    return cliUsage(`Unknown option ${argument}.`)
  }

  if (decisionsPath === undefined) return cliUsage(`${REVIEW_USAGE}; --decisions is required.`)
  return {
    options: { target, decisionsPath, json, validateArguments },
    diagnostics: [],
  }
}
