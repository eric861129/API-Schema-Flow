import { realpath } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  analyzeWorkflowDependencies,
  processArazzoSource,
  resolveArazzoOperations,
  type ArazzoOperationCatalog,
} from '../../src/index.js'
import { createSourceBudget, createSourceRetrievalPolicy } from '@api-schema-flow/source-loader'
import { createNodeSourceAcquirer } from '@api-schema-flow/source-loader/node'
import { describe, expect, test } from 'vitest'

const fixturePath = fileURLToPath(
  new URL('../../../../fixtures/arazzo/valid/reservation.yaml', import.meta.url),
)

describe('Reservation Arazzo integration', () => {
  test('loads, normalizes, validates, analyzes, and binds the canonical workflow', async () => {
    const fixtureRoot = await realpath(path.dirname(fixturePath))
    const policy = createSourceRetrievalPolicy({ allowedFileRoots: [fixtureRoot] })
    const budget = createSourceBudget(policy)
    const acquirer = createNodeSourceAcquirer()
    const acquired = await acquirer.acquire({ kind: 'file', path: fixturePath }, { policy, budget })

    expect(acquired.diagnostics).toEqual([])
    expect(acquired.source).toBeDefined()
    if (!acquired.source) return

    const processed = processArazzoSource(acquired.source)
    expect(processed.diagnostics).toEqual([])
    expect(processed.support).toMatchObject({ level: 'supported' })
    expect(processed.document?.sourceDescriptions[0]?.resolvedUri).toBe(
      new URL('./openapi.yaml', pathToFileURL(fixturePath)).href,
    )

    const workflow = processed.document?.workflows[0]
    expect(workflow).toBeDefined()
    if (!workflow || !processed.document) return

    expect(analyzeWorkflowDependencies(workflow)).toMatchObject({
      order: ['login', 'listSpaces', 'createReservation', 'getReservation'],
      diagnostics: [],
    })

    const catalog: ArazzoOperationCatalog = {
      sourceName: 'reservationApi',
      sourceType: 'openapi',
      sourceUri: processed.document.sourceDescriptions[0]!.resolvedUri!,
      operations: [
        { key: 'operation:post:/auth/login', operationId: 'login' },
        { key: 'operation:get:/spaces/available', operationId: 'listAvailableSpaces' },
        { key: 'operation:post:/reservations', operationId: 'createReservation' },
        { key: 'operation:get:/reservations/{id}', operationId: 'getReservation' },
      ],
    }
    const resolution = resolveArazzoOperations(processed.document, [catalog], acquired.source.uri)

    expect(resolution.diagnostics).toEqual([])
    expect(
      resolution.resolutions.map(({ status, operationKey }) => [status, operationKey]),
    ).toEqual([
      ['resolved', 'operation:post:/auth/login'],
      ['resolved', 'operation:get:/spaces/available'],
      ['resolved', 'operation:post:/reservations'],
      ['resolved', 'operation:get:/reservations/{id}'],
    ])
  })
  test('classifies preserve-only and invalid fixtures without dropping their content', async () => {
    const fixtureRoot = await realpath(
      fileURLToPath(new URL('../../../../fixtures/arazzo', import.meta.url)),
    )
    const policy = createSourceRetrievalPolicy({ allowedFileRoots: [fixtureRoot] })
    const acquirer = createNodeSourceAcquirer()

    const load = async (relativePath: string) => {
      const budget = createSourceBudget(policy)
      const result = await acquirer.acquire(
        { kind: 'file', path: path.join(fixtureRoot, relativePath) },
        { policy, budget },
      )
      expect(result.diagnostics).toEqual([])
      expect(result.source).toBeDefined()
      return result.source ? processArazzoSource(result.source) : undefined
    }

    const asyncWorkflow = await load('unsupported-valid/async-step.yaml')
    expect(asyncWorkflow?.diagnostics).toEqual([])
    expect(asyncWorkflow?.support).toMatchObject({ level: 'preserve-only' })
    expect(asyncWorkflow?.document?.workflows[0]?.steps[0]?.preservedFields).toEqual({
      futureDirection: 'send',
    })

    const invalidWorkflow = await load('invalid/duplicate-step.yaml')
    expect(invalidWorkflow?.diagnostics).toEqual([
      expect.objectContaining({ code: 'ASF-ARZ-1006', severity: 'error' }),
    ])
    expect(invalidWorkflow?.document?.workflows[0]?.steps).toHaveLength(2)

    const runtimeExpressions = await load('runtime-expressions/core.yaml')
    expect(runtimeExpressions?.diagnostics).toEqual([])
    expect(
      runtimeExpressions?.document?.workflows[0]?.steps[1]?.parameters[0]?.value,
    ).toMatchObject({ kind: 'template' })
  })
})
