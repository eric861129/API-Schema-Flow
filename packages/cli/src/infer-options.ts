import { DIAGNOSTIC_CODES, type Diagnostic } from '@api-schema-flow/diagnostics'

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
): { readonly value?: number; readonly nextIndex: number; readonly diagnostic?: ParseInferArgumentsResult } {
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

export function parseInferArguments(argv: readonly string[]): ParseInferArgumentsResult {
  if (argv[0] !== 'infer') return usage('Expected the infer command.')
  const target = argv[1]
  if (target === undefined || target.startsWith('--')) {
    return usage('Usage: schema-flow infer <openapi-file-or-url> [options]')
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
        validateArguments.push(argument)
        if (
          ['--allow-path', '--max-documents', '--max-total-bytes', '--max-ref-depth'].includes(
            argument,
          )
        ) {
          const value = argv[index + 1]
          if (value === undefined) return usage(`${argument} requires a value.`)
          validateArguments.push(value)
          index += 1
        }
        break
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
