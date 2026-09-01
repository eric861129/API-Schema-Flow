export type JsonPointerResolution =
  | { readonly found: true; readonly value: unknown }
  | { readonly found: false; readonly reason: string }

function decodeToken(token: string): string | undefined {
  if (/~(?:[^01]|$)/.test(token)) return undefined
  return token.replaceAll('~1', '/').replaceAll('~0', '~')
}

function arrayIndex(token: string): number | undefined {
  if (!/^(?:0|[1-9]\d*)$/.test(token)) return undefined
  const index = Number(token)
  return Number.isSafeInteger(index) ? index : undefined
}

export function resolveJsonPointer(document: unknown, pointer: string): JsonPointerResolution {
  if (!pointer.startsWith('#')) {
    return { found: false, reason: 'JSON Pointer fragment must start with #.' }
  }

  let fragment: string
  try {
    fragment = decodeURIComponent(pointer.slice(1))
  } catch {
    return { found: false, reason: 'JSON Pointer fragment contains invalid percent encoding.' }
  }

  if (fragment === '') return { found: true, value: document }
  if (!fragment.startsWith('/')) {
    return { found: false, reason: 'JSON Pointer fragment must be empty or start with /.' }
  }

  let current = document
  for (const encodedToken of fragment.slice(1).split('/')) {
    const token = decodeToken(encodedToken)
    if (token === undefined) {
      return { found: false, reason: 'JSON Pointer token contains an invalid ~ escape.' }
    }

    if (Array.isArray(current)) {
      const index = arrayIndex(token)
      if (index === undefined || index >= current.length) {
        return { found: false, reason: `Array index ${token} does not exist.` }
      }
      current = current[index]
      continue
    }

    if (current !== null && typeof current === 'object' && Object.hasOwn(current, token)) {
      current = Reflect.get(current, token)
      continue
    }

    return { found: false, reason: `Object property ${token} does not exist.` }
  }

  return { found: true, value: current }
}
