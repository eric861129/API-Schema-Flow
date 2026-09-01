import { fileURLToPath } from 'node:url'

import { describe, expect, test } from 'vitest'

import { runCli, type CliIo } from '../../src/index.js'

const fixturePath = fileURLToPath(
  new URL('../../../../examples/reservation/openapi.yaml', import.meta.url),
)

describe('validate command integration', () => {
  test('validates the Reservation fixture through the source graph and parser adapter', async () => {
    const stdout: string[] = []
    const stderr: string[] = []
    const io: CliIo = {
      stdout: (message) => stdout.push(message),
      stderr: (message) => stderr.push(message),
    }

    const exitCode = await runCli(['validate', fixturePath, '--json'], {}, io)

    expect(exitCode).toBe(0)
    expect(stderr).toEqual([])
    expect(stdout).toHaveLength(1)

    const report = JSON.parse(stdout.join(''))
    expect(report).toMatchObject({
      schemaVersion: '1.0',
      valid: true,
      openapiVersion: '3.1.0',
      operationCount: 4,
      schemaCount: 6,
      sourceCount: 1,
    })
    expect(report.fingerprint).toMatch(/^sha256:[a-f0-9]{64}$/)
    expect(report.referenceCount).toEqual(expect.any(Number))
  })
})
