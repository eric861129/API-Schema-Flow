import { expect } from '@playwright/test'
import { test } from './review-helpers'
import { fileURLToPath } from 'node:url'
import { build } from 'vite'
import type { WorkspaceSnapshot } from '../src/data/types'
import type * as ReviewEngine from '../src/review/review-engine'
import type * as ReviewSession from '../src/review/review-session'
import type * as ReviewSelectors from '../src/review/review-selectors'
import type * as ReviewAdapter from '../src/review/review-workspace-adapter'
import type { ReviewCandidateRow } from '../src/review/review-selectors'

// 僅供測試的記憶體 bundle；不在正式應用程式加入計時器或除錯入口。
test('meets review core budgets in Chromium with 1,000 candidates and 500 nodes', async ({
  page,
}, testInfo) => {
  const modulePath = (name: string) =>
    fileURLToPath(new URL(`../src/review/${name}.ts`, import.meta.url)).replaceAll('\\', '/')
  const bundle = await build({
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      minify: true,
      lib: {
        entry: Object.fromEntries(
          ['review-engine', 'review-session', 'review-selectors', 'review-workspace-adapter'].map(
            (name) => [name, modulePath(name)],
          ),
        ),
        formats: ['es'],
        fileName: (_format, name) => `${name}.js`,
      },
    },
  })
  const outputs = Array.isArray(bundle) ? bundle.flatMap((item) => item.output) : bundle.output
  await page.route('**/__review-benchmark/**', async (route) => {
    const fileName = new URL(route.request().url()).pathname.split('/').at(-1)
    const output = outputs.find((item) => item.fileName === fileName)
    if (!output || output.type !== 'chunk') throw new Error(`Missing benchmark chunk ${fileName}`)
    await route.fulfill({ contentType: 'text/javascript', body: output.code })
  })
  let fixture: WorkspaceSnapshot
  await page.route('**/fixtures/reservation-workspace.json', async (route) => {
    const response = await route.fetch()
    const original: WorkspaceSnapshot = await response.json()
    const seed = original.inferenceCandidates.find(
      (candidate) => candidate.sourceOperationKey === 'operation:post:/auth/login',
    )!
    const operations = Array.from({ length: 500 }, (_, index) => {
      const key = index % 2 === 0 ? seed.sourceOperationKey : seed.targetOperationKey
      const operation = original.apiDocument.operations.find((item) => item.id === key)!
      return {
        ...operation,
        id: `operation:post:/benchmark/${index}`,
        path: `/benchmark/${index}`,
        operationId: `benchmark${index}`,
      }
    })
    const nodes = operations.map((operation) => ({
      ...original.declaredGraph.nodes[0]!,
      id: `endpoint:${operation.id}`,
      operationKey: operation.id,
    }))
    const graph = { ...original.declaredGraph, nodes, edges: [] }
    fixture = {
      ...original,
      apiDocument: { ...original.apiDocument, operations },
      declaredGraph: graph,
      acceptedGraph: graph,
      reviewDecisionSet: { schemaVersion: '1.0', revision: 0, decisions: [], manualEdges: [] },
      reviewOutcomes: [],
      inferenceCandidates: Array.from({ length: 1_000 }, (_, index) => {
        const source = nodes[(index * 2) % 500]!
        const target = nodes[(index * 2 + 1) % 500]!
        return {
          ...seed,
          id: `candidate:benchmark:${String(index).padStart(4, '0')}`,
          fingerprint: `fingerprint:benchmark:${index}`,
          sourceOperationKey: source.operationKey,
          sourceOperationNodeId: source.id,
          targetOperationKey: target.operationKey,
          targetOperationNodeId: target.id,
        }
      }),
    }
    await route.fulfill({ response, json: fixture })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Inference Review', exact: true }).click()
  await expect(page.getByText('1000 of 1000 candidates', { exact: true })).toBeVisible()

  const measurements = await page.evaluate(async (snapshot) => {
    const modules = await Promise.all(
      ['review-engine', 'review-session', 'review-selectors', 'review-workspace-adapter'].map(
        (name) => import('/__review-benchmark/' + name + '.js'),
      ),
    )
    const api: typeof ReviewEngine &
      typeof ReviewSession &
      typeof ReviewSelectors &
      typeof ReviewAdapter = Object.assign({}, ...modules)
    const baseline = JSON.stringify(snapshot)
    const initial = api.createInitialReviewSession(snapshot.reviewContext)
    const candidateId = snapshot.inferenceCandidates[0]!.id
    const accepted = api.reviewSessionReducer(initial, { type: 'accept-candidate', candidateId })
    const rejected = api.reviewSessionReducer(accepted, {
      type: 'reject-candidate',
      candidateId,
      reason: 'wrong-field',
    })
    const rows: readonly ReviewCandidateRow[] = api.projectReviewWorkspace(
      snapshot,
      api.materializeReviewSession(snapshot, initial),
    ).rows
    const samples = Array.from({ length: 5 }, () => {
      const filterStart = performance.now()
      const filtered = api.filterAndSortReviewCandidates(rows, {
        filters: { ...initial.filters, query: 'benchmark' },
        sort: 'source-endpoint',
      })
      const filterMs = performance.now() - filterStart
      const acceptStart = performance.now()
      const acceptResult = api.materializeReviewSession(snapshot, accepted)
      const acceptMs = performance.now() - acceptStart
      const rejectStart = performance.now()
      const rejectResult = api.materializeReviewSession(snapshot, rejected)
      const rejectMs = performance.now() - rejectStart
      return {
        filterMs,
        acceptMs,
        rejectMs,
        filteredCount: filtered.length,
        acceptedEdges: acceptResult.result.graph.edges.length,
        rejectedEdges: rejectResult.result.graph.edges.length,
        acceptedAction: acceptResult.draftDecisions[0]!.action,
        rejectedAction: rejectResult.draftDecisions[1]!.action,
      }
    })
    return { samples, baselineUnchanged: baseline === JSON.stringify(snapshot) }
  }, fixture!)
  expect(measurements.baselineUnchanged).toBe(true)
  for (const sample of measurements.samples) {
    expect(sample.filteredCount).toBe(1_000)
    expect(sample.acceptedEdges).toBe(1)
    expect(sample.rejectedEdges).toBe(0)
    expect(sample.acceptedAction).toBe('accept')
    expect(sample.rejectedAction).toBe('reject')
    expect(sample.filterMs).toBeLessThan(100)
    expect(sample.acceptMs).toBeLessThan(250)
    expect(sample.rejectMs).toBeLessThan(250)
  }
  await testInfo.attach('chromium-review-core-budgets', {
    body: JSON.stringify(measurements, null, 2),
    contentType: 'application/json',
  })
})
