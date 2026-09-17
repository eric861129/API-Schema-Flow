import { expect } from '@playwright/test'
import { test } from './review-helpers'

test('explores the Reservation topology and equivalent outline', async ({ page }) => {
  await page.goto('/?sample=1')
  await expect(page.getByText('Reservation System')).toBeVisible()
  await page.getByPlaceholder('Search path or operation ID').fill('reservations')
  await expect(page.getByText('2 visible')).toBeVisible()
  await page
    .getByRole('button', { name: /POST \/reservations/i })
    .first()
    .click()
  await expect(page.getByRole('complementary', { name: 'Endpoint inspector' })).toContainText(
    'createReservation',
  )
  await page.getByRole('button', { name: /^Outgoing response-body /i }).click()
  await expect(page.getByRole('complementary', { name: 'Relationship inspector' })).toContainText(
    'Accepted',
  )
  await page.getByRole('button', { name: /Outline/i }).click()
  await expect(page.getByRole('table', { name: 'Accepted data mappings' })).toBeVisible()
  const outline = await page.locator('.outline-view').boundingBox()
  const firstOperation = await page
    .getByRole('table', { name: 'API operations' })
    .locator('tbody tr')
    .first()
    .boundingBox()
  expect(outline?.height ?? 0).toBeGreaterThan(500)
  expect(firstOperation?.y ?? 0).toBeGreaterThan(outline?.y ?? 0)
  expect((firstOperation?.y ?? 0) + (firstOperation?.height ?? 0)).toBeLessThan(
    (outline?.y ?? 0) + (outline?.height ?? 0),
  )
})

test('keeps primary regions usable at the minimum desktop viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto('/?sample=1')
  await expect(page.getByLabel('Accepted API topology')).toBeVisible()
  const canvas = await page.getByLabel('Accepted API topology').boundingBox()
  expect(canvas?.width ?? 0).toBeGreaterThan(600)
  expect(canvas?.height ?? 0).toBeGreaterThan(500)
})

test('fits filtered endpoints and keeps the outline in the same visible scope', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto('/?sample=1')
  const canvas = page.getByRole('region', { name: 'Accepted API topology' })
  await expect(canvas.locator('.react-flow__node')).toHaveCount(4)
  await page
    .getByRole('button', { name: /POST \/reservations/i })
    .first()
    .click()
  const bounds = (await canvas.boundingBox())!
  await page.mouse.move(bounds.x + 20, bounds.y + bounds.height - 30)
  await page.mouse.down()
  await page.mouse.move(bounds.x + bounds.width - 20, bounds.y + bounds.height - 30, {
    steps: 10,
  })
  await page.mouse.up()
  const manualViewport = await canvas.locator('.react-flow__viewport').getAttribute('style')
  await page.getByRole('combobox', { name: 'Filter by group' }).selectOption('Reservations')

  await expect(canvas.locator('.react-flow__node')).toHaveCount(2)
  await expect(canvas.locator('.react-flow__edge:not(.candidate-edge)')).toHaveCount(1)
  await expect(
    page.getByRole('complementary', { name: 'API operations' }).locator('.operation-row').filter({
      hasText: 'POST',
    }),
  ).toContainText('0↓ 1↑')
  await expect
    .poll(async () =>
      canvas.evaluate((element) => {
        const viewport = element.getBoundingClientRect()
        return [...element.querySelectorAll('.react-flow__node')].every((node) => {
          const box = node.getBoundingClientRect()
          return (
            box.left >= viewport.left - 1 &&
            box.right <= viewport.right + 1 &&
            box.top >= viewport.top - 1 &&
            box.bottom <= viewport.bottom + 1
          )
        })
      }),
    )
    .toBe(true)

  await page.getByRole('button', { name: /Outline/i }).click()
  const operations = page.getByRole('table', { name: 'API operations' })
  const mappings = page.getByRole('table', { name: 'Accepted data mappings' })
  await expect(operations.locator('tbody tr')).toHaveCount(2)
  await expect(mappings.locator('tbody tr')).toHaveCount(1)
  const create = operations.locator('tbody tr').filter({
    has: page.getByRole('button', { name: '/reservations', exact: true }),
  })
  await expect(create.locator('td').nth(3)).toHaveText('0')
  await expect(create.locator('td').nth(4)).toHaveText('1')

  await page.getByRole('combobox', { name: 'Filter by group' }).selectOption('')
  await page.getByRole('button', { name: 'Topology', exact: true }).click()
  await expect(canvas.locator('.react-flow__node')).toHaveCount(4)
  await expect(canvas.locator('.react-flow__viewport')).toHaveAttribute('style', manualViewport!)
})

test('moves from an API overview to a suggested handoff and focused endpoint data', async ({
  page,
}) => {
  await page.goto('/?sample=1')
  const overview = page.getByRole('region', { name: 'Explore API tasks' })
  await expect(overview).toContainText('Find a data handoff')
  await overview.getByRole('button').first().click()
  await expect(page.getByRole('heading', { name: 'Inference Review' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Review inferred data transfer' })).toBeVisible()

  await page.getByRole('button', { name: 'Topology', exact: true }).click()
  await page.getByRole('button', { name: /Suggestion preview/i }).click()
  await expect(page.locator('.candidate-edge').first()).toBeVisible()
  await page
    .getByRole('button', { name: /POST \/reservations/i })
    .first()
    .click()
  await expect(
    page
      .getByRole('complementary', { name: 'Endpoint inspector' })
      .getByRole('list', { name: 'Schema fields' })
      .first(),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Focus neighbors' }).click()
  await expect(page.getByRole('button', { name: 'Show all' })).toBeVisible()
})

test('reveals a suggested handoff when review filters would otherwise hide it', async ({
  page,
}) => {
  await page.route('**/fixtures/reservation-workspace.json', async (route) => {
    const response = await route.fetch()
    const snapshot = await response.json()
    const handoff = snapshot.inferenceCandidates.find(
      (item: { sourceOperationKey: string; targetOperationKey: string }) =>
        item.sourceOperationKey === 'operation:post:/reservations' &&
        item.targetOperationKey === 'operation:get:/reservations/{id}',
    )
    handoff.band = 'low'
    handoff.confidence = 0.35
    await route.fulfill({ response, json: snapshot })
  })
  await page.goto('/?sample=1')
  await page.getByRole('region', { name: 'Explore API tasks' }).getByRole('button').first().click()
  await expect(page.getByRole('button', { name: 'Low confidence' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(
    page.getByRole('option', { name: /Source POST \/reservations.*GET \/reservations\/\{id\}/ }),
  ).toBeVisible()

  await page.getByRole('combobox', { name: 'Review state' }).selectOption('accepted')
  await page.getByRole('button', { name: 'Topology', exact: true }).click()
  await page.getByRole('region', { name: 'Explore API tasks' }).getByRole('button').first().click()
  await expect(page.getByRole('combobox', { name: 'Review state' })).toHaveValue('pending')
  await expect(
    page.getByRole('option', { name: /Source POST \/reservations.*GET \/reservations\/\{id\}/ }),
  ).toBeVisible()
})
