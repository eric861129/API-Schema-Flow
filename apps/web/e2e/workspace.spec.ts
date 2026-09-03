import { expect, test } from '@playwright/test'

test('explores the Reservation topology and equivalent outline', async ({ page }) => {
  await page.goto('/')
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
})

test('keeps primary regions usable at the minimum desktop viewport', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await page.goto('/')
  await expect(page.getByLabel('Accepted API topology')).toBeVisible()
  const canvas = await page.getByLabel('Accepted API topology').boundingBox()
  expect(canvas?.width ?? 0).toBeGreaterThan(600)
  expect(canvas?.height ?? 0).toBeGreaterThan(500)
})
