import AxeBuilder from '@axe-core/playwright'
import { expect } from '@playwright/test'
import { expectGraph, loginCandidate, openReview, test } from './review-helpers'

test('has no serious or critical axe violations in each interactive review state', async ({
  reviewPage: page,
}) => {
  const check = async (state: string) => {
    const results = await new AxeBuilder({ page }).analyze()
    expect(
      results.violations.filter(({ impact }) => ['serious', 'critical'].includes(impact ?? '')),
      state,
    ).toEqual([])
  }
  await openReview(page)
  await loginCandidate(page).click()
  await page.getByRole('button', { name: 'Hide evidence' }).click()
  await expect(page.getByRole('table', { name: 'Review candidate summary' })).toBeVisible()
  await check('候選清單、映射預覽與摘要')
  await page.getByRole('button', { name: 'Show evidence' }).click()
  await check('證據面板')
  await page.getByRole('button', { name: 'Reject', exact: true }).click()
  await check('拒絕對話框')
  await page.getByRole('button', { name: 'Confirm rejection' }).click()
  await check('拒絕原因驗證錯誤')
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.getByRole('button', { name: 'Accept', exact: true }).click()
  await page.getByRole('button', { name: 'Topology preview' }).click()
  await expectGraph(page, 1)
  await check('接受後的拓樸預覽')
})
