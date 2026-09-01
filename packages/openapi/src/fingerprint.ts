import type { SourceDocument } from '@api-schema-flow/source-loader'

function bytesToHex(bytes: Uint8Array): string {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function fingerprintSources(sources: readonly SourceDocument[]): Promise<string> {
  const encoder = new TextEncoder()
  const canonical = [...sources]
    .sort((left, right) => left.uri.localeCompare(right.uri))
    .map((source) => {
      const uriBytes = encoder.encode(source.uri)
      const contentBytes = encoder.encode(source.contents)
      return `${uriBytes.byteLength}:${source.uri}\n${source.byteLength}:${contentBytes.byteLength}:${source.contents}\n`
    })
    .join('')
  const digest = await globalThis.crypto.subtle.digest('SHA-256', encoder.encode(canonical))
  return bytesToHex(new Uint8Array(digest))
}
