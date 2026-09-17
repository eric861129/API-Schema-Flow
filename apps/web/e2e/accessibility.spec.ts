import AxeBuilder from '@axe-core/playwright'
import { expect } from '@playwright/test'
import { test } from './review-helpers'

test('has no serious or critical accessibility violations in the canonical workspace', async ({
  page,
}) => {
  await page.goto('/?sample=1')
  await expect(page.getByText('Reservation System')).toBeVisible()
  const results = await new AxeBuilder({ page }).analyze()
  const blocking = results.violations.filter((item) =>
    ['serious', 'critical'].includes(item.impact ?? ''),
  )
  expect(blocking).toEqual([])
})
