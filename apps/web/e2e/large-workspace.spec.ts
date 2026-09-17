import AxeBuilder from '@axe-core/playwright'
import { expect } from '@playwright/test'
import type { WorkspaceSnapshot } from '../src/data/types'
import { test } from './review-helpers'

test('keeps 1,311 endpoints browsable by group and restores scope after focus', async ({
  page,
}, testInfo) => {
  const browserIssues: string[] = []
  page.on('pageerror', (error) => browserIssues.push(error.message))
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) browserIssues.push(message.text())
  })
  await page.route('**/fixtures/reservation-workspace.json', async (route) => {
    const response = await route.fetch()
    const original: WorkspaceSnapshot = await response.json()
    const seedOperation = original.apiDocument.operations[0]!
    const seedNode = original.declaredGraph.nodes[0]!
    const operations = Array.from({ length: 1_311 }, (_, index) => {
      const group = String(Math.floor(index / 50) + 1).padStart(2, '0')
      const path = `/group-${group}/items/${index}`
      return {
        ...seedOperation,
        id: `operation:${seedOperation.method}:${path}`,
        path,
        operationId: `groupItem${index}`,
        tags: [`Group ${group}`],
      }
    })
    const nodes = operations.map((operation) => ({
      ...seedNode,
      id: `endpoint:${operation.id}`,
      operationKey: operation.id,
      path: operation.path,
      method: operation.method,
    }))
    const graph = { ...original.declaredGraph, nodes, edges: [] }
    await route.fulfill({
      response,
      json: {
        ...original,
        apiDocument: { ...original.apiDocument, operations },
        declaredGraph: graph,
        acceptedGraph: graph,
        inferenceCandidates: [],
        reviewDecisionSet: { schemaVersion: '1.0', revision: 0, decisions: [], manualEdges: [] },
        reviewOutcomes: [],
      },
    })
  })
  const started = Date.now()
  await page.goto('/?sample=1')
  await expect(page.getByRole('button', { name: 'Outline', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  )
  const panel = page.getByRole('complementary', { name: 'API operations' })
  const outline = page.getByRole('table', { name: 'API operations' })
  await expect(panel.locator('.operation-row')).toHaveCount(80)
  await expect(outline.locator('tbody tr')).toHaveCount(100)
  const initialRenderMs = Date.now() - started
  await testInfo.attach('large-outline', {
    body: await page.screenshot(),
    contentType: 'image/png',
  })
  const accessibility = await new AxeBuilder({ page }).analyze()
  expect(
    accessibility.violations.filter((violation) =>
      ['serious', 'critical'].includes(violation.impact ?? ''),
    ),
  ).toEqual([])
  const groups = panel.getByRole('region', { name: 'Browse API groups' })
  await expect(groups.locator('.operation-groups__items button')).toHaveCount(6)
  await groups.getByRole('button', { name: 'Show more groups' }).click()
  await expect(groups.locator('.operation-groups__items button')).toHaveCount(18)
  await expect(panel.getByText('Showing 80 of 1311 endpoints')).toBeVisible()
  await panel.getByRole('button', { name: 'Load more endpoints' }).click()
  await expect(panel.locator('.operation-row')).toHaveCount(160)
  await page.getByRole('button', { name: 'Load more outline endpoints' }).click()
  await expect(outline.locator('tbody tr')).toHaveCount(200)

  const groupStarted = Date.now()
  await groups.getByRole('button', { name: /Group 01.*50/ }).click()
  const canvas = page.getByRole('region', { name: 'Accepted API topology' })
  await expect(canvas.locator('.react-flow__node')).toHaveCount(50)
  const groupToCanvasMs = Date.now() - groupStarted
  await testInfo.attach('focused-group', {
    body: await page.screenshot(),
    contentType: 'image/png',
  })
  await expect(panel.locator('.operation-row')).toHaveCount(50)
  await panel.locator('.operation-row').first().click()
  await panel.getByRole('button', { name: 'Focus selected endpoint' }).click()
  await expect(canvas.locator('.react-flow__node')).toHaveCount(1)
  await expect(panel.locator('.operation-row')).toHaveCount(1)
  await panel.getByRole('button', { name: 'Clear focus' }).click()
  await expect(canvas.locator('.react-flow__node')).toHaveCount(50)
  await expect(panel.getByRole('combobox', { name: 'Filter by group' })).toHaveValue('Group 01')
  await groups.getByRole('button', { name: /Group 01.*50/ }).click()
  await expect(page.getByRole('button', { name: 'Outline', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  )
  const searchStarted = Date.now()
  await panel.getByPlaceholder('Search path or operation ID').fill('/group-05/items/205')
  await expect(panel.locator('.operation-row')).toHaveCount(1)
  await expect(outline.locator('tbody tr')).toHaveCount(1)
  const searchToResultsMs = Date.now() - searchStarted
  await testInfo.attach('large-workspace-load', {
    body: JSON.stringify({ endpoints: 1_311, initialRenderMs, groupToCanvasMs, searchToResultsMs }),
    contentType: 'application/json',
  })
  expect(browserIssues).toEqual([])
})
