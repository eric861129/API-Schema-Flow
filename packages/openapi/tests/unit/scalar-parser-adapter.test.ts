import { describe, expect, test } from 'vitest'

import { ScalarOpenApiParserAdapter } from '../../src/index.js'

const adapter = new ScalarOpenApiParserAdapter()

describe('Scalar parser adapter', () => {
  test('returns a parser-independent object for a valid document', async () => {
    const result = await adapter.parse({
      uri: 'memory://valid.json',
      byteLength: 123,
      contents: JSON.stringify({
        openapi: '3.1.0',
        info: { title: 'Example', version: '1.0.0' },
        paths: {},
      }),
    })

    expect(result.diagnostics).toEqual([])
    expect(result.document).toMatchObject({ openapi: '3.1.0' })
  })

  test('maps parser errors to project diagnostics', async () => {
    const result = await adapter.parse({
      uri: 'memory://invalid.yaml',
      byteLength: 19,
      contents: 'openapi: not-valid\n',
    })

    expect(result.document).toBeUndefined()
    expect(result.diagnostics.length).toBeGreaterThan(0)
    expect(result.diagnostics[0]).toMatchObject({ code: 'ASF-OAS-1003', severity: 'error' })
  })
})
