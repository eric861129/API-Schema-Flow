import { describe, expect, test, vi } from 'vitest'
import * as inference from '@api-schema-flow/inference'
import { DIAGNOSTIC_CODES } from '@api-schema-flow/diagnostics'
import { fileURLToPath } from 'node:url'
import { runCli } from '../../src/index.js'
import { importWorkspace } from '../../src/workspace-import.js'

describe('open command failure boundaries', () => {
  test.each([
    [],
    ['https://example.invalid/api.json'],
    ['file.json', '--port', '0'],
    ['file.json', '--port', '65536'],
    ['file.json', '--port'],
    ['file.json', '--unknown'],
    ['file.json', '--port', '123', 'extra'],
  ])('rejects invalid arguments %j', async (...args) => {
    const stderr = vi.fn()
    expect(await runCli(['open', ...args], {}, { stdout: vi.fn(), stderr })).toBe(2)
    expect(stderr).toHaveBeenCalledWith(expect.stringContaining('Usage: schema-flow open'))
  })
  test('refuses time-truncated candidate sets so saved projects stay reproducible', async () => {
    const spy = vi.spyOn(inference, 'inferFlowCandidates').mockReturnValue({
      candidates: [],
      diagnostics: [
        {
          code: DIAGNOSTIC_CODES.INFERENCE_TIME_LIMIT,
          severity: 'warning',
          message: 'Time limit reached',
        },
      ],
    } as unknown as ReturnType<typeof inference.inferFlowCandidates>)
    try {
      const fixture = fileURLToPath(
        new URL('../../../../examples/reservation/openapi.yaml', import.meta.url),
      )
      await expect(importWorkspace(fixture)).rejects.toThrow('Inference timed out')
    } finally {
      spy.mockRestore()
    }
  })
})
