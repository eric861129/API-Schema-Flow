import path from 'node:path'

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

function validDocument() {
  return {
    schemaVersion: '1.0' as const,
    sourceUri: 'file:///workspace/project/openapi.yaml',
    openapiVersion: '3.1.0',
    compatibilityMode: false,
    fingerprint: 'sha256:fixture',
    sourceCount: 2,
    referenceCount: 1,
    info: { title: 'Example', version: '1.0.0' },
    tags: [],
    servers: [],
    operations: [],
    componentSchemas: [],
  }
}

function createDependencies(
  result: unknown = { document: validDocument(), diagnostics: [] },
) {
  const acquirer = {
    resolveLocation: vi.fn(),
    acquire: vi.fn(),
  }
  const processOpenApiLocation = vi.fn(async () => result)
  const dependencies = {
    createAcquirer: () => acquirer,
    processOpenApiLocation,
    resolvePath: (...parts: string[]) => path.posix.resolve('/workspace', ...parts),
    dirname: path.posix.dirname,
    cwd: () => '/workspace',
  } as unknown as CliDependencies

  return { dependencies, acquirer, processOpenApiLocation }
}

describe('schema-flow validate retrieval policy flags', () => {
  test('builds a local-file policy with explicit roots and resource budgets', async () => {
    const output = createIo()
    const setup = createDependencies()

    const exitCode = await runCli(
      [
        'validate',
        'project/openapi.yaml',
        '--json',
        '--allow-path',
        'shared',
        '--allow-http',
        '--allow-private-network',
        '--max-documents',
        '7',
        '--max-total-bytes',
        '4096',
        '--max-ref-depth',
        '0',
      ],
      setup.dependencies,
      output.io,
    )

    expect(exitCode).toBe(0)
    expect(setup.processOpenApiLocation).toHaveBeenCalledWith(
      { kind: 'file', path: '/workspace/project/openapi.yaml' },
      {
        acquirer: setup.acquirer,
        policy: expect.objectContaining({
          version: 1,
          mode: 'local-cli',
          allowedFileRoots: ['/workspace/project', '/workspace/shared'],
          allowHttp: true,
          allowPrivateNetwork: true,
          maxDocuments: 7,
          maxTotalBytes: 4096,
          maxReferenceDepth: 0,
        }),
      },
    )
  })

  test('treats an HTTP or HTTPS target as a URL source without implicit file roots', async () => {
    const output = createIo()
    const setup = createDependencies()

    const exitCode = await runCli(
      ['validate', 'https://api.example.com/openapi.yaml', '--json'],
      setup.dependencies,
      output.io,
    )

    expect(exitCode).toBe(0)
    expect(setup.processOpenApiLocation).toHaveBeenCalledWith(
      { kind: 'url', url: 'https://api.example.com/openapi.yaml' },
      {
        acquirer: setup.acquirer,
        policy: expect.objectContaining({
          allowedFileRoots: [],
          allowHttp: false,
          allowPrivateNetwork: false,
        }),
      },
    )
  })

  test.each([
    [['validate', 'openapi.yaml', '--max-documents', '0'], '--max-documents'],
    [['validate', 'openapi.yaml', '--max-total-bytes', 'abc'], '--max-total-bytes'],
    [['validate', 'openapi.yaml', '--max-ref-depth'], '--max-ref-depth'],
    [['validate', 'openapi.yaml', '--allow-path'], '--allow-path'],
  ])('rejects an invalid flag value for %s', async (arguments_, flag) => {
    const output = createIo()
    const setup = createDependencies()

    const exitCode = await runCli(arguments_, setup.dependencies, output.io)

    expect(exitCode).toBe(2)
    expect(output.stderr.join('')).toContain(flag)
    expect(setup.processOpenApiLocation).not.toHaveBeenCalled()
  })

  test('returns input exit code for source acquisition and policy diagnostics', async () => {
    const output = createIo()
    const setup = createDependencies({
      diagnostics: [
        {
          code: 'ASF-SRC-1004',
          severity: 'error',
          message: 'Source file is outside the allowed root.',
          source: { uri: 'openapi.yaml', pointer: '#' },
        },
      ],
    })

    const exitCode = await runCli(
      ['validate', 'openapi.yaml'],
      setup.dependencies,
      output.io,
    )

    expect(exitCode).toBe(2)
    expect(output.stderr.join('')).toContain('ASF-SRC-1004')
  })

  test('returns specification exit code for OpenAPI diagnostics', async () => {
    const output = createIo()
    const setup = createDependencies({
      diagnostics: [
        {
          code: 'ASF-OAS-1003',
          severity: 'error',
          message: 'OpenAPI is invalid.',
          source: { uri: 'openapi.yaml', pointer: '#' },
        },
      ],
    })

    const exitCode = await runCli(
      ['validate', 'openapi.yaml'],
      setup.dependencies,
      output.io,
    )

    expect(exitCode).toBe(1)
    expect(output.stderr.join('')).toContain('ASF-OAS-1003')
  })

  test('includes source graph evidence in JSON output', async () => {
    const output = createIo()
    const setup = createDependencies()

    const exitCode = await runCli(
      ['validate', 'project/openapi.yaml', '--json'],
      setup.dependencies,
      output.io,
    )
    const report = JSON.parse(output.stdout.join(''))

    expect(exitCode).toBe(0)
    expect(report).toMatchObject({
      fingerprint: 'sha256:fixture',
      sourceCount: 2,
      referenceCount: 1,
    })
  })
})
