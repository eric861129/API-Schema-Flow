import { describe, expect, test } from 'vitest'

import {
  buildDeclaredFlowGraphs,
  collectArazzoStepOutputUses,
  createArazzoOperationCatalogs,
} from '../../src/index.js'
import {
  createReservationArazzoSource,
  createReservationOpenApiSource,
} from '../helpers/fixtures.js'

describe('declared flow graph builder', () => {
  test('creates Arazzo operation catalogs only for named OpenAPI sources', () => {
    const named = createReservationOpenApiSource()
    const unnamed = { ...named, sourceId: 'unnamed', sourceName: undefined }

    expect(createArazzoOperationCatalogs([named, unnamed])).toEqual([
      expect.objectContaining({
        sourceName: 'reservationApi',
        sourceType: 'openapi',
        operations: expect.arrayContaining([
          expect.objectContaining({
            key: 'operation:post:/reservations',
            operationId: 'createReservation',
          }),
        ]),
      }),
    ])
  })

  test('finds step-output uses recursively in templates and objects', () => {
    const workflow = createReservationArazzoSource().document.workflows[0]!
    const createStep = workflow.steps.find(({ stepId }) => stepId === 'createReservation')!
    const auth = createStep.parameters[0]!.value
    const body = createStep.requestBody!.payload

    expect(collectArazzoStepOutputUses(auth)).toEqual([
      expect.objectContaining({
        stepId: 'login',
        outputName: 'token',
        transform: {
          kind: 'template',
          raw: 'Bearer {$steps.login.outputs.token}',
        },
      }),
    ])
    expect(collectArazzoStepOutputUses(body)).toEqual([
      expect.objectContaining({ stepId: 'listSpaces', outputName: 'spaceId' }),
    ])
  })

  test('builds deterministic declared operation and workflow graphs', () => {
    const input = {
      openApiSources: [createReservationOpenApiSource({ includeLink: true })],
      arazzoSources: [createReservationArazzoSource()],
    }
    const first = buildDeclaredFlowGraphs(input)
    const second = buildDeclaredFlowGraphs(input)

    expect(second).toEqual(first)
    expect(first.diagnostics).toEqual([])
    expect(first.operationGraph.nodes).toHaveLength(4)
    expect(first.workflowGraphs).toHaveLength(1)

    const workflowGraph = first.workflowGraphs[0]!
    expect(workflowGraph.nodes).toHaveLength(4)
    expect(workflowGraph.edges.filter(({ kind }) => kind === 'control')).toHaveLength(3)
    expect(workflowGraph.edges.filter(({ kind }) => kind === 'dependency')).toHaveLength(3)
    expect(workflowGraph.edges.filter(({ kind }) => kind === 'data')).toHaveLength(5)

    expect(
      [...first.operationGraph.edges, ...workflowGraph.edges].every(
        ({ provenance, status }) => provenance === 'declared' && status === 'accepted',
      ),
    ).toBe(true)
    expect(JSON.stringify(first)).not.toContain('"candidate"')
    expect(JSON.stringify(first)).not.toContain('"confidence"')

    const reservationMapping = first.operationGraph.edges.find(
      (edge) =>
        edge.kind === 'data' &&
        edge.mappings.some(
          ({ source, target }) =>
            source.kind === 'response-body' &&
            source.pointer === '#/id' &&
            target.kind === 'path-parameter' &&
            target.name === 'id',
        ),
    )
    expect(reservationMapping?.sourceStandardRefs.map(({ standard }) => standard)).toEqual([
      'arazzo',
      'openapi-link',
    ])
  })
})
