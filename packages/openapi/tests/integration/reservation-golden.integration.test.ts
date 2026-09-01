import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { createSourceDocument } from '@api-schema-flow/source-loader'
import { describe, expect, test } from 'vitest'

import { processOpenApi } from '../../src/index.js'

const fixtureUrl = new URL('../../../../examples/reservation/openapi.yaml', import.meta.url)
const expectedUrl = new URL(
  '../../../../examples/reservation/expected/normalized-summary.json',
  import.meta.url,
)

describe('Reservation canonical fixture', () => {
  test('matches the normalized golden summary', async () => {
    const contents = await readFile(fixtureUrl, 'utf8')
    const expected = JSON.parse(await readFile(expectedUrl, 'utf8'))
    const sourceResult = createSourceDocument({
      uri: fileURLToPath(fixtureUrl),
      contents,
      mediaType: 'application/yaml',
    })

    expect(sourceResult.diagnostics).toEqual([])
    expect(sourceResult.source).toBeDefined()

    const result = await processOpenApi(sourceResult.source!)
    expect(result.diagnostics).toEqual([])
    expect(result.document).toBeDefined()

    const actual = {
      schemaVersion: result.document!.schemaVersion,
      title: result.document!.info.title,
      openapiVersion: result.document!.openapiVersion,
      operationCount: result.document!.operations.length,
      operations: result.document!.operations.map((operation) => ({
        id: operation.id,
        operationId: operation.operationId,
        method: operation.method,
        path: operation.path,
        responseCodes: operation.responses.map(({ statusCode }) => statusCode),
        securitySchemes: operation.security.flatMap(({ scheme }) => scheme),
      })),
      componentSchemas: result.document!.componentSchemas.map(({ name }) => name),
    }

    expect(actual).toEqual(expected)
  })
})
