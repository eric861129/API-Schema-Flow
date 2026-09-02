import { describe, expect, test } from 'vitest'

import { detectSpecificationKind } from '../../src/index.js'

function source(contents: string) {
  return {
    uri: 'memory://specification',
    contents,
    byteLength: new TextEncoder().encode(contents).byteLength,
  }
}

describe('CLI specification kind detection', () => {
  test.each([
    ['arazzo: 1.1.0\ninfo: {}\nsourceDescriptions: []\nworkflows: []\n', 'arazzo'],
    [
      JSON.stringify({ arazzo: '1.1.0', info: {}, sourceDescriptions: [], workflows: [] }),
      'arazzo',
    ],
    ['openapi: 3.1.0\ninfo: {}\npaths: {}\n', 'openapi'],
    [JSON.stringify({ openapi: '3.2.0', info: {}, paths: {} }), 'openapi'],
    ['swagger: "2.0"\ninfo: {}\npaths: {}\n', 'openapi'],
  ] as const)('detects %s as %s', (contents, kind) => {
    expect(detectSpecificationKind(source(contents))).toEqual({ kind, diagnostics: [] })
  })

  test.each([
    ['{}', 'object without a specification version'],
    ['- one\n- two\n', 'non-object document'],
    [': malformed', 'malformed structured input'],
  ])('reports an unknown specification for %s', (contents) => {
    const result = detectSpecificationKind(source(contents))

    expect(result.kind).toBeUndefined()
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: 'ASF-CLI-1003', severity: 'error' }),
    ])
  })
})
