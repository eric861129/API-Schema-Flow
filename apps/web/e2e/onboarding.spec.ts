import { readFile } from 'node:fs/promises'
import { expect } from '@playwright/test'
import { test } from './review-helpers'

test('shows a real first-use choice before opening the labeled sample', async ({ page }) => {
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'Understand an API through a task' }),
  ).toBeVisible()
  await expect(page.getByText(/--project/)).toBeVisible()
  await page.getByRole('combobox', { name: 'Interface language' }).selectOption('zh-TW')
  await expect(page.getByRole('heading', { name: '從任務看懂 API' })).toBeVisible()
  await page.getByRole('combobox', { name: '介面語言' }).selectOption('en')
  await page.getByRole('button', { name: 'Explore sample workspace' }).click()
  await expect(page.getByRole('main', { name: 'API Schema Flow workspace' })).toBeVisible()
  await expect(page.getByText('Sample', { exact: true })).toBeVisible()
  await expect(page).toHaveURL('/?sample=1')
  await page.reload()
  await expect(page.getByRole('main', { name: 'API Schema Flow workspace' })).toBeVisible()
})

test('previews a saved project on a fresh local workspace before applying it', async ({
  page,
  browser,
}) => {
  await page.goto('/?sample=1')
  const snapshot = await page.evaluate(async () =>
    (await fetch('/fixtures/reservation-workspace.json')).json(),
  )
  await page.getByRole('button', { name: 'Inference Review', exact: true }).click()
  await page
    .getByRole('listbox', { name: /Inference candidates/ })
    .getByRole('option')
    .first()
    .click()
  await page.getByRole('button', { name: 'Accept', exact: true }).click()
  await page.getByRole('button', { name: 'Project', exact: true }).click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save Project' }).click()
  const projectText = await readFile((await (await download).path())!, 'utf8')

  const fresh = await browser.newContext({ baseURL: 'http://127.0.0.1:4173' })
  try {
    await fresh.addInitScript(() => localStorage.setItem('api-schema-flow.locale', 'en'))
    const reopened = await fresh.newPage()
    let projectAuthorization = ''
    await reopened.route('**/api/workspace', (route) => route.fulfill({ json: snapshot }))
    await reopened.route('**/api/project', (route) => {
      projectAuthorization = route.request().headers().authorization ?? ''
      return route.fulfill({ body: projectText, contentType: 'application/json' })
    })
    await reopened.goto('/#workspace=local-token&project=1')
    await expect(reopened.getByRole('dialog', { name: 'Project Save and Load' })).toBeVisible()
    await expect(reopened.getByRole('region', { name: 'Project load preview' })).toContainText(
      '1 review changes',
    )
    expect(projectAuthorization).toBe('Bearer local-token')
    await reopened.getByRole('button', { name: 'Apply project' }).click()
    await reopened.getByRole('button', { name: 'Inference Review', exact: true }).click()
    await expect(reopened.getByText('3 accepted relationships', { exact: true })).toBeVisible()
  } finally {
    await fresh.close()
  }
})
