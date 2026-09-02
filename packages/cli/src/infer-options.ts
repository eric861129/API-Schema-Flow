import { DIAGNOSTIC_CODES, type Diagnostic } from '@api-schema-flow/diagnostics'

export const INFER_USAGE =
  'Usage: schema-flow infer <openapi-file-or-url> [--json] [--minimum-confidence <0..1>] [--top-k <n>] [--max-candidates <n>] [--include-low] [--allow-path <dir>] [--allow-http] [--allow-private-network] [--max-documents <n>] [--max-total-bytes <n>] [--max-ref-depth <n>]'

export interface InferCommandOptions {
  readonly target: string
  readonly json: boolean
  readonly minimumConfidence?: number
  readonly topKPerTarget?: number
  readonly maxCandidates?: number
  readonly includeLowConfidence?: boolean
  readonly validateArguments: readonly string[]
}

export interface ParseInferArgumentsResult {
  readonly options?: InferCommandOptions
  readonly diagnostics: readonly Diagnostic[]
}

function usage(message: string): ParseInferArgumentsResult {
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

function numericValue(
  argv: readonly string[],
  index: number,
  flag: string,
): {
  readonly value?: number
  readonly nextIndex: number
  readonly diagnostic?: ParseInferArgumentsResult
} {
  const raw = argv[index + 1]
  if (raw === undefined || raw.startsWith('--')) {
    return {
      nextIndex: index,
      diagnostic: usage(`${flag} requires a numeric value.`),
    }
  }
  const value = Number(raw)
  if (!Number.isFinite(value)) {
    return {
      nextIndex: index + 1,
      diagnostic: usage(`${flag} requires a finite numeric value.`),
    }
  }
  return { value, nextIndex: index + 1 }
}

const forwardedBooleanFlags = new Set(['--allow-http', '--allow-private-network'])
const forwardedValueFlags = new Set([
  '--allow-path',
  '--max-documents',
  '--max-total-bytes',
  '--max-ref-depth',
])

export function parseInferArguments(argv: readonly string[]): ParseInferArgumentsResult {
  if (argv[0] !== 'infer') return usage('Expected the infer command.')
  const target = argv[1]
  if (target === undefined || target.startsWith('--')) {
    return usage(INFER_USAGE)
  }

  let json = false
  let minimumConfidence: number | undefined
  let topKPerTarget: number | undefined
  let maxCandidates: number | undefined
  let includeLowConfidence: boolean | undefined
  const validateArguments = ['validate', target]

  for (let index = 2; index < argv.length; index += 1) {
    const argument = argv[index]!
    switch (argument) {
      case '--json':
        json = true
        break
      case '--include-low':
        includeLowConfidence = true
        break
      case '--minimum-confidence': {
        const parsed = numericValue(argv, index, argument)
        if (parsed.diagnostic !== undefined) return parsed.diagnostic
        minimumConfidence = parsed.value
        index = parsed.nextIndex
        break
      }
      case '--top-k': {
        const parsed = numericValue(argv, index, argument)
        if (parsed.diagnostic !== undefined) return parsed.diagnostic
        topKPerTarget = parsed.value
        index = parsed.nextIndex
        break
      }
      case '--max-candidates': {
        const parsed = numericValue(argv, index, argument)
        if (parsed.diagnostic !== undefined) return parsed.diagnostic
        maxCandidates = parsed.value
        index = parsed.nextIndex
        break
      }
      default:
        if (forwardedBooleanFlags.has(argument)) {
          validateArguments.push(argument)
          break
        }
        if (forwardedValueFlags.has(argument)) {
          const value = argv[index + 1]
          if (value === undefined || value.startsWith('--')) {
            return usage(`${argument} requires a value.`)
          }
          validateArguments.push(argument, value)
          index += 1
          break
        }
        return usage(`Unknown option ${argument}.`)
    }
  }

  if (minimumConfidence !== undefined && (minimumConfidence < 0 || minimumConfidence > 1)) {
    return usage('--minimum-confidence must be between 0 and 1.')
  }
  if (topKPerTarget !== undefined && (!Number.isInteger(topKPerTarget) || topKPerTarget <= 0)) {
    return usage('--top-k must be a positive integer.')
  }
  if (maxCandidates !== undefined && (!Number.isInteger(maxCandidates) || maxCandidates <= 0)) {
    return usage('--max-candidates must be a positive integer.')
  }

  return {
    options: {
      target,
      json,
      ...(minimumConfidence === undefined ? {} : { minimumConfidence }),
      ...(topKPerTarget === undefined ? {} : { topKPerTarget }),
      ...(maxCandidates === undefined ? {} : { maxCandidates }),
      ...(includeLowConfidence === undefined ? {} : { includeLowConfidence }),
      validateArguments,
    },
    diagnostics: [],
  }
}
