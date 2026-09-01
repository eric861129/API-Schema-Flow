export const HTTP_METHODS = [
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
] as const

export type HttpMethod = (typeof HTTP_METHODS)[number]

const HTTP_METHOD_SET = new Set<string>(HTTP_METHODS)

export function normalizeHttpMethod(value: string): HttpMethod | undefined {
  const normalized = value.toLowerCase()
  return HTTP_METHOD_SET.has(normalized) ? (normalized as HttpMethod) : undefined
}

export function isHttpMethod(value: string): boolean {
  return normalizeHttpMethod(value) !== undefined
}

export function createOperationId(method: string, path: string): string {
  const normalizedMethod = normalizeHttpMethod(method)
  if (!normalizedMethod) {
    throw new Error(`Unsupported HTTP method: ${method}`)
  }

  return `operation:${normalizedMethod}:${path}`
}
