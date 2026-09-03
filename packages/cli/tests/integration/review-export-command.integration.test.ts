import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, test } from 'vitest'

import { runCli, type CliIo } from '../../src/index.js'

const fixtureRoot = path.resolve(import.meta.dirname, '../../../..', 'fixtures/review/reservation')
const openApi = path.join(fixtureRoot, 'openapi.yaml')
const decisions = path.join(fixtureRoot, 'decision-set.json')
const workflow = path.join(fixtureRoot, 'workflow-plan.json')
const createdDirectories: string[] = []

function createIo() {
  const stdout: string[] = []
  const stderr: string[] = []
  const io: CliIo = {
    stdout: (message) => stdout.push(message),
    stderr: (message) => stderr.push(message),
  }
  return { io, stdout, stderr }
}

afterEach(async () => {
  await Promise.all(
    createdDirectories
      .splice(0)
      .map((directory) => fs.rm(directory, { recursive: true, force: true })),
  )
})

describe('review and Arazzo export CLI integration', () => {
  test('reviews the canonical decision set into an accepted graph', async () => {
    const output = createIo()
    const exitCode = await runCli(
      ['review', openApi, '--decisions', decisions, '--json'],
      {},
      output.io,
    )

    expect(exitCode).toBe(0)
    expect(output.stderr).toEqual([])
    const report = JSON.parse(output.stdout.join(''))
    expect(report).toMatchObject({
      schemaVersion: '1.0',
      command: 'review',
      valid: true,
      ruleSetVersion: 'm2c-v1',
      metrics: {
        appliedCount: 3,
        rejectedCount: 1,
        staleCount: 1,
        orphanedCount: 1,
        supersededCount: 1,
      },
    })
    expect(report.graph.edges).toHaveLength(3)
  })

  test.each(['yaml', 'json'] as const)(
    'writes the exact Golden %s artifact to stdout',
    async (format) => {
      const output = createIo()
      const exitCode = await runCli(
        [
          'export-arazzo',
          openApi,
          '--decisions',
          decisions,
          '--workflow',
          workflow,
          '--format',
          format,
        ],
        {},
        output.io,
      )
      const expected = await fs.readFile(
        path.join(fixtureRoot, `expected-workflow.arazzo.${format === 'yaml' ? 'yaml' : 'json'}`),
        'utf8',
      )

      expect(exitCode).toBe(0)
      const warnings = output.stderr.join('')
      expect(warnings).toContain('ASF-REV-1003')
      expect(warnings).toContain('ASF-REV-1004')
      expect(warnings).not.toContain('synthetic-password')
      expect(warnings).not.toContain('synthetic-jwt-token')
      expect(output.stdout.join('')).toBe(expected)
    },
  )

  test('refuses overwrite without force and atomically replaces with force', async () => {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'schema-flow-m2d-'))
    createdDirectories.push(directory)
    const outputPath = path.join(directory, 'workflow.yaml')
    await fs.writeFile(outputPath, 'existing\n')

    const denied = createIo()
    const deniedExit = await runCli(
      [
        'export-arazzo',
        openApi,
        '--decisions',
        decisions,
        '--workflow',
        workflow,
        '--output',
        outputPath,
        '--json',
      ],
      {},
      denied.io,
    )
    expect(deniedExit).toBe(2)
    expect(await fs.readFile(outputPath, 'utf8')).toBe('existing\n')

    const forced = createIo()
    const forcedExit = await runCli(
      [
        'export-arazzo',
        openApi,
        '--decisions',
        decisions,
        '--workflow',
        workflow,
        '--output',
        outputPath,
        '--force',
        '--json',
      ],
      {},
      forced.io,
    )
    const expected = await fs.readFile(
      path.join(fixtureRoot, 'expected-workflow.arazzo.yaml'),
      'utf8',
    )
    expect(forcedExit).toBe(0)
    expect(await fs.readFile(outputPath, 'utf8')).toBe(expected)
    expect(JSON.parse(forced.stdout.join(''))).toMatchObject({
      command: 'export-arazzo',
      valid: true,
      outputPath,
    })
  })
})
