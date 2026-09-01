import { describe, expect, test, vi } from 'vitest'

import { runCli, type CliDependencies, type CliIo } from '../../src/index.js'

function createIo() {
  const stdout: string[] = []
  const stderr: string[] = []
  const io: CliIo = {
    stdout: (message) => stdout.push(message),
    stderr: (message) => stderr.push(message),
  }
  return { io, stdout, stderr }
}

function createDependencies(overrides: Partial<CliDependencies> = {}): CliDependencies {
  return {
    readFile: vi.fn(async () => '{"openapi":"3.1.0"}'),
    processOpenApi: vi.fn(async () => ({
      document: {
        schemaVersion: '1.0',
        sourceUri: 'openapi.json',
        openapiVersion: '3.1.0',
        compatibilityMode: false,
        info: { title: 'Example', version: '1.0.0' },
        tags: [],
        servers: [],
        operations: [],
        componentSchemas: [],
      },
      diagnostics: [],
    })),
    ...overrides,
  }
}

describe('schema-flow CLI', () => {
  test('returns usage exit code when validate path is missing', async () => {
    const output = createIo()
    const exitCode = await runCli(['validate'], createDependencies(), output.io)

    expect(exitCode).toBe(2)
    expect(output.stderr.join('')).toContain('Usage: schema-flow validate <file> [--json]')
  })

  test('emits a stable JSON validation report', async () => {
    const output = createIo()
    const exitCode = await runCli(
      ['validate', 'openapi.json', '--json'],
      createDependencies(),
      output.io,
    )

    expect(exitCode).toBe(0)
    expect(JSON.parse(output.stdout.join(''))).toMatchObject({
      schemaVersion: '1.0',
      command: 'validate',
      valid: true,
      openapiVersion: '3.1.0',
      operationCount: 0,
    })
    expect(output.stderr).toEqual([])
  })

  test('returns input exit code when a local file cannot be read', async () => {
    const output = createIo()
    const inputError = Object.assign(new Error('ENOENT: no such file or directory'), {
      code: 'ENOENT',
    })
    const exitCode = await runCli(
      ['validate', 'missing.yaml'],
      createDependencies({
        readFile: vi.fn(async () => {
          throw inputError
        }),
      }),
      output.io,
    )

    expect(exitCode).toBe(2)
    expect(output.stderr.join('')).toContain('ASF-CLI-1002')
    expect(output.stderr.join('')).toContain('missing.yaml')
  })

  test('redacts parser diagnostics in JSON output', async () => {
    const output = createIo()
    const exitCode = await runCli(
      ['validate', 'openapi.json', '--json'],
      createDependencies({
        processOpenApi: vi.fn(async () => ({
          diagnostics: [
            {
              code: 'ASF-OAS-1003',
              severity: 'error' as const,
              message: 'Authorization: Bearer parser-secret',
              source: { uri: 'openapi.json', pointer: '#' },
              details: { accessToken: 'details-secret' },
            },
          ],
        })),
      }),
      output.io,
    )

    const rawOutput = output.stdout.join('')
    const report = JSON.parse(rawOutput)

    expect(exitCode).toBe(1)
    expect(rawOutput).not.toContain('parser-secret')
    expect(rawOutput).not.toContain('details-secret')
    expect(report.diagnostics[0]).toMatchObject({
      message: 'Authorization: Bearer [REDACTED]',
      details: { accessToken: '[REDACTED]' },
    })
  })

  test('redacts unexpected credential text', async () => {
    const output = createIo()
    const exitCode = await runCli(
      ['validate', 'openapi.json'],
      createDependencies({
        readFile: vi.fn(async () => {
          throw new Error('Authorization: Bearer super-secret')
        }),
      }),
      output.io,
    )

    expect(exitCode).toBe(3)
    expect(output.stderr.join('')).not.toContain('super-secret')
    expect(output.stderr.join('')).toContain('[REDACTED]')
  })
})
