import type { InferenceCandidate, InferenceReport } from '@api-schema-flow/domain'
import { buildDeclaredFlowGraphs } from '@api-schema-flow/flow'
import { describe, expect, test } from 'vitest'

import { createInferenceInput, createInferenceSource } from '../helpers/fixture.js'

type InferenceApi = {
  readonly inferFlowCandidates?: (input: unknown) => InferenceReport
}

async function api(): Promise<InferenceApi> {
  return (await import('../../src/index.js')) as InferenceApi
}

function isReservationIdCandidate(candidate: InferenceCandidate): boolean {
  return (
    candidate.sourceOperationKey === 'operation:post:/reservations' &&
    candidate.targetOperationKey === 'operation:get:/reservations/{id}' &&
    candidate.mapping.source.kind === 'response-body' &&
    candidate.mapping.source.pointer === '#/id' &&
    candidate.mapping.target.kind === 'path-parameter' &&
    candidate.mapping.target.name === 'id'
  )
}

describe('evidence-based inference pipeline', () => {
  test('proposes the Reservation create-to-read ID mapping at high confidence', async () => {
    const module = await api()
    const { input } = createInferenceInput()
    const report = module.inferFlowCandidates?.(input)
    const candidate = report?.candidates.find(isReservationIdCandidate)

    expect(candidate).toMatchObject({
      provenance: 'inferred',
      status: 'candidate',
      band: 'high',
      confidence: 0.95,
    })
    expect(candidate?.evidence.map(({ ruleId }) => ruleId)).toEqual(
      expect.arrayContaining([
        'INF-NAME-EXACT',
        'INF-SCHEMA-TYPE',
        'INF-SCHEMA-FORMAT',
        'INF-RESOURCE-PATH',
        'INF-LIFECYCLE-CREATE-READ',
      ]),
    )
    expect(candidate?.blockers).toEqual([])
  })

  test('maps token-like responses only to bearer-secured Authorization targets', async () => {
    const module = await api()
    const { input } = createInferenceInput()
    const report = module.inferFlowCandidates?.(input)
    const authCandidates =
      report?.candidates.filter(
        ({ sourceOperationKey, mapping }) =>
          sourceOperationKey === 'operation:post:/auth/login' &&
          mapping.target.kind === 'header-parameter' &&
          mapping.target.name === 'Authorization',
      ) ?? []

    expect(authCandidates.length).toBeGreaterThan(0)
    expect(authCandidates.every(({ confidence }) => confidence === 0.95)).toBe(true)
    expect(authCandidates.every(({ evidence }) => evidence.some(({ ruleId }) => ruleId === 'INF-AUTH-BEARER'))).toBe(true)
    expect(authCandidates.some(({ targetOperationKey }) => targetOperationKey === 'operation:get:/users/{id}')).toBe(false)
  })

  test('does not infer an array item without an explicit selector', async () => {
    const module = await api()
    const { input } = createInferenceInput()
    const report = module.inferFlowCandidates?.(input)

    expect(
      report?.candidates.some(
        ({ sourceOperationKey, mapping }) =>
          sourceOperationKey === 'operation:get:/spaces/available' &&
          mapping.source.kind === 'response-body' &&
          mapping.source.pointer.endsWith('/id'),
      ),
    ).toBe(false)
    expect(report?.metrics.blockedPairCount).toBeGreaterThan(0)
  })

  test('does not promote a cross-resource generic ID to high confidence', async () => {
    const module = await api()
    const { input } = createInferenceInput()
    const report = module.inferFlowCandidates?.(input)

    expect(
      report?.candidates.some(
        (candidate) =>
          candidate.sourceOperationKey === 'operation:post:/reservations' &&
          candidate.targetOperationKey === 'operation:get:/users/{id}' &&
          candidate.band === 'high',
      ),
    ).toBe(false)
  })

  test('suppresses a mapping already declared by OpenAPI Link', async () => {
    const module = await api()
    const { input } = createInferenceInput({ declaredLink: true })
    const report = module.inferFlowCandidates?.(input)

    expect(report?.candidates.some(isReservationIdCandidate)).toBe(false)
    expect(report?.metrics.suppressedDeclaredCount).toBeGreaterThanOrEqual(1)
  })

  test('produces identical candidates for reversed operation input', async () => {
    const module = await api()
    const source = createInferenceSource()
    const reversed = {
      ...source,
      document: {
        ...source.document,
        operations: [...source.document.operations].reverse(),
      },
    }
    const firstGraph = buildDeclaredFlowGraphs({ openApiSources: [source] }).operationGraph
    const secondGraph = buildDeclaredFlowGraphs({ openApiSources: [reversed] }).operationGraph

    const first = module.inferFlowCandidates?.({
      openApiSources: [source],
      declaredOperationGraph: firstGraph,
    })
    const second = module.inferFlowCandidates?.({
      openApiSources: [reversed],
      declaredOperationGraph: secondGraph,
    })

    expect(second?.candidates).toEqual(first?.candidates)
  })
})
