import { readFile } from 'node:fs/promises'
import { expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { loginCandidate, openReview, test } from './review-helpers'

async function saved(page: Page) {
  await expect(page.getByRole('status', { name: 'Local storage status' })).toHaveText(
    'Saved locally',
  )
}
async function exportFile(page: Page) {
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export Decision Set' }).click()
  return readFile((await (await download).path())!, 'utf8')
}
async function upload(page: Page, text: string) {
  await page.getByLabel('Decision Set file').setInputFiles({
    name: 'decisions.json',
    mimeType: 'application/json',
    buffer: Buffer.from(text),
  })
}

test('clears healthy storage, keeps autosave disabled after reload and blocks an older tab', async ({
  reviewPage: page,
  context,
}) => {
  await openReview(page)
  const snapshot = await page.evaluate(async () =>
    (await fetch('/fixtures/reservation-workspace.json')).json(),
  )
  const other = await context.newPage()
  await other.route('**/fixtures/reservation-workspace.json', (route) =>
    route.fulfill({ json: snapshot }),
  )
  await other.goto('/')
  await openReview(other)
  await loginCandidate(page).click()
  await page.getByRole('button', { name: 'Accept', exact: true }).click()
  await saved(page)
  const exported = await exportFile(page)
  page.once('dialog', (dialog) => dialog.dismiss())
  await page.getByRole('button', { name: 'Clear saved data', exact: true }).click()
  await saved(page)
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Clear saved data', exact: true }).click()
  await expect(page.getByRole('status', { name: 'Local storage status' })).toContainText(
    'Autosave disabled',
  )
  expect(await exportFile(page)).toBe(exported)
  const stored = await page.evaluate(
    () =>
      new Promise<unknown>((resolve) => {
        const request = indexedDB.open('api-schema-flow-review', 1)
        request.onsuccess = () => {
          const db = request.result
          const tx = db.transaction('sessions')
          const all = tx.objectStore('sessions').getAll()
          tx.oncomplete = () => {
            resolve(all.result)
            db.close()
          }
        }
      }),
  )
  expect(stored).toEqual([
    expect.objectContaining({
      value: { version: 1, schemaVersion: '1.0', toolVersion: expect.any(String), autosave: false },
    }),
  ])
  await loginCandidate(other).click()
  await other.getByRole('button', { name: 'Accept', exact: true }).click()
  await expect(other.getByRole('alert', { name: 'Local storage status' })).toContainText(
    'Another tab',
  )
  page.once('dialog', (dialog) => dialog.accept())
  await page.reload()
  await openReview(page)
  await expect(loginCandidate(page)).toHaveAttribute('data-state', 'pending')
  await expect(page.getByRole('status', { name: 'Local storage status' })).toContainText(
    'Autosave disabled',
  )
  await page.getByRole('button', { name: 'Enable autosave' }).click()
  await loginCandidate(page).click()
  await page.getByRole('button', { name: 'Accept', exact: true }).click()
  await saved(page)
  await page.reload()
  await openReview(page)
  await page.getByRole('combobox', { name: 'Review state' }).selectOption('all')
  await expect(loginCandidate(page)).toHaveAttribute('data-state', 'accepted')
  await other.close()
})

test('isolates source revisions and restores the original revision when reopened', async ({
  reviewPage: page,
}) => {
  await openReview(page)
  const original = await page.evaluate(async () =>
    (await fetch('/fixtures/reservation-workspace.json')).json(),
  )
  await loginCandidate(page).click()
  await page.getByRole('button', { name: 'Accept', exact: true }).click()
  await saved(page)
  await page.route('**/fixtures/reservation-workspace.json', (route) =>
    route.fulfill({
      json: {
        ...original,
        reviewContext: { ...original.reviewContext, sourceRevision: 'different-source-revision' },
      },
    }),
  )
  await page.reload()
  await openReview(page)
  await expect(loginCandidate(page)).toHaveAttribute('data-state', 'pending')
  await page.route('**/fixtures/reservation-workspace.json', (route) =>
    route.fulfill({ json: original }),
  )
  await page.reload()
  await openReview(page)
  await page.getByRole('combobox', { name: 'Review state' }).selectOption('all')
  await expect(loginCandidate(page)).toHaveAttribute('data-state', 'accepted')
})

test('reports failed writes without claiming decisions are saved and still exports them', async ({
  reviewPage: page,
}) => {
  await openReview(page)
  await page.evaluate(() => {
    IDBObjectStore.prototype.put = () => {
      throw new DOMException('Test quota exhausted', 'QuotaExceededError')
    }
  })
  await loginCandidate(page).click()
  await page.getByRole('button', { name: 'Accept', exact: true }).click()
  await expect(page.getByRole('alert', { name: 'Local storage status' })).toContainText(
    'Local save failed',
  )
  const exported = JSON.parse(await exportFile(page))
  expect(exported.decisions.some((item: { action: string }) => item.action === 'accept')).toBe(true)
})

test('round-trips decisions through a previewed import and reload, without duplicate decisions', async ({
  reviewPage: page,
}) => {
  await openReview(page)
  await page.getByRole('combobox', { name: 'Review state' }).selectOption('all')
  await loginCandidate(page).click()
  await page.getByRole('button', { name: 'Accept', exact: true }).click()
  await saved(page)
  const exported = await exportFile(page)
  await page.getByRole('button', { name: 'Undo latest change' }).click()
  await saved(page)
  await upload(page, exported)
  const dialog = page.getByRole('dialog', { name: 'Import Decision Set preview' })
  await expect(dialog).toContainText('applied: 1')
  const axe = await new AxeBuilder({ page }).analyze()
  expect(
    axe.violations.filter((item) => ['critical', 'serious'].includes(item.impact ?? '')),
  ).toEqual([])
  await expect(page.getByRole('button', { name: 'Cancel import' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Apply import' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(page.getByRole('button', { name: 'Cancel import' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(loginCandidate(page)).toHaveAttribute('data-state', 'pending')
  await upload(page, exported)
  await page.getByRole('button', { name: 'Apply import' }).click()
  await expect(loginCandidate(page)).toHaveAttribute('data-state', 'accepted')
  await saved(page)
  await page.reload()
  await openReview(page)
  await page.getByRole('combobox', { name: 'Review state' }).selectOption('all')
  await expect(loginCandidate(page)).toHaveAttribute('data-state', 'accepted')
  expect(await exportFile(page)).toBe(exported)
  await upload(page, exported)
  await page.getByRole('button', { name: 'Apply import' }).click()
  expect(await exportFile(page)).toBe(exported)
})

test('rejects malformed imports and keeps existing decisions', async ({ reviewPage: page }) => {
  await openReview(page)
  const before = await exportFile(page)
  await upload(page, '{"schemaVersion":"999"}')
  await expect(page.getByRole('alert')).toContainText('schema version 1.0')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(await exportFile(page)).toBe(before)
})

for (const generation of [1, 'broken', Number.NaN, -1, 1.5, { broken: true }, ['broken']]) {
  test(`recovers stored version and generation ${JSON.stringify(generation)} only after explicit reset`, async ({
    reviewPage: page,
  }) => {
    await openReview(page)
    await loginCandidate(page).click()
    await page.getByRole('button', { name: 'Accept', exact: true }).click()
    await saved(page)
    await page.evaluate(async (generation) => {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.open('api-schema-flow-review', 1)
        request.onsuccess = () => {
          const db = request.result
          const tx = db.transaction('sessions', 'readwrite')
          const store = tx.objectStore('sessions')
          const keys = store.getAllKeys()
          keys.onsuccess = () =>
            store.put(
              { generation, value: { version: 999, preserved: 'original' } },
              keys.result[0]!,
            )
          tx.oncomplete = () => {
            db.close()
            resolve()
          }
          tx.onabort = () => reject(tx.error)
        }
      })
    }, generation)
    await page.reload()
    await openReview(page)
    await expect(page.getByRole('alert', { name: 'Local storage status' })).toContainText(
      generation === 1 ? 'preserved' : 'damaged',
    )
    const backup = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Back up stored data' }).click()
    expect(await readFile((await (await backup).path())!, 'utf8')).toContain('original')
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'Reset saved data' }).click()
    await saved(page)
    await expect(loginCandidate(page)).toHaveAttribute('data-state', 'pending')
  })
}

test('does not overwrite another tab and offers reload after a generation conflict', async ({
  reviewPage: page,
  context,
}) => {
  await openReview(page)
  const snapshot = await page.evaluate(async () =>
    (await fetch('/fixtures/reservation-workspace.json')).json(),
  )
  const other = await context.newPage()
  await other.route('**/fixtures/reservation-workspace.json', (route) =>
    route.fulfill({ json: snapshot }),
  )
  await other.goto('/')
  await openReview(other)
  await loginCandidate(page).click()
  await page.getByRole('button', { name: 'Accept', exact: true }).click()
  await saved(page)
  await loginCandidate(other).click()
  await other.getByRole('button', { name: 'Reject', exact: true }).click()
  await other.getByRole('radio', { name: 'Wrong field' }).check()
  await other.getByRole('button', { name: 'Confirm rejection' }).click()
  await expect(other.getByRole('alert', { name: 'Local storage status' })).toContainText(
    'Another tab',
  )
  await other.getByRole('button', { name: 'Reload saved data' }).click()
  await saved(other)
  await other.getByRole('combobox', { name: 'Review state' }).selectOption('all')
  await expect(loginCandidate(other)).toHaveAttribute('data-state', 'accepted')
  await other.close()
})
