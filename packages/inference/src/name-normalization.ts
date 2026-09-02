import type { NormalizedInferenceName } from './contracts.js'

const SECRET_TOKEN_SEQUENCES = [
  'authorization',
  'cookie',
  'password',
  'secret',
  'client:secret',
  'api:key',
  'access:token',
  'refresh:token',
  'id:token',
  'token',
]

const GENERIC_OPERATION_TOKENS = new Set([
  'api',
  'by',
  'create',
  'delete',
  'fetch',
  'find',
  'get',
  'list',
  'patch',
  'post',
  'put',
  'read',
  'remove',
  'set',
  'update',
])

function splitWords(value: string): string[] {
  return value
    .normalize('NFKC')
    .replace(/([A-Z]+)([A-Z][a-z])/gu, '$1 $2')
    .replace(/([a-z\d])([A-Z])/gu, '$1 $2')
    .split(/[^\p{L}\p{N}]+/gu)
    .map((token) => token.toLocaleLowerCase('en-US'))
    .filter((token) => token.length > 0)
}

function secretLike(tokens: readonly string[]): boolean {
  const signature = tokens.join(':')
  return SECRET_TOKEN_SEQUENCES.some(
    (secret) =>
      signature === secret ||
      signature.includes(`:${secret}`) ||
      signature.startsWith(`${secret}:`),
  )
}

export function normalizeFieldName(value: string): NormalizedInferenceName {
  const tokens = splitWords(value)
  return {
    original: value,
    tokens,
    signature: tokens.join(':'),
    genericId: tokens.length === 1 && tokens[0] === 'id',
    secretLike: secretLike(tokens),
  }
}

export function normalizeResourceSegment(value: string): string {
  const trimmed = value.trim()
  if (/^\{[^}]+\}$/u.test(trimmed)) return ''
  const tokens = splitWords(trimmed)
  if (tokens.length === 0) return ''
  const joined = tokens.join('-')
  if (joined.endsWith('ies') && joined.length > 3) {
    return `${joined.slice(0, -3)}y`
  }
  if (
    joined.endsWith('s') &&
    joined.length > 1 &&
    !joined.endsWith('ss') &&
    !joined.endsWith('us') &&
    joined !== 'status'
  ) {
    return joined.slice(0, -1)
  }
  return joined
}

export function meaningfulOperationTokens(value: string | undefined): readonly string[] {
  if (value === undefined) return []
  return [
    ...new Set(splitWords(value).filter((token) => !GENERIC_OPERATION_TOKENS.has(token))),
  ].sort()
}

export function resourceKeyForPath(path: string): string {
  const segments = path
    .split('/')
    .map(normalizeResourceSegment)
    .filter((segment) => segment.length > 0)
  return segments.at(-1) ?? ''
}
