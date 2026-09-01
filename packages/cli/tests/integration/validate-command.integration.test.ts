import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { describe, expect, test } from 'vitest'

import { runCli, type CliIo } from '../../src/index.js'

const fixturePath = fileURLToPath(
  new URL('../../../../examples/reservation/openapi.yaml', import.meta.url),
)

describe('validate command integration', () => {
  test('validates the Reservation fixture through the real parser adapter', async () => {
    const stdout: string[] = []
    const stderr: string[] = []
    const io: CliIo = {
      stdout: (message) => stdout.push(message),
      stderr: (message) => stderr.push(message),
    }

    const exitCode = await runCli(['validate', fixturePath, '--json'], { readFile }, io)
    const report = JSON.parse(stdout.join(''))

    expect(exitCode).toBe(0)
    expect(stderr).toEqual([])
    expect(report).toMatchObject({
      schemaVersion: '1.0',
      valid: true,
      openapiVersion: '3.1.0',
      operationCount: 4,
      schemaCount: 6,
    })
  })
})
