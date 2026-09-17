import { readFile } from 'node:fs/promises'
import AxeBuilder from '@axe-core/playwright'
import { expect, test as base, type Page } from '@playwright/test'
import { loginCandidate, openReview, test } from './review-helpers'

async function exportDecisions(page: Page, label: string) {
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: label, exact: true }).click()
  return readFile((await (await downloaded).path())!, 'utf8')
}

base(
  'defaults to Traditional Chinese and remembers the selected interface language',
  async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-TW')
    const language = page.getByRole('combobox', { name: '介面語言' })
    await expect(language).toHaveValue('zh-TW')
    await expect(page.getByRole('button', { name: '推論審查', exact: true })).toBeVisible()
    await language.selectOption('en')
    await expect(page.locator('html')).toHaveAttribute('lang', 'en')
    await page.reload()
    await expect(page.getByRole('combobox', { name: 'Interface language' })).toHaveValue('en')
    await page.getByRole('combobox', { name: 'Interface language' }).selectOption('zh-TW')
    await page.reload()
    await expect(page.getByRole('combobox', { name: '介面語言' })).toHaveValue('zh-TW')
    await expect(page.getByRole('button', { name: '推論審查', exact: true })).toBeVisible()
    await page.getByRole('button', { name: '推論審查', exact: true }).click()
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  },
)

test('switches languages without resetting selection, decisions, or exported data', async ({
  reviewPage: page,
}) => {
  await openReview(page)
  await page.getByRole('button', { name: 'Vertical', exact: true }).click()
  await page.getByRole('combobox', { name: 'Review state' }).selectOption('all')
  await loginCandidate(page).click()
  await page.getByRole('button', { name: 'Accept', exact: true }).click()
  await expect(page.getByRole('status', { name: 'Local storage status' })).toHaveText(
    'Saved locally',
  )
  const englishExport = await exportDecisions(page, 'Export Decision Set')
  await loginCandidate(page).click()
  await expect(loginCandidate(page)).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('combobox', { name: 'Interface language' }).selectOption('zh-TW')
  const candidate = page.getByRole('option').filter({ hasText: '/auth/login' })
  await expect(candidate).toHaveAttribute('aria-selected', 'true')
  await expect(candidate).toHaveAttribute('data-state', 'accepted')
  await expect(page.getByRole('button', { name: '垂直', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByRole('combobox', { name: '審查狀態' })).toHaveValue('all')
  await expect(page.getByRole('status', { name: '本機儲存狀態' })).toHaveText('已保存至本機')
  expect(await exportDecisions(page, '匯出決策集')).toBe(englishExport)
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([])
  await page.reload()
  await page.getByRole('button', { name: '推論審查', exact: true }).click()
  await page.getByRole('combobox', { name: '審查狀態' }).selectOption('all')
  await expect(page.getByRole('button', { name: '垂直', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(candidate).toHaveAttribute('data-state', 'accepted')
  expect(await exportDecisions(page, '匯出決策集')).toBe(englishExport)
})
