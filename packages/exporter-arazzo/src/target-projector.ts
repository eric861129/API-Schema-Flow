import type { FlowValueTarget } from '@api-schema-flow/domain'

import type { ProjectedArazzoParameter } from './contracts.js'

export function parameterTarget(
  target: FlowValueTarget,
  value: string,
): ProjectedArazzoParameter | undefined {
  switch (target.kind) {
    case 'path-parameter':
      return { name: target.name, in: 'path', value }
    case 'query-parameter':
      return { name: target.name, in: 'query', value }
    case 'header-parameter':
      return { name: target.name, in: 'header', value }
    case 'cookie-parameter':
      return { name: target.name, in: 'cookie', value }
    default:
      return undefined
  }
}

export function requestBodySegments(target: FlowValueTarget): string[] | undefined {
  if (target.kind !== 'request-body') return undefined
  const raw = target.pointer.replace(/^#?\/?/u, '')
  if (raw.length === 0) return []
  const segments = raw.split('/').map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'))
  if (segments.some((segment) => segment.length === 0 || /^\d+$/u.test(segment))) return undefined
  return segments
}

export function assignRequestBodyValue(
  root: Record<string, unknown>,
  segments: readonly string[],
  value: string,
): 'assigned' | 'duplicate' | 'conflict' {
  if (segments.length === 0) return 'conflict'
  let cursor = root
  for (const segment of segments.slice(0, -1)) {
    const current = cursor[segment]
    if (current === undefined) {
      const next: Record<string, unknown> = {}
      cursor[segment] = next
      cursor = next
      continue
    }
    if (typeof current !== 'object' || current === null || Array.isArray(current)) return 'conflict'
    cursor = current as Record<string, unknown>
  }
  const leaf = segments.at(-1)!
  if (cursor[leaf] === undefined) {
    cursor[leaf] = value
    return 'assigned'
  }
  return cursor[leaf] === value ? 'duplicate' : 'conflict'
}
