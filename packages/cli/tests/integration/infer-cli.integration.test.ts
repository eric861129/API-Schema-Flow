import { fileURLToPath } from 'node:url'

import { describe, expect, test } from 'vitest'

import { runCli, type CliIo } from '../../src/index.js'

function createIo() {
  const stdout: string[] = []
  const stderr: string[] = []
  const io: CliIo = {
    stdout: (message) => stdout.push(message),
    stderr: (message) => stderr.push(message),
  }
  return { io, stdout, stderr }
}

const fixturePath = fileURLToPath(
  new URL('../../../../fixtures/inference/cli/openapi.yaml', import.meta.url),
)

describe('schema-flow infer integration', () => {
  test('infers a deterministic create-to-read mapping from a real OpenAPI file', async () => {
    const output = createIo()
    const exitCode = await runCli(['infer', fixturePath, '--json'], {}, output.io)

    expect(exitCode).toBe(0)
    expect(output.stderr).toEqual([])

    const report = JSON.parse(output.stdout.join(''))
    expect(report).toMatchObject({
      schemaVersion: '1.0',
      command: 'infer',
      openapiVersion: '3.1.0',
      ruleSetVersion: 'm2c-v1',
    })
    expect(report.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceOperationKey: 'operation:post:/reservations',
          targetOperationKey: 'operation:get:/reservations/{id}',
          confidence: 0.95,
          band: 'high',
          provenance: 'inferred',
          status: 'candidate',
        }),
      ]),
    )
  })
})
