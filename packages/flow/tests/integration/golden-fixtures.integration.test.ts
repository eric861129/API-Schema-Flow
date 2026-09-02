import { readFile } from 'node:fs/promises'

import { processArazzoSource } from '@api-schema-flow/arazzo'
import { processOpenApi } from '@api-schema-flow/openapi'
import { describe, expect, test } from 'vitest'

import { buildDeclaredFlowGraphs } from '../../src/index.js'

const fixtureRoot = new URL('../../../../fixtures/flow/declared/', import.meta.url)

async function sourceDocument(relativePath: string, uri: string) {
  const contents = await readFile(new URL(relativePath, fixtureRoot), 'utf8')
  return {
    uri,
    contents,
    byteLength: Buffer.byteLength(contents),
  }
}

function serialize(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

async function normalizedOpenApi(relativePath: string, uri: string) {
  const processed = await processOpenApi(await sourceDocument(relativePath, uri))
  expect(processed.diagnostics).toEqual([])
  expect(processed.document).toBeDefined()
  return processed.document!
}

describe('declared flow Golden Fixtures', () => {
  test('matches the OpenAPI Link operation graph byte for byte', async () => {
    const document = await normalizedOpenApi(
      'openapi-link/openapi.yaml',
      'memory://fixtures/openapi-link/openapi.yaml',
    )
    const projection = buildDeclaredFlowGraphs({
      openApiSources: [{ sourceId: 'linkApi', sourceName: 'linkApi', document }],
    })
    const expected = await readFile(
      new URL('openapi-link/expected-operation-graph.json', fixtureRoot),
      'utf8',
    )

    expect(projection.diagnostics).toEqual([])
    expect(serialize(projection.operationGraph)).toBe(expected)
  })

  test('matches the Reservation OpenAPI plus Arazzo projection byte for byte', async () => {
    const openApiDocument = await normalizedOpenApi(
      'arazzo-reservation/openapi.yaml',
      'memory://fixtures/arazzo-reservation/openapi.yaml',
    )
    const arazzoSource = await sourceDocument(
      'arazzo-reservation/arazzo.yaml',
      'memory://fixtures/arazzo-reservation/arazzo.yaml',
    )
    const processedArazzo = processArazzoSource(arazzoSource)
    expect(processedArazzo.diagnostics).toEqual([])
    expect(processedArazzo.document).toBeDefined()

    const projection = buildDeclaredFlowGraphs({
      openApiSources: [
        {
          sourceId: 'reservationApi',
          sourceName: 'reservationApi',
          document: openApiDocument,
        },
      ],
      arazzoSources: [
        {
          sourceId: 'reservationWorkflow',
          retrievalUri: arazzoSource.uri,
          document: processedArazzo.document!,
        },
      ],
    })
    const expected = await readFile(
      new URL('arazzo-reservation/expected-projection.json', fixtureRoot),
      'utf8',
    )

    expect(projection.diagnostics).toEqual([])
    expect(projection.operationGraph.nodes).toHaveLength(4)
    expect(projection.workflowGraphs[0]?.nodes).toHaveLength(4)
    expect(projection.workflowGraphs[0]?.edges.filter(({ kind }) => kind === 'control')).toHaveLength(
      3,
    )
    expect(
      projection.workflowGraphs[0]?.edges.filter(({ kind }) => kind === 'dependency'),
    ).toHaveLength(3)
    expect(projection.workflowGraphs[0]?.edges.filter(({ kind }) => kind === 'data')).toHaveLength(5)
    expect(serialize(projection)).toBe(expected)
  })

  test('never serializes representative secret values into Golden Graphs', async () => {
    const values = await Promise.all([
      readFile(new URL('openapi-link/expected-operation-graph.json', fixtureRoot), 'utf8'),
      readFile(new URL('arazzo-reservation/expected-projection.json', fixtureRoot), 'utf8'),
    ])
    const serialized = values.join('\n').toLowerCase()

    for (const secret of [
      'synthetic-password',
      'synthetic-jwt-token',
      'authorization: bearer',
      'clientsecret',
      'x-api-key-value',
      'session-cookie-value',
    ]) {
      expect(serialized).not.toContain(secret)
    }
  })
})
