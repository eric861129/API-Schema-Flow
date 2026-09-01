export const VALIDATE_USAGE =
  'Usage: schema-flow validate <file-or-url> [--json] [--allow-path <dir>] [--allow-http] [--allow-private-network] [--max-documents <n>] [--max-total-bytes <n>] [--max-ref-depth <n>]'

export interface ValidateCommandOptions {
  readonly target: string
  readonly json: boolean
  readonly allowPaths: readonly string[]
  readonly allowHttp: boolean
  readonly allowPrivateNetwork: boolean
  readonly maxDocuments?: number
  readonly maxTotalBytes?: number
  readonly maxReferenceDepth?: number
}

export type ParseValidateArgumentsResult =
  | { readonly options: ValidateCommandOptions }
  | { readonly error: string }

function positiveInteger(flag: string, value: string | undefined): number | string {
  if (value === undefined) return `Missing value for ${flag}.`
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return `Invalid value for ${flag}: expected a positive integer.`
  }
  return parsed
}

function nonNegativeInteger(flag: string, value: string | undefined): number | string {
  if (value === undefined) return `Missing value for ${flag}.`
  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    return `Invalid value for ${flag}: expected a non-negative integer.`
  }
  return parsed
}

function flagValue(arguments_: readonly string[], index: number): string | undefined {
  const value = arguments_[index + 1]
  return value === undefined || value.startsWith('--') ? undefined : value
}

export function parseValidateArguments(
  arguments_: readonly string[],
): ParseValidateArgumentsResult {
  let target: string | undefined
  let json = false
  let allowHttp = false
  let allowPrivateNetwork = false
  const allowPaths: string[] = []
  let maxDocuments: number | undefined
  let maxTotalBytes: number | undefined
  let maxReferenceDepth: number | undefined

  for (let index = 0; index < arguments_.length; index += 1) {
    const argument = arguments_[index]!

    if (argument === '--json') {
      json = true
      continue
    }
    if (argument === '--allow-http') {
      allowHttp = true
      continue
    }
    if (argument === '--allow-private-network') {
      allowPrivateNetwork = true
      continue
    }
    if (argument === '--allow-path') {
      const value = flagValue(arguments_, index)
      if (value === undefined) return { error: `Missing value for ${argument}.` }
      allowPaths.push(value)
      index += 1
      continue
    }
    if (argument === '--max-documents') {
      const value = positiveInteger(argument, flagValue(arguments_, index))
      if (typeof value === 'string') return { error: value }
      maxDocuments = value
      index += 1
      continue
    }
    if (argument === '--max-total-bytes') {
      const value = positiveInteger(argument, flagValue(arguments_, index))
      if (typeof value === 'string') return { error: value }
      maxTotalBytes = value
      index += 1
      continue
    }
    if (argument === '--max-ref-depth') {
      const value = nonNegativeInteger(argument, flagValue(arguments_, index))
      if (typeof value === 'string') return { error: value }
      maxReferenceDepth = value
      index += 1
      continue
    }
    if (argument.startsWith('--')) {
      return { error: `Unknown option ${argument}.` }
    }
    if (target !== undefined) {
      return { error: `Unexpected argument ${argument}.` }
    }
    target = argument
  }

  if (target === undefined) return { error: 'Missing file or URL to validate.' }

  return {
    options: {
      target,
      json,
      allowPaths,
      allowHttp,
      allowPrivateNetwork,
      ...(maxDocuments === undefined ? {} : { maxDocuments }),
      ...(maxTotalBytes === undefined ? {} : { maxTotalBytes }),
      ...(maxReferenceDepth === undefined ? {} : { maxReferenceDepth }),
    },
  }
}
