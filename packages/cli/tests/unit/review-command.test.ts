import path from 'node:path'

import type { FlowGraph, InferenceReport, ReviewDecisionSet } from '@api-schema-flow/domain'
import { describe, expect, test, vi } from 'vitest'

import type { CliDependencies, CliIo, ReviewCommandOptions } from '../../src/index.js'

type CliApi = {
  readonly executeReviewCommand?: (
    options: ReviewCommandOptions,
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

const graph: FlowGraph = {
  schemaVersion: '1.0',
  id: 'graph:operation-topology:cli',
  kind: 'operation-topology',
  title: 'Operation topology',
  sourceIds: ['cli'],
  nodes: [],
  edges: [],
}

const decisionSet: ReviewDecisionSet = {
  schemaVersion: '1.0',
  revision: 1,
  decisions: [],
  manualEdges: [],
}

const inference: InferenceReport = {
  schemaVersion: '1.0',
  ruleSetVersion: 'm2c-v1',
  candidates: [],
  metrics: {
    sourceFieldCount: 0,
    targetFieldCount: 0,
    generatedPairCount: 0,
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

function dependencies() {
  const source = {
    uri: 'file:///workspace/openapi.yaml',
    contents: 'openapi: 3.1.0',
    byteLength: 14,
  }
  const acquirer = {
    resolveLocation: vi.fn(),
    acquire: vi.fn(async () => ({ source, diagnostics: [] })),
  }
  const materializeReviewedOperationGraph = vi.fn(() => ({
    graph,
    outcomes: [],
    metrics: {
      appliedCount: 0,
      rejectedCount: 0,
      staleCount: 0,
      orphanedCount: 0,
      supersededCount: 0,
      alreadyPresentCount: 0,
    },
    diagnostics: [],
  }))
  return {
    dependencies: {
      createAcquirer: () => acquirer,
      processOpenApiLocation: vi.fn(async () => ({
        document: {
          schemaVersion: '1.0',
          sourceUri: source.uri,
          openapiVersion: '3.1.0',
          compatibilityMode: false,
          info: { title: 'API', version: '1.0.0' },
          tags: [],
          servers: [],
          operations: [],
          componentSchemas: [],
        },
        diagnostics: [],
      })),
      buildDeclaredFlowGraphs: vi.fn(() => ({
        operationGraph: graph,
        workflowGraphs: [],
        diagnostics: [],
      })),
      inferFlowCandidates: vi.fn(() => inference),
      readTextFile: vi.fn(async () => JSON.stringify(decisionSet)),
      parseReviewDecisionSet: vi.fn(() => ({ decisionSet, diagnostics: [] })),
      materializeReviewedOperationGraph,
      resolvePath: path.posix.resolve,
      dirname: path.posix.dirname,
      cwd: () => '/workspace',
    } as unknown as CliDependencies,
    materializeReviewedOperationGraph,
  }
}

const options: ReviewCommandOptions = {
  target: 'openapi.yaml',
  decisionsPath: 'decisions.json',
  json: true,
  validateArguments: ['validate', 'openapi.yaml'],
}

describe('review CLI command', () => {
  test('composes OpenAPI, declared graph, inference, decisions, and materialization', async () => {
    const api = (await import('../../src/index.js')) as CliApi
    expect(api.executeReviewCommand).toBeTypeOf('function')
    if (api.executeReviewCommand === undefined) return

    const output = createIo()
    const setup = dependencies()
    const exitCode = await api.executeReviewCommand(options, setup.dependencies, output.io)

    expect(exitCode).toBe(0)
    expect(setup.materializeReviewedOperationGraph).toHaveBeenCalledWith({
      declaredOperationGraph: graph,
      candidates: [],
      decisionSet,
    })
    expect(JSON.parse(output.stdout.join(''))).toMatchObject({
      schemaVersion: '1.0',
      command: 'review',
      source: 'openapi.yaml',
      valid: true,
      ruleSetVersion: 'm2c-v1',
      graph,
      outcomes: [],
      diagnostics: [],
    })
    expect(output.stderr).toEqual([])
  })

  test('classifies unreadable decision files as input errors', async () => {
    const api = (await import('../../src/index.js')) as CliApi
    expect(api.executeReviewCommand).toBeTypeOf('function')
    if (api.executeReviewCommand === undefined) return

    const output = createIo()
    const setup = dependencies()
    setup.dependencies.readTextFile = vi.fn(async () => {
      throw new Error('ENOENT: decision-secret')
    })
    const exitCode = await api.executeReviewCommand(options, setup.dependencies, output.io)

    expect(exitCode).toBe(2)
    expect(output.stdout.join('')).not.toContain('decision-secret')
    expect(output.stdout.join('')).toContain('ASF-CLI-1002')
  })
})
