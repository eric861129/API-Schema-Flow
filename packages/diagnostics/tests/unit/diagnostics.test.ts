import { describe, expect, test } from 'vitest'

import {
  formatDiagnostic,
  hasDiagnosticErrors,
  sortDiagnostics,
  type Diagnostic,
} from '../../src/index.js'

const diagnostics: Diagnostic[] = [
  {
    code: 'ASF-OAS-2001',
    severity: 'warning',
    message: 'Compatibility mode.',
    source: { uri: 'openapi.yaml', pointer: '#' },
  },
  {
    code: 'ASF-OAS-1002',
    severity: 'error',
    message: 'Unsupported version.',
    source: { uri: 'openapi.yaml', pointer: '#/openapi' },
  },
  {
    code: 'ASF-OAS-1001',
    severity: 'error',
    message: 'OpenAPI paths must be an object.',
    source: { uri: 'openapi.yaml', pointer: '#/paths' },
  },
]

describe('diagnostics', () => {
  test('sorts errors before warnings and then by stable code and location', () => {
    expect(sortDiagnostics(diagnostics).map(({ code }) => code)).toEqual([
      'ASF-OAS-1001',
      'ASF-OAS-1002',
      'ASF-OAS-2001',
    ])
  })

  test('formats a diagnostic for humans', () => {
    expect(formatDiagnostic(diagnostics[2])).toBe(
      'ERROR ASF-OAS-1001 openapi.yaml#/paths: OpenAPI paths must be an object.',
    )
  })

  test('detects error severity without mutating the input', () => {
    const original = structuredClone(diagnostics)
    expect(hasDiagnosticErrors(diagnostics)).toBe(true)
    expect(diagnostics).toEqual(original)
  })
})
