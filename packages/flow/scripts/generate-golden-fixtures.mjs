import { mkdir, readFile, writeFile } from 'node:fs/promises'

import { processArazzoSource } from '../../arazzo/dist/index.js'
import { processOpenApi } from '../../openapi/dist/index.js'
import { buildDeclaredFlowGraphs } from '../dist/index.js'

const fixtureRoot = new URL('../../../fixtures/flow/declared/', import.meta.url)

async function sourceDocument(relativePath, uri) {
  const contents = await readFile(new URL(relativePath, fixtureRoot), 'utf8')
  return {
    uri,
    contents,
    byteLength: Buffer.byteLength(contents),
  }
}

function assertValid(result, label) {
  const errors = result.diagnostics.filter(({ severity }) => severity === 'error')
  if (errors.length > 0 || result.document === undefined) {
    throw new Error(`${label} failed:\n${JSON.stringify(result.diagnostics, null, 2)}`)
  }
  return result.document
}

function serialize(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

async function writeGolden(relativePath, value) {
  const target = new URL(relativePath, fixtureRoot)
  await mkdir(new URL('./', target), { recursive: true })
  await writeFile(target, serialize(value), 'utf8')
  console.log(`Wrote ${target.pathname}`)
}

const linkDocument = assertValid(
  await processOpenApi(
    await sourceDocument(
      'openapi-link/openapi.yaml',
      'memory://fixtures/openapi-link/openapi.yaml',
    ),
  ),
  'OpenAPI Link fixture',
)
const linkProjection = buildDeclaredFlowGraphs({
  openApiSources: [{ sourceId: 'linkApi', sourceName: 'linkApi', document: linkDocument }],
})
if (linkProjection.diagnostics.length > 0) {
  throw new Error(`OpenAPI Link projection failed:\n${JSON.stringify(linkProjection.diagnostics, null, 2)}`)
}
await writeGolden('openapi-link/expected-operation-graph.json', linkProjection.operationGraph)

const reservationOpenApi = assertValid(
  await processOpenApi(
    await sourceDocument(
      'arazzo-reservation/openapi.yaml',
      'memory://fixtures/arazzo-reservation/openapi.yaml',
    ),
  ),
  'Reservation OpenAPI fixture',
)
const reservationArazzoSource = await sourceDocument(
  'arazzo-reservation/arazzo.yaml',
  'memory://fixtures/arazzo-reservation/arazzo.yaml',
)
const reservationArazzo = assertValid(
  processArazzoSource(reservationArazzoSource),
  'Reservation Arazzo fixture',
)
const reservationProjection = buildDeclaredFlowGraphs({
  openApiSources: [
    {
      sourceId: 'reservationApi',
      sourceName: 'reservationApi',
      document: reservationOpenApi,
    },
  ],
  arazzoSources: [
    {
      sourceId: 'reservationWorkflow',
      retrievalUri: reservationArazzoSource.uri,
      document: reservationArazzo,
    },
  ],
})
if (reservationProjection.diagnostics.length > 0) {
  throw new Error(
    `Reservation projection failed:\n${JSON.stringify(reservationProjection.diagnostics, null, 2)}`,
  )
}
await writeGolden('arazzo-reservation/expected-projection.json', reservationProjection)
