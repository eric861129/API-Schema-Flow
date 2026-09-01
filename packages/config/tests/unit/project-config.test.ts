import { describe, expect, test } from 'vitest'

import { parseProjectConfig } from '../../src/index.js'

describe('project config', () => {
  test('accepts the versioned local-file configuration', () => {
    const result = parseProjectConfig({
      schemaVersion: '1.0',
      project: { name: 'reservation-system' },
      sources: [{ type: 'file', path: './openapi.yaml' }],
    })

    expect(result.diagnostics).toEqual([])
    expect(result.config?.project.name).toBe('reservation-system')
  })

  test.each([
    [{ schemaVersion: '2.0', project: { name: 'x' }, sources: [] }],
    [{ schemaVersion: '1.0', project: { name: '   ' }, sources: [] }],
    [
      {
        schemaVersion: '1.0',
        project: { name: 'x' },
        sources: [{ type: 'url', url: 'https://example.com/openapi.yaml' }],
      },
    ],
  ])('rejects unsupported or invalid config %#', (input) => {
    const result = parseProjectConfig(input)
    expect(result.config).toBeUndefined()
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: 'ASF-CFG-1001', severity: 'error' }),
    ])
  })
})
