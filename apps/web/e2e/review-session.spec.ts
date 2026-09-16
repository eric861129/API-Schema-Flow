import { expect } from '@playwright/test'
import { expectGraph, loginCandidate, openReview, tabTo, test } from './review-helpers'

test('reproduces the README journey against the unchanged bundled snapshot', async ({ page }) => {
  await page.goto('/')
  await openReview(page)
  await page.getByRole('combobox', { name: 'Review state' }).selectOption('all')
  await loginCandidate(page).click()
  await expect(loginCandidate(page)).toHaveAttribute('data-state', 'accepted')
  await expect(page.getByRole('button', { name: 'Accept', exact: true })).toBeDisabled()
  await expect(
    page.getByRole('button', {
      name: /^(Edit Mapping|Save decisions|Import Decision Set|Export Decision Set|Run Workflow|Start Mock|Export Arazzo)$/i,
    }),
  ).toHaveCount(0)
  await page.getByRole('button', { name: 'Reject', exact: true }).click()
  await page.getByRole('radio', { name: 'Wrong field' }).check()
  await page.getByRole('button', { name: 'Confirm rejection' }).click()
  await expect(loginCandidate(page)).toHaveAttribute('data-state', 'rejected')
  await page.getByRole('button', { name: 'Topology preview' }).click()
  const summary = page.getByRole('region', { name: 'Draft graph summary' })
  await expect(summary).toContainText('0 inferred accepted')
  await expect(summary).toContainText('1 declared accepted')
  await expect(summary).toContainText('1 manual accepted')
  await loginCandidate(page).click()
  await page.getByRole('button', { name: 'Accept', exact: true }).click()
  await expect(summary).toContainText('1 inferred accepted')
  const canvas = page.getByRole('region', { name: 'Draft review preview — not saved' })
  await expect(canvas.locator('.react-flow__edge')).toHaveCount(3)
  await page.getByRole('button', { name: 'Undo latest change' }).click()
  await expect(summary).toContainText('0 inferred accepted')
  await page.getByRole('button', { name: 'Undo latest change' }).click()
  await expect(loginCandidate(page)).toHaveAttribute('data-state', 'accepted')
  await expect(canvas.locator('.react-flow__edge')).toHaveCount(3)
  await expect(page.getByRole('region', { name: 'Review status', exact: true })).toContainText(
    'No draft changes',
  )
})

test('reviews candidates, updates real topology, undoes changes, and discards drafts on reload', async ({
  reviewPage: page,
}) => {
  await openReview(page)
  await page.getByRole('combobox', { name: 'Review state' }).selectOption('all')
  await loginCandidate(page).click()
  await page.getByRole('button', { name: 'Hide evidence' }).click()
  await page.getByRole('button', { name: 'Show evidence' }).click()
  await expect(
    page.getByRole('complementary', { name: 'Why this mapping was suggested' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Accept', exact: true }).click()
  await expect(loginCandidate(page)).toHaveAttribute('data-state', 'accepted')
  await page.getByRole('button', { name: 'Topology preview' }).click()
  await expectGraph(page, 1)

  const other = page.getByRole('option', { name: /Source GET \/spaces\/available/ })
  await other.click()
  await page.getByRole('button', { name: 'Reject', exact: true }).click()
  await page.getByRole('radio', { name: 'Wrong field' }).check()
  await page.getByRole('button', { name: 'Confirm rejection' }).click()
  await expect(other).toHaveAttribute('data-state', 'rejected')
  await expectGraph(page, 1)
  const undo = page.getByRole('button', { name: 'Undo latest change' })
  await undo.click()
  await expect(other).toHaveAttribute('data-state', 'pending')
  await expect(other).toHaveAttribute('aria-selected', 'true')
  await expectGraph(page, 1)
  await undo.click()
  await expect(loginCandidate(page)).toHaveAttribute('data-state', 'pending')
  await expectGraph(page, 0)
  await expect(undo).toBeDisabled()

  await page.getByRole('button', { name: 'Accept', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Review status', exact: true })).toContainText(
    '1 unsaved review change',
  )
  await page.reload()
  await openReview(page)
  await expect(page.getByRole('region', { name: 'Review status', exact: true })).toContainText(
    'No draft changes',
  )
  await expect(loginCandidate(page)).toHaveAttribute('data-state', 'pending')
  await page.getByRole('button', { name: 'Topology preview' }).click()
  await expectGraph(page, 0)
})

test('completes review using only the keyboard, including dialog focus containment and restoration', async ({
  reviewPage: page,
}) => {
  await tabTo(page, page.getByRole('button', { name: 'Inference Review', exact: true }))
  await page.keyboard.press('Enter')
  await tabTo(page, loginCandidate(page))
  await page.keyboard.press('Enter')
  await expect(loginCandidate(page)).toHaveAttribute('aria-selected', 'true')
  const mapping = page.getByRole('region', { name: 'Review inferred data transfer' })
  await tabTo(page, mapping)
  await page.keyboard.press('PageDown')
  await expect.poll(() => mapping.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
  await tabTo(page, page.getByRole('button', { name: 'Hide evidence' }))
  await page.keyboard.press('Enter')
  await tabTo(page, page.getByRole('button', { name: 'Show evidence' }))
  await page.keyboard.press('Enter')
  await expect(
    page.getByRole('complementary', { name: 'Why this mapping was suggested' }),
  ).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Show evidence' })).toBeFocused()
  await tabTo(page, page.getByRole('button', { name: 'Accept', exact: true }))
  await page.keyboard.press('Enter')
  await expect(page.getByRole('status', { name: 'Review announcement' })).toContainText('Accepted')
  await tabTo(page, page.getByRole('button', { name: 'Reject', exact: true }))
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Reject candidate' })
  await expect(dialog).toBeVisible()
  const firstReason = dialog.getByRole('radio').first()
  await expect(firstReason).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(dialog.getByRole('button', { name: 'Confirm rejection' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(firstReason).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Reject', exact: true })).toBeFocused()
  await page.keyboard.press('Enter')
  await page.keyboard.press('Space')
  await tabTo(page, dialog.getByRole('button', { name: 'Confirm rejection' }))
  await page.keyboard.press('Enter')
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('status', { name: 'Review announcement' })).toContainText('Rejected')
  await tabTo(page, page.getByRole('button', { name: 'Undo latest change' }))
  await page.keyboard.press('Enter')
  await expect(page.getByRole('status', { name: 'Review announcement' })).toContainText(
    'is pending',
  )
  await tabTo(page, page.getByRole('button', { name: 'Topology preview' }))
  await page.keyboard.press('Enter')
  await expectGraph(page, 1)
})

test('requires a structured rejection reason and a nonblank Other note', async ({
  reviewPage: page,
}) => {
  await openReview(page)
  await loginCandidate(page).click()
  await page.getByRole('button', { name: 'Reject', exact: true }).click()
  const confirm = page.getByRole('button', { name: 'Confirm rejection' })
  await confirm.click()
  await expect(page.getByRole('alert')).toHaveText('Choose a reject reason.')
  await page.getByRole('radio', { name: 'Other', exact: true }).check()
  await page.getByRole('textbox', { name: 'Note (required for Other)' }).fill('   ')
  await confirm.click()
  await expect(page.getByRole('alert')).toBeVisible()
  await page
    .getByRole('textbox', { name: 'Note (required for Other)' })
    .fill('此流程不使用這個欄位')
  await confirm.click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.getByRole('status', { name: 'Review announcement' })).toContainText('Rejected')
})
