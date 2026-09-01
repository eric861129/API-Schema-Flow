import { describe, expect, test } from 'vitest'

import { DEFAULT_SOURCE_SIZE_LIMIT_BYTES, createSourceDocument } from '../../src/index.js'

describe('source documents', () => {
  test('creates a bounded UTF-8 source document', () => {
    const result = createSourceDocument({
      uri: 'openapi.yaml',
      contents: 'openapi: 3.1.0\n',
      mediaType: 'application/yaml',
    })

    expect(result.diagnostics).toEqual([])
    expect(result.source).toEqual({
      uri: 'openapi.yaml',
      contents: 'openapi: 3.1.0\n',
      mediaType: 'application/yaml',
      byteLength: 15,
    })
  })

  test('rejects empty content before parsing', () => {
    const result = createSourceDocument({ uri: 'empty.yaml', contents: '   ' })
    expect(result.source).toBeUndefined()
    expect(result.diagnostics[0]).toMatchObject({ code: 'ASF-SRC-1001', severity: 'error' })
  })

  test('rejects content larger than the configured byte limit', () => {
    const result = createSourceDocument({
      uri: 'large.yaml',
      contents: 'x'.repeat(DEFAULT_SOURCE_SIZE_LIMIT_BYTES + 1),
    })

    expect(result.source).toBeUndefined()
    expect(result.diagnostics[0]).toMatchObject({ code: 'ASF-SRC-1002', severity: 'error' })
  })
})
