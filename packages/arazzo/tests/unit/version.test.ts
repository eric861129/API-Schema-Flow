import { describe, expect, test } from 'vitest'

import { detectArazzoVersion } from '../../src/index.js'

describe('Arazzo version detection', () => {
  test('accepts the Arazzo 1.1 feature line', () => {
    expect(detectArazzoVersion({ arazzo: '1.1.0' }, 'memory://workflow')).toEqual({
      version: '1.1.0',
      compatibilityMode: false,
      diagnostics: [],
    })

    expect(detectArazzoVersion({ arazzo: '1.1.7' }, 'memory://workflow')).toEqual({
      version: '1.1.7',
      compatibilityMode: false,
      diagnostics: [],
    })
  })

  test.each([undefined, '1.0.1', '2.0.0', 'not-a-version'])(
    'rejects unsupported or malformed version %s',
    (version) => {
      const result = detectArazzoVersion(
        version === undefined ? {} : { arazzo: version },
        'memory://workflow',
      )

      expect(result.version).toBeUndefined()
      expect(result.diagnostics).toEqual([
        expect.objectContaining({
          code: 'ASF-ARZ-1001',
          severity: 'error',
          source: { uri: 'memory://workflow', pointer: '#/arazzo' },
        }),
      ])
    },
  )
})
