export const REDACTED_VALUE = '[REDACTED]'

const SECRET_KEYS = new Set([
  'authorization',
  'proxyauthorization',
  'cookie',
  'setcookie',
  'xapikey',
  'apikey',
  'token',
  'accesstoken',
  'refreshtoken',
  'idtoken',
  'password',
  'clientsecret',
  'secret',
])

function normalizeKey(key: string): string {
  return key.toLowerCase().replaceAll(/[^a-z0-9]/g, '')
}

function isSecretKey(key: string): boolean {
  return SECRET_KEYS.has(normalizeKey(key))
}

function redactUnknown(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactUnknown)
  }

  if (value === null || typeof value !== 'object') {
    return value
  }

  if (value instanceof Date) {
    return new Date(value.getTime())
  }

  const output: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value)) {
    output[key] = isSecretKey(key) ? REDACTED_VALUE : redactUnknown(child)
  }
  return output
}

export function redactSecrets<T>(value: T): T {
  return redactUnknown(value) as T
}

export function redactHeaders<T extends Readonly<Record<string, unknown>>>(headers: T): T {
  const output: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(headers)) {
    output[key] = isSecretKey(key) ? REDACTED_VALUE : redactUnknown(value)
  }
  return output as T
}

export function redactText(value: string): string {
  return value
    .replace(/\b(Bearer)\s+[^\s;,]+/gi, `$1 ${REDACTED_VALUE}`)
    .replace(
      /\b(api[_-]?key|access[_-]?token|refresh[_-]?token|password|client[_-]?secret)(\s*[=:]\s*)([^\s;,]+)/gi,
      (_match, key: string, separator: string) => `${key}${separator}${REDACTED_VALUE}`,
    )
}
