export interface SourcePointer {
  readonly uri: string
  readonly pointer: string
}

export function escapeJsonPointerToken(token: string): string {
  return token.replaceAll('~', '~0').replaceAll('/', '~1')
}

export function createSourcePointer(uri: string, tokens: readonly string[] = []): SourcePointer {
  const pointer = tokens.length === 0 ? '#' : `#/${tokens.map(escapeJsonPointerToken).join('/')}`
  return { uri, pointer }
}

export function appendSourcePointer(
  source: SourcePointer,
  tokens: readonly string[],
): SourcePointer {
  const suffix = tokens.map(escapeJsonPointerToken).join('/')
  return {
    uri: source.uri,
    pointer: suffix.length === 0 ? source.pointer : `${source.pointer}/${suffix}`,
  }
}

export function formatSourcePointer(source: SourcePointer): string {
  return `${source.uri}${source.pointer}`
}
