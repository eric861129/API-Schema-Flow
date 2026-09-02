import { describe, expect, test } from 'vitest'

import { parseInferArguments } from '../../src/index.js'

describe('infer CLI options', () => {
  test('parses inference and source-policy options deterministically', () => {
    const result = parseInferArguments([
      'infer',
      'openapi.yaml',
      '--json',
      '--minimum-confidence',
      '0.75',
      '--top-k',
      '3',
      '--max-candidates',
      '100',
      '--include-low',
      '--allow-path',
      '../shared',
      '--max-documents',
      '20',
    ])

    expect(result.diagnostics).toEqual([])
    expect(result.options).toEqual({
      target: 'openapi.yaml',
      json: true,
      minimumConfidence: 0.75,
      topKPerTarget: 3,
      maxCandidates: 100,
      includeLowConfidence: true,
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
    [['infer'], 'Usage: schema-flow infer'],
    [['infer', 'openapi.yaml', '--minimum-confidence', '1.1'], 'between 0 and 1'],
    [['infer', 'openapi.yaml', '--top-k', '0'], 'positive integer'],
    [['infer', 'openapi.yaml', '--max-candidates', '1.5'], 'positive integer'],
  ])('rejects invalid arguments %#', (argv, expectedMessage) => {
    const result = parseInferArguments(argv)

    expect(result.options).toBeUndefined()
    expect(result.diagnostics[0]?.message).toContain(expectedMessage)
  })
})
