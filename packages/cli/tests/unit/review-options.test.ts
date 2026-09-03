import { describe, expect, test } from 'vitest'

import { parseReviewArguments } from '../../src/index.js'

describe('review CLI options', () => {
  test('requires and parses a local decision set plus source-policy flags', () => {
    const result = parseReviewArguments([
      'review',
      'openapi.yaml',
      '--decisions',
      'decisions.json',
      '--json',
      '--allow-path',
      '../shared',
      '--max-documents',
      '20',
    ])

    expect(result.diagnostics).toEqual([])
    expect(result.options).toEqual({
      target: 'openapi.yaml',
      decisionsPath: 'decisions.json',
      json: true,
      validateArguments: [
        'validate',
        'openapi.yaml',
        '--allow-path',
        '../shared',
        '--max-documents',
        '20',
      ],
    })
  })

  test.each([
    [['review', 'openapi.yaml'], '--decisions'],
    [['review', 'openapi.yaml', '--decisions'], 'requires a value'],
    [['review', 'openapi.yaml', '--decisions', 'decisions.json', '--wat'], 'Unknown option'],
  ])('rejects invalid arguments %#', (argv, expected) => {
    const result = parseReviewArguments(argv)
    expect(result.options).toBeUndefined()
    expect(result.diagnostics[0]?.message).toContain(expected)
  })
})
