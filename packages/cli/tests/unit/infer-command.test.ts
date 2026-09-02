import path from 'node:path'

import type { FlowGraph, InferenceReport, NormalizedApiDocument } from '@api-schema-flow/domain'
import { describe, expect, test, vi } from 'vitest'

import type { CliDependencies, CliIo } from '../../src/index.js'

interface InferCommandOptions {
  readonly target: string
  readonly json: boolean
  readonly minimumConfidence?: number
  readonly topKPerTarget?: number
  readonly maxCandidates?: number
  readonly includeLowConfidence?: boolean
  readonly validateArguments: readonly string[]
}

type CliApi = {
  readonly executeInferCommand?: (
    options: InferCommandOptions,
    dependencies: CliDependencies,
    io: CliIo,
  ) => Promise<number>
}

function createIo() {
  const stdout: string[] = []
  const stderr: string[] = []
  const io: CliIo = {
    stdout: (message) => stdout.push(message),
    stderr: (message) => stderr.push(message),
  }
  return { io, stdout, stderr }
}

function document(): NormalizedApiDocument {
  return {
    schemaVersion: '1.0',
    sourceUri: 'file:///workspace/openapi.yaml',
    openapiVersion: '3.1.0',
    compatibilityMode: false,
    info: { title: 'Example API', version: '1.0.0' },
    tags: [],
    servers: [],
    operations: [],
    componentSchemas: [],
  }
}

function operationGraph(): FlowGraph {
  return {
    schemaVersion: '1.0',
    id: 'graph:operation-topology:cli',
    kind: 'operation-topology',
    title: 'Operation topology',
    sourceIds: ['cli'],
    nodes: [],
    edges: [],
  }
}

function inferenceReport(): InferenceReport {
  return {
    schemaVersion: '1.0',
    ruleSetVersion: 'm2c-v1',
    candidates: [],
    metrics: {
      sourceFieldCount: 1,
      targetFieldCount: 1,
      generatedPairCount: 1,
      blockedPairCount: 0,
      suppressedDeclaredCount: 0,
      emittedCandidateCount: 0,
      highConfidenceCount: 0,
      mediumConfidenceCount: 0,
      lowConfidenceCount: 0,
      truncated: false,
      elapsedMs: 1,
    },
    diagnostics: [],
  }
}

function dependencies() {
  const graph = operationGraph()
  const report = inferenceReport()
  const buildDeclaredFlowGraphs = vi.fn(() => ({
    operationGraph: graph,
    workflowGraphs: [],
    diagnostics: [],
  }))
  const inferFlowCandidates = vi.fn(() => report)
  const source = {
    uri: 'file:///workspace/openapi.yaml',
    contents: 'openapi: 3.1.0',
    byteLength: 14,
  }
  const acquirer = {
    resolveLocation: vi.fn(),
    acquire: vi.fn(async () => ({ source, diagnostics: [] })),
  }

  return {
    dependencies: {
      createAcquirer: () => acquirer,
      processOpenApiLocation: vi.fn(async () => ({ document: document(), diagnostics: [] })),
      resolvePath: path.posix.resolve,
      dirname: path.posix.dirname,
      cwd: () => '/workspace',
      buildDeclaredFlowGraphs,
      inferFlowCandidates,
    } as unknown as CliDependencies,
    buildDeclaredFlowGraphs,
    inferFlowCandidates,
  }
}

describe('infer CLI command', () => {
  test('composes normalized OpenAPI, declared graph, and inference into stable JSON', async () => {
    const api = (await import('../../src/index.js')) as CliApi
    expect(api.executeInferCommand).toBeTypeOf('function')
    if (api.executeInferCommand === undefined) return

    const output = createIo()
    const setup = dependencies()
    const exitCode = await api.executeInferCommand(
      {
        target: 'openapi.yaml',
        json: true,
        minimumConfidence: 0.75,
        topKPerTarget: 3,
        maxCandidates: 100,
        includeLowConfidence: true,
        validateArguments: ['validate', 'openapi.yaml'],
      },
      setup.dependencies,
      output.io,
    )

    expect(exitCode).toBe(0)
    expect(setup.buildDeclaredFlowGraphs).toHaveBeenCalledOnce()
    expect(setup.inferFlowCandidates).toHaveBeenCalledWith(
      expect.objectContaining({
        declaredOperationGraph: operationGraph(),
        config: expect.objectContaining({
          minimumConfidence: 0.75,
          topKPerTarget: 3,
          maxCandidates: 100,
          includeLowConfidence: true,
        }),
      }),
    )
    expect(JSON.parse(output.stdout.join(''))).toMatchObject({
      schemaVersion: '1.0',
      command: 'infer',
      source: 'openapi.yaml',
      openapiVersion: '3.1.0',
      ruleSetVersion: 'm2c-v1',
      candidates: [],
      diagnostics: [],
    })
    expect(output.stderr).toEqual([])
  })

  test('writes a concise human inference summary', async () => {
    const api = (await import('../../src/index.js')) as CliApi
    expect(api.executeInferCommand).toBeTypeOf('function')
    if (api.executeInferCommand === undefined) return

    const output = createIo()
    const setup = dependencies()
    const exitCode = await api.executeInferCommand(
      {
        target: 'openapi.yaml',
        json: false,
        validateArguments: ['validate', 'openapi.yaml'],
      },
      setup.dependencies,
      output.io,
    )

    expect(exitCode).toBe(0)
    expect(output.stdout.join('')).toContain('API Schema Flow')
    expect(output.stdout.join('')).toContain('0 candidate mappings')
    expect(output.stdout.join('')).toContain('Inference completed successfully.')
  })
})
