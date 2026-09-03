import fs from 'node:fs/promises'
import path from 'node:path'

import { describe, expect, test } from 'vitest'

import type { ArazzoWorkflowPlan } from '../../src/index.js'
import { exportArazzo } from '../../src/index.js'
import { buildDeclaredFlowGraphs } from '@api-schema-flow/flow'
import { inferFlowCandidates } from '@api-schema-flow/inference'
import { processOpenApi } from '@api-schema-flow/openapi'
import { materializeReviewedOperationGraph, parseReviewDecisionSet } from '@api-schema-flow/review'

const fixtureRoot = path.resolve(import.meta.dirname, '../../../..', 'fixtures/review/reservation')
const sourceUri = 'memory://review/reservation/openapi.yaml'

async function loadPipeline() {
  const contents = await fs.readFile(path.join(fixtureRoot, 'openapi.yaml'), 'utf8')
  const processed = await processOpenApi({
    uri: sourceUri,
    contents,
    byteLength: Buffer.byteLength(contents),
    mediaType: 'application/yaml',
  })
  expect(processed.diagnostics).toEqual([])
  expect(processed.document).toBeDefined()
  const openApiSource = {
    sourceId: 'cli',
    sourceName: 'reservationApi',
    document: processed.document!,
  }
  const declared = buildDeclaredFlowGraphs({ openApiSources: [openApiSource] })
  const inference = inferFlowCandidates({
    openApiSources: [openApiSource],
    declaredOperationGraph: declared.operationGraph,
  })
  const parsedDecisions = parseReviewDecisionSet(
    JSON.parse(await fs.readFile(path.join(fixtureRoot, 'decision-set.json'), 'utf8')),
  )
  expect(parsedDecisions.diagnostics).toEqual([])
  expect(parsedDecisions.decisionSet).toBeDefined()
  const reviewed = materializeReviewedOperationGraph({
    declaredOperationGraph: declared.operationGraph,
    candidates: inference.candidates,
    decisionSet: parsedDecisions.decisionSet!,
  })
  const workflowPlan = JSON.parse(
    await fs.readFile(path.join(fixtureRoot, 'workflow-plan.json'), 'utf8'),
  ) as ArazzoWorkflowPlan
  return { openApiSource, reviewed, workflowPlan }
}

describe('M2-D reservation Golden Fixtures', () => {
  test('materializes the expected accepted graph and review outcomes', async () => {
    const { reviewed } = await loadPipeline()
    const expected = await fs.readFile(
      path.join(fixtureRoot, 'expected-reviewed-graph.json'),
      'utf8',
    )

    expect(`${JSON.stringify(reviewed, null, 2)}\n`).toBe(expected)
    expect(reviewed.metrics).toEqual({
      appliedCount: 3,
      rejectedCount: 1,
      staleCount: 1,
      orphanedCount: 1,
      supersededCount: 1,
      alreadyPresentCount: 0,
    })
    expect(reviewed.graph.edges).toHaveLength(3)
    expect(reviewed.graph.edges.every(({ status }) => status === 'accepted')).toBe(true)
  })

  test.each(['yaml', 'json'] as const)('exports the exact Golden Arazzo %s', async (format) => {
    const { openApiSource, reviewed, workflowPlan } = await loadPipeline()
    const artifact = await exportArazzo({
      title: 'Reservation API workflows',
      version: '1.0.0',
      format,
      workflowPlan,
      openApiSources: [openApiSource],
      acceptedOperationGraph: reviewed.graph,
    })
    const expected = await fs.readFile(
      path.join(fixtureRoot, `expected-workflow.arazzo.${format === 'yaml' ? 'yaml' : 'json'}`),
      'utf8',
    )

    expect(artifact.diagnostics).toEqual([])
    expect(artifact.document).toBeDefined()
    expect(artifact.contents).toBe(expected)
    expect(expected).not.toContain('synthetic-password')
    expect(expected).not.toContain('synthetic-jwt-token')
  })
})
