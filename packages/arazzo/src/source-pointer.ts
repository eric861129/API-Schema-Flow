import {
  appendSourcePointer,
  createSourcePointer,
  type SourcePointer,
} from '@api-schema-flow/domain'

export function arazzoRootSource(uri: string): SourcePointer {
  return createSourcePointer(uri)
}

export function arazzoChildSource(
  source: SourcePointer,
  ...tokens: readonly string[]
): SourcePointer {
  return appendSourcePointer(source, tokens)
}
