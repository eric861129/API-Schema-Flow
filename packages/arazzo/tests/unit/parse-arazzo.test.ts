import { describe, expect, test } from 'vitest'

import { looksLikeArazzoSource, parseArazzoSource } from '../../src/index.js'

function source(contents: string, mediaType?: string) {
  return {
    uri: 'memory://workflow',
    contents,
    byteLength: new TextEncoder().encode(contents).byteLength,
    ...(mediaType === undefined ? {} : { mediaType }),
  }
}

describe('Arazzo source parsing', () => {
  test('parses a YAML object into parser-independent data', () => {
    const result = parseArazzoSource(
      source(
        [
          'arazzo: 1.1.0',
          'info:',
          '  title: Reservation workflows',
          '  version: 0.1.0',
          'sourceDescriptions: []',
          'workflows: []',
        ].join('\n'),
        'application/yaml',
      ),
    )

    expect(result.diagnostics).toEqual([])
    expect(result.document).toMatchObject({
      arazzo: '1.1.0',
      info: { title: 'Reservation workflows', version: '0.1.0' },
      sourceDescriptions: [],
      workflows: [],
    })
    expect(result.version).toBe('1.1.0')
  })

  test('parses JSON and recognizes Arazzo without relying on a filename', () => {
    const input = source(
      JSON.stringify({
        arazzo: '1.1.0',
        info: { title: 'JSON workflow', version: '1.0.0' },
        sourceDescriptions: [],
        workflows: [],
      }),
      'application/json',
    )

    expect(looksLikeArazzoSource(input)).toBe(true)
    expect(parseArazzoSource(input).document).toMatchObject({ arazzo: '1.1.0' })
    expect(
      looksLikeArazzoSource(
        source(
          JSON.stringify({
            openapi: '3.1.0',
            info: { title: 'API', version: '1.0.0' },
            paths: {},
          }),
        ),
      ),
    ).toBe(false)
  })

  test('returns stable diagnostics for malformed, empty, and non-object roots', () => {
    expect(parseArazzoSource(source('arazzo: [1.1.0')).diagnostics).toEqual([
      expect.objectContaining({ code: 'ASF-ARZ-1002', severity: 'error' }),
    ])
    expect(parseArazzoSource(source('')).diagnostics).toEqual([
      expect.objectContaining({ code: 'ASF-ARZ-1002', severity: 'error' }),
    ])
    expect(parseArazzoSource(source('[1, 2, 3]')).diagnostics).toEqual([
      expect.objectContaining({ code: 'ASF-ARZ-1003', severity: 'error' }),
    ])
  })

  test('does not execute or accept custom YAML tags', () => {
    const result = parseArazzoSource(
      source(
        [
          'arazzo: 1.1.0',
          'info: !custom',
          '  title: Unsafe',
          '  version: 1.0.0',
          'sourceDescriptions: []',
          'workflows: []',
        ].join('\n'),
      ),
    )

    expect(result.document).toBeUndefined()
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: 'ASF-ARZ-1002', severity: 'error' }),
    ])
  })
})
