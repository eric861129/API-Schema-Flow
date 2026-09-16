import { expect, type Locator, type Page } from '@playwright/test'
import { expectGraph, loginCandidate, openReview, test } from './review-helpers'

async function expectUnclipped(page: Page, locator: Locator) {
  await expect(locator).toBeInViewport({ ratio: 1 })
  const usable = await locator.evaluate((element) => {
    const box = element.getBoundingClientRect()
    for (const [x, y] of [
      [box.left + box.width / 2, box.top + 2],
      [box.left + box.width / 2, box.bottom - 2],
      [box.left + box.width / 2, box.top + box.height / 2],
    ]) {
      const hit = document.elementFromPoint(x!, y!)
      if (!hit || !element.contains(hit)) return false
    }
    return true
  })
  expect(usable, '主要操作不得被容器裁切或其他面板遮住').toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
}

test('keeps review panels and actions usable and captures four stable states', async ({
  reviewPage: page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await openReview(page)
  await loginCandidate(page).click()
  await page.getByRole('button', { name: 'Hide evidence' }).click()
  const capture = async (name: string) => {
    await page.evaluate(() => document.fonts.ready)
    await expect(page).toHaveScreenshot(`${name}.png`, {
      animations: 'disabled',
      caret: 'hide',
    })
    const path = testInfo.outputPath(`${name}.png`)
    await page.screenshot({ path, animations: 'disabled', caret: 'hide' })
    await testInfo.attach(name, { path, contentType: 'image/png' })
  }
  const panels = [
    'Candidate List',
    'Mapping or Topology Preview',
    'Evidence Inspector',
    'Review Actions',
    'Review Summary',
    'Review status',
  ]
  const boxes = []
  for (const name of panels) {
    const panel = page.getByRole('region', { name, exact: true })
    await expect(panel).toBeInViewport({ ratio: 1 })
    boxes.push((await panel.boundingBox())!)
  }
  for (let left = 0; left < boxes.length; left += 1) {
    for (let right = left + 1; right < boxes.length; right += 1) {
      const a = boxes[left]!
      const b = boxes[right]!
      expect(
        a.x + a.width <= b.x ||
          b.x + b.width <= a.x ||
          a.y + a.height <= b.y ||
          b.y + b.height <= a.y,
        `${panels[left]} 與 ${panels[right]} 不得重疊`,
      ).toBe(true)
    }
  }
  await expectUnclipped(page, page.getByRole('button', { name: 'Accept', exact: true }))
  await expectUnclipped(page, page.getByRole('button', { name: 'Reject', exact: true }))
  await capture('review-candidate')
  await page.getByRole('button', { name: 'Show evidence' }).click()
  await expectUnclipped(page, page.getByRole('button', { name: 'Close evidence' }))
  await capture('review-evidence')
  await page.getByRole('button', { name: 'Reject', exact: true }).click()
  await expectUnclipped(page, page.getByRole('button', { name: 'Confirm rejection' }))
  await capture('review-reject')
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.getByRole('button', { name: 'Accept', exact: true }).click()
  await page.getByRole('button', { name: 'Topology preview' }).click()
  await expectGraph(page, 1)
  await expectUnclipped(page, page.getByRole('button', { name: 'Reject', exact: true }))
  const canvas = page.getByRole('region', { name: 'Draft review preview — not saved' })
  expect((await canvas.boundingBox())!.height).toBeGreaterThanOrEqual(100)
  await expectUnclipped(page, page.getByRole('button', { name: 'Undo latest change' }))
  await capture('review-topology-preview')
})
