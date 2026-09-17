import { expect, test as base, type Locator, type Page } from '@playwright/test'

// 沿用正式快照，只移除既有決策，讓瀏覽器走完待審核流程。
export const test = base.extend<{ reviewPage: Page }>({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      if (!localStorage.getItem('api-schema-flow.locale'))
        localStorage.setItem('api-schema-flow.locale', 'en')
    })
    await use(page)
  },
  reviewPage: async ({ page }, use) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      if (['error', 'warning'].includes(message.type())) errors.push(message.text())
    })
    await page.route('**/fixtures/reservation-workspace.json', async (route) => {
      const response = await route.fetch()
      const snapshot = await response.json()
      await route.fulfill({
        response,
        json: {
          ...snapshot,
          reviewDecisionSet: {
            ...snapshot.reviewDecisionSet,
            revision: 0,
            decisions: [],
            manualEdges: [],
          },
          acceptedGraph: snapshot.declaredGraph,
          reviewOutcomes: [],
        },
      })
    })
    await page.goto('/?sample=1')
    await expect(page).toHaveTitle('API Schema Flow')
    await expect(page).toHaveURL('/?sample=1')
    await expect(page.getByText('Reservation System')).toBeVisible()
    await use(page)
    await expect(page.locator('vite-error-overlay')).toHaveCount(0)
    expect(errors, '瀏覽器不得出現執行錯誤或警告').toEqual([])
  },
})

export const loginCandidate = (page: Page) =>
  page.getByRole('option', { name: /Source POST \/auth\/login/ })

export async function openReview(page: Page) {
  await page.getByRole('button', { name: 'Inference Review', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Inference Review workspace' })).toBeVisible()
}

// 只以實際 Tab 操作尋找控制項，避免程式化 focus 掩蓋鍵盤不可達問題。
export async function tabTo(page: Page, target: Locator) {
  for (let step = 0; step < 80; step += 1) {
    if (await target.evaluate((element) => element === document.activeElement)) return
    await page.keyboard.press('Tab')
  }
  await expect(target, '控制項必須能以 Tab 到達').toBeFocused()
}

export async function expectGraph(page: Page, inferred: number) {
  const summary = page.getByRole('region', { name: 'Draft graph summary' })
  await expect(summary).toContainText('1 declared accepted')
  await expect(summary).toContainText(`${inferred} inferred accepted`)
  const canvas = page.getByRole('region', { name: 'Review graph preview' })
  await expect(canvas).toBeVisible()
  await expect(canvas.locator('.react-flow__edge')).toHaveCount(1 + inferred)
}
