import { readFile } from 'node:fs/promises'
import { expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { loginCandidate, openReview, test } from './review-helpers'

async function saveProject(page: Page) {
  await page.getByRole('button', { name: 'Project', exact: true }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save Project', exact: true }).click()
  const text = await readFile((await (await download).path())!, 'utf8')
  await page.getByRole('button', { name: 'Close project' }).click()
  return text
}
async function loadProject(page: Page, text: string) {
  await page.getByRole('button', { name: 'Project', exact: true }).click()
  await page.getByLabel('Project file', { exact: true }).setInputFiles({
    name: 'project.json',
    mimeType: 'application/json',
    buffer: Buffer.from(text),
  })
}
async function saved(page: Page) {
  await page.getByRole('button', { name: 'Project', exact: true }).click()
  await expect(page.getByRole('status', { name: 'Project storage status' })).toHaveText(
    'Saved locally',
  )
  await page.getByRole('button', { name: 'Close project' }).click()
}

test('saves dragged nodes and viewport, restores reload and round-trips review decisions', async ({
  reviewPage: page,
}) => {
  const canvas = page.getByRole('region', { name: 'Accepted API topology' })
  const node = canvas.locator('.react-flow__node').first()
  await expect(node).toBeVisible()
  const box = (await node.boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + 25)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 70, box.y + 65, { steps: 10 })
  await page.mouse.up()
  await canvas.getByRole('button', { name: 'Zoom Out', exact: true }).click()
  await saved(page)
  const exported = JSON.parse(await saveProject(page))
  expect(exported.layout.topology.positions.length).toBeGreaterThan(0)
  expect(exported.layout.topology.viewport.zoom).toBeGreaterThan(0.3)
  await page.getByRole('button', { name: 'Horizontal', exact: true }).click()
  expect(JSON.parse(await saveProject(page)).layout).toEqual(exported.layout)
  const beforeTransform = await node.getAttribute('style')
  await page.reload()
  await expect(canvas.locator('.react-flow__node').first()).toHaveAttribute(
    'style',
    beforeTransform!,
  )
  expect(JSON.parse(await saveProject(page)).layout).toEqual(exported.layout)
  await openReview(page)
  await loginCandidate(page).click()
  await page.getByRole('button', { name: 'Accept', exact: true }).click()
  await saved(page)
  const reviewed = await saveProject(page)
  await page.getByRole('button', { name: 'Undo latest change' }).click()
  await loadProject(page, reviewed)
  await expect(page.getByRole('region', { name: 'Project load preview' })).toBeVisible()
  const axe = await new AxeBuilder({ page }).analyze()
  expect(axe.violations.filter((v) => ['critical', 'serious'].includes(v.impact ?? ''))).toEqual([])
  await page.getByRole('button', { name: 'Cancel load' }).click()
  await page.getByRole('button', { name: 'Close project' }).click()
  await expect(loginCandidate(page)).toHaveAttribute('data-state', 'pending')
  await loadProject(page, reviewed)
  await page.getByRole('button', { name: 'Apply project' }).click()
  await page.getByRole('combobox', { name: 'Review state' }).selectOption('all')
  await expect(loginCandidate(page)).toHaveAttribute('data-state', 'accepted')
  await saved(page)
  expect(await saveProject(page)).toBe(reviewed)
  await page.reload()
  expect(await saveProject(page)).toBe(reviewed)
})

test('loads both layouts atomically, resets layout without changing decisions, and rejects bad sources', async ({
  reviewPage: page,
}) => {
  const original = JSON.parse(await saveProject(page))
  const snapshot = await page.evaluate(async () =>
    (await fetch('/fixtures/reservation-workspace.json')).json(),
  )
  const nodeId = snapshot.declaredGraph.nodes[0].id
  const imported = {
    ...original,
    layout: {
      direction: 'down',
      topology: {
        positions: [{ id: nodeId, x: 90, y: 170 }],
        viewport: { x: 25, y: 30, zoom: 0.8 },
      },
      review: {
        positions: [{ id: nodeId, x: 130, y: 220 }],
        viewport: { x: 12, y: 18, zoom: 0.6 },
      },
    },
  }
  await loadProject(page, JSON.stringify(imported))
  await page.getByRole('button', { name: 'Apply project' }).click()
  await expect(page.getByRole('button', { name: 'Vertical', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(
    page
      .locator('.react-flow__node')
      .filter({ has: page.locator('article') })
      .first(),
  ).toBeVisible()
  const restored = JSON.parse(await saveProject(page))
  expect(restored.layout).toEqual(imported.layout)
  await openReview(page)
  await loginCandidate(page).click()
  await page.getByRole('button', { name: 'Topology preview', exact: true }).click()
  const reviewCanvas = page.getByRole('region', { name: 'Review graph preview' })
  await expect(reviewCanvas.locator('.react-flow__viewport')).toHaveAttribute(
    'style',
    /scale\(0.6\)/,
  )
  const before = await saveProject(page)
  for (const text of [
    JSON.stringify({ ...imported, schemaVersion: '99' }),
    JSON.stringify({ ...imported, source: { ...imported.source, sourceRevision: 'other' } }),
    JSON.stringify({
      ...imported,
      layout: { ...imported.layout, topology: { positions: [{ id: 'unknown', x: 0, y: 0 }] } },
    }),
  ]) {
    await loadProject(page, text)
    await expect(
      page.getByRole('dialog', { name: 'Project Save and Load' }).getByRole('alert'),
    ).toBeVisible()
    await expect(page.getByRole('button', { name: 'Apply project' })).toHaveCount(0)
    await page.keyboard.press('Escape')
    expect(await saveProject(page)).toBe(before)
  }
  await page.getByRole('button', { name: 'Horizontal', exact: true }).click()
  await expect(reviewCanvas).toBeVisible()
  await page.getByRole('button', { name: 'Vertical', exact: true }).click()
  await expect(reviewCanvas).toBeVisible()
  await expect(async () => {
    const area = (await reviewCanvas.boundingBox())!
    const transform = await reviewCanvas.locator('.react-flow__viewport').getAttribute('style')
    const zoom = Number(transform?.match(/scale\(([^)]+)\)/)?.[1])
    expect(zoom).toBeGreaterThanOrEqual(0.3)
    // 最小縮放下的狹小預覽可平移；其他情況必須以新方向完整 fitView。
    if (zoom <= 0.30001) return
    for (const node of await reviewCanvas.locator('.react-flow__node').all()) {
      const box = (await node.boundingBox())!
      expect(box.x).toBeGreaterThanOrEqual(area.x)
      expect(box.y).toBeGreaterThanOrEqual(area.y)
      expect(box.x + box.width).toBeLessThanOrEqual(area.x + area.width)
      expect(box.y + box.height).toBeLessThanOrEqual(area.y + area.height)
    }
  }).toPass()
  await page.getByRole('button', { name: 'Project', exact: true }).click()
  await page.getByRole('button', { name: 'Reset layout' }).click()
  await page.getByRole('button', { name: 'Close project' }).click()
  const reset = JSON.parse(await saveProject(page))
  expect(reset.layout).toEqual({
    direction: 'right',
    topology: { positions: [] },
    review: { positions: [] },
  })
  expect(reset.review).toEqual(restored.review)
})
