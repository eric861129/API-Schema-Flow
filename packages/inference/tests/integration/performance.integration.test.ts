import type {
  NormalizedApiDocument,
  NormalizedOperation,
  NormalizedSchema,
} from '@api-schema-flow/domain'
import { buildDeclaredFlowGraphs, type FlowOpenApiSource } from '@api-schema-flow/flow'
import { describe, expect, test } from 'vitest'

import { inferFlowCandidates } from '../../src/index.js'

const URI = 'memory://inference/performance.yaml'

function schema(pointer: string): NormalizedSchema {
  return {
    types: ['string'],
    format: 'uuid',
    required: [],
    readOnly: false,
    writeOnly: false,
    nullable: false,
    enumValues: [],
    properties: {},
    allOf: [],
    oneOf: [],
    anyOf: [],
    source: { uri: URI, pointer },
  }
}

function createOperation(index: number): NormalizedOperation {
  const path = `/resources-${index}`
  const operationPointer = `#/paths/~1resources-${index}/post`
  const idSchema = schema(`${operationPointer}/responses/201/schema/properties/resource${index}Id`)
  const responseSchema: NormalizedSchema = {
    types: ['object'],
    required: [`resource${index}Id`],
    readOnly: false,
    writeOnly: false,
    nullable: false,
    enumValues: [],
    properties: { [`resource${index}Id`]: idSchema },
    allOf: [],
    oneOf: [],
    anyOf: [],
    source: { uri: URI, pointer: `${operationPointer}/responses/201/schema` },
  }
  return {
    id: `operation:post:${path}`,
    operationId: `createResource${index}`,
    method: 'post',
    path,
    tags: [`Resource${index}`],
    deprecated: false,
    parameters: [],
    responses: [
      {
        statusCode: '201',
        description: 'Created',
        content: [
          {
            mediaType: 'application/json',
            schema: responseSchema,
            source: { uri: URI, pointer: `${operationPointer}/responses/201/content/application~1json` },
          },
        ],
        links: [],
        source: { uri: URI, pointer: `${operationPointer}/responses/201` },
      },
    ],
    security: [],
    servers: [],
    source: { uri: URI, pointer: operationPointer },
  }
}

function readOperation(index: number): NormalizedOperation {
  const path = `/resources-${index}/{resource${index}Id}`
  const operationPointer = `#/paths/~1resources-${index}~1{resource${index}Id}/get`
  const idSchema = schema(`${operationPointer}/parameters/0/schema`)
  return {
    id: `operation:get:${path}`,
    operationId: `getResource${index}`,
    method: 'get',
    path,
    tags: [`Resource${index}`],
    deprecated: false,
    parameters: [
      {
        name: `resource${index}Id`,
        location: 'path',
        required: true,
        deprecated: false,
        schema: idSchema,
        source: { uri: URI, pointer: `${operationPointer}/parameters/0` },
      },
    ],
    responses: [],
    security: [],
    servers: [],
    source: { uri: URI, pointer: operationPointer },
  }
}

function performanceSource(): FlowOpenApiSource {
  const operations = Array.from({ length: 250 }, (_, index) => [
    createOperation(index),
    readOperation(index),
  ]).flat()
  const document: NormalizedApiDocument = {
    schemaVersion: '1.0',
    sourceUri: URI,
    openapiVersion: '3.1.0',
    compatibilityMode: false,
    info: { title: 'Inference performance fixture', version: '1.0.0' },
    tags: [],
    servers: [],
    operations,
    componentSchemas: [],
  }
  return { sourceId: 'performance', sourceName: 'performance', document }
}

describe('M2-C inference performance', () => {
  test('processes 500 operations within the regression budget', () => {
    const source = performanceSource()
    const graph = buildDeclaredFlowGraphs({ openApiSources: [source] }).operationGraph
    const startedAt = performance.now()
    const report = inferFlowCandidates({
      openApiSources: [source],
      declaredOperationGraph: graph,
      config: { maxElapsedMs: 5000, maxPairs: 50000 },
    })
    const elapsedMs = performance.now() - startedAt

    expect(elapsedMs).toBeLessThan(5000)
    expect(report.diagnostics.some(({ code }) => code === 'ASF-INF-1006')).toBe(false)
    expect(report.metrics.generatedPairCount).toBeLessThanOrEqual(50000)
    expect(report.candidates.length).toBe(250)
    expect(report.candidates.every(({ band }) => band === 'high')).toBe(true)
  })
})
