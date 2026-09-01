export type UnknownRecord = Record<string, unknown>

export function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

export function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

export function booleanValue(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback
}

export function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === 'string')
}

export function sortedRecordEntries(value: unknown): [string, unknown][] {
  if (!isRecord(value)) return []
  return Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
}
