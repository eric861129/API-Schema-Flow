import { describe, expect, test } from 'vitest'

import { parseExportArazzoArguments } from '../../src/index.js'

describe('export-arazzo CLI options', () => {
  test('parses required files, format, output, force, JSON, and source policy', () => {
    const result = parseExportArazzoArguments([
      'export-arazzo',
      'openapi.yaml',
      '--decisions',
      'decisions.json',
      '--workflow',
      'workflow.json',
      '--format',
      'json',
      '--output',
      'workflow.arazzo.json',
      '--force',
      '--json',
      '--allow-http',
    ])

    expect(result.diagnostics).toEqual([])
    expect(result.options).toEqual({
      target: 'openapi.yaml',
      decisionsPath: 'decisions.json',
      workflowPath: 'workflow.json',
      format: 'json',
      outputPath: 'workflow.arazzo.json',
      force: true,
      json: true,
      validateArguments: ['validate', 'openapi.yaml', '--allow-http'],
    })
  })

  test.each([
    [['export-arazzo', 'openapi.yaml', '--workflow', 'workflow.json'], '--decisions'],
    [['export-arazzo', 'openapi.yaml', '--decisions', 'decisions.json'], '--workflow'],
    [
      [
        'export-arazzo',
        'openapi.yaml',
        '--decisions',
        'decisions.json',
        '--workflow',
        'workflow.json',
        '--format',
        'xml',
      ],
      'yaml or json',
    ],
    [
      [
        'export-arazzo',
        'openapi.yaml',
        '--decisions',
        'decisions.json',
        '--workflow',
        'workflow.json',
        '--force',
      ],
      '--output',
    ],
  ])('rejects invalid arguments %#', (argv, expected) => {
    const result = parseExportArazzoArguments(argv)
    expect(result.options).toBeUndefined()
    expect(result.diagnostics[0]?.message).toContain(expected)
  })
})
