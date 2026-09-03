import type { FlowValueSelector } from '@api-schema-flow/domain'
import { createMappingId } from '@api-schema-flow/flow'

export interface ProjectedSourceOutput {
  readonly name: string
  readonly expression: string
}

function decodePointerToken(value: string): string {
  return value.replace(/~1/g, '/').replace(/~0/g, '~')
}

function identifier(value: string, fallback: string): string {
  const words = value
    .normalize('NFKC')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .split(/\s+/u)
    .filter(Boolean)
  if (words.length === 0) return fallback
  const [first, ...rest] = words
  const result = `${first!.slice(0, 1).toLowerCase()}${first!.slice(1)}${rest
    .map((word) => `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`)
    .join('')}`
  return /^[A-Za-z_]/u.test(result) ? result : `value${result}`
}

export function projectSourceOutput(
  selector: FlowValueSelector,
): ProjectedSourceOutput | undefined {
  if (selector.kind === 'response-body') {
    const tokens = selector.pointer
      .replace(/^#?\/?/u, '')
      .split('/')
      .filter(Boolean)
    const last = tokens.length === 0 ? 'responseValue' : decodePointerToken(tokens.at(-1)!)
    return {
      name: identifier(last, 'responseValue'),
      expression: `$response.body${selector.pointer.startsWith('#') ? selector.pointer : `#${selector.pointer}`}`,
    }
  }
  if (selector.kind === 'response-header') {
    return {
      name: identifier(selector.name, 'responseHeader'),
      expression: `$response.header.${selector.name}`,
    }
  }
  if (selector.kind === 'status-code') {
    return { name: 'statusCode', expression: '$statusCode' }
  }
  return undefined
}

export function disambiguateOutputName(
  proposed: string,
  selector: FlowValueSelector,
  existing: Readonly<Record<string, string>>,
  expression: string,
): string {
  if (existing[proposed] === undefined || existing[proposed] === expression) return proposed
  const suffix = createMappingId(selector, { kind: 'request-body', pointer: '#/' }).slice(-6)
  return `${proposed}_${suffix}`
}
