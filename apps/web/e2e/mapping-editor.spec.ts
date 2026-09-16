import AxeBuilder from '@axe-core/playwright'
import { expect } from '@playwright/test'
import { openReview, tabTo, test } from './review-helpers'

test('edits an array mapping, updates manual topology, cancels and undoes', async ({
  reviewPage: page,
}, testInfo) => {
  await openReview(page)
  await page.getByRole('option', { name: /Source GET \/spaces\/available/ }).click()
  await page.getByRole('button', { name: 'Edit Mapping', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Edit Mapping' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('radio', { name: /Response #\/\*\/id / }).check()
  await dialog.getByRole('radio', { name: /Body #\/spaceId / }).check()
  await expect(dialog.getByRole('button', { name: 'Apply mapping' })).toBeDisabled()
  await dialog.getByLabel('Source response array index 1').fill('0')
  await expect(dialog.getByRole('button', { name: 'Apply mapping' })).toBeEnabled()
  const results = await new AxeBuilder({ page }).analyze()
  expect(
    results.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? '')),
  ).toEqual([])
  await page.screenshot({
    path: testInfo.outputPath('mapping-editor-valid.png'),
    animations: 'disabled',
  })
  await expect(dialog).toHaveScreenshot('mapping-editor-valid.png', {
    animations: 'disabled',
    caret: 'hide',
  })
  await dialog.getByRole('button', { name: 'Apply mapping' }).click()
  await expect(dialog).not.toBeVisible()
  await expect(
    page.getByRole('region', { name: 'Review inferred data transfer', exact: true }),
  ).toContainText('$response.body#/0/id')
  await expect(page.getByRole('region', { name: 'Review Actions', exact: true })).toContainText(
    'edited',
  )
  await page.getByRole('button', { name: 'Topology preview' }).click()
  await expect(page.getByRole('region', { name: 'Draft graph summary' })).toContainText(
    '1 manual accepted',
  )
  await expect(page.locator('.react-flow__edge')).toHaveCount(2)
  await page.getByRole('button', { name: 'Edit Mapping', exact: true }).click()
  await expect(dialog.getByLabel('Source response array index 1')).toHaveValue('0')
  await dialog.getByLabel('Source response array index 1').fill('2')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Edit Mapping', exact: true })).toBeFocused()
  await page.getByRole('button', { name: 'Undo latest change' }).click()
  await expect(page.getByRole('region', { name: 'Draft graph summary' })).toContainText(
    '0 manual accepted',
  )
  await expect(page.locator('.react-flow__edge')).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Undo latest change' })).toBeDisabled()
})

test('supports keyboard editing and blocks incompatible or incomplete mappings', async ({
  reviewPage: page,
}, testInfo) => {
  await openReview(page)
  await page.getByRole('option', { name: /Source GET \/spaces\/available/ }).click()
  const edit = page.getByRole('button', { name: 'Edit Mapping', exact: true })
  await edit.focus()
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Edit Mapping' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('radio', { name: /Response #\/\*\/id / }).check()
  await dialog.getByRole('radio', { name: /Body #\/spaceId / }).check()
  await dialog.getByLabel('Source response array index 1').fill('-1')
  await expect(dialog.getByRole('button', { name: 'Apply mapping' })).toBeDisabled()
  await dialog.getByLabel('Source response array index 1').fill('0')
  await dialog.getByRole('radio', { name: /Body #\/attendees / }).check()
  await expect(dialog.getByLabel('Mapping validation')).toContainText('incompatible')
  await expect(dialog.getByRole('button', { name: 'Apply mapping' })).toBeDisabled()
  await page.screenshot({
    path: testInfo.outputPath('mapping-editor-invalid.png'),
    animations: 'disabled',
  })
  await expect(dialog).toHaveScreenshot('mapping-editor-invalid.png', {
    animations: 'disabled',
    caret: 'hide',
  })
  for (let index = 0; index < 18; index++) {
    await page.keyboard.press('Tab')
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true)
  }
  await page.keyboard.press('Escape')
  await expect(edit).toBeFocused()
  await expect(page.getByRole('button', { name: 'Undo latest change' })).toBeDisabled()
})

test('previews a template and edits a header using only keyboard controls', async ({
  reviewPage: page,
}) => {
  await page.route('**/fixtures/reservation-workspace.json', async (route) => {
    const response = await route.fetch()
    const snapshot = await response.json()
    const operation = snapshot.apiDocument.operations.find(
      (item: { id: string }) => item.id === 'operation:post:/reservations',
    )
    const source = snapshot.apiDocument.operations.find(
      (item: { id: string }) => item.id === 'operation:post:/auth/login',
    ).responses[0].content[0].schema.properties.token
    operation.parameters.push({
      name: 'reference',
      location: 'header',
      required: true,
      deprecated: false,
      source: operation.source,
      schema: { ...source, source: { ...source.source, pointer: '#/test/reference' } },
    })
    snapshot.reviewDecisionSet = {
      schemaVersion: '1.0',
      revision: 0,
      decisions: [],
      manualEdges: [],
    }
    snapshot.reviewOutcomes = []
    snapshot.acceptedGraph = snapshot.declaredGraph
    await route.fulfill({ response, json: snapshot })
  })
  await page.reload()
  await openReview(page)
  const candidate = page.getByRole('option', { name: /Source GET \/spaces\/available/ })
  await tabTo(
    page,
    page
      .getByRole('listbox', { name: /Inference candidates/ })
      .getByRole('option')
      .first(),
  )
  for (
    let index = 0;
    index < 4 && !(await candidate.evaluate((element) => element === document.activeElement));
    index++
  )
    await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await tabTo(page, page.getByRole('button', { name: 'Edit Mapping', exact: true }))
  await page.keyboard.press('Enter')
  const dialog = page.getByRole('dialog', { name: 'Edit Mapping' })
  await page.keyboard.press('Space')
  await tabTo(page, dialog.getByLabel('Source response array index 1'))
  await page.keyboard.type('0')
  await page.keyboard.press('Tab')
  const header = dialog.getByRole('radio', { name: /header.reference / })
  for (
    let index = 0;
    index < 6 && !(await header.evaluate((element) => element === document.activeElement));
    index++
  )
    await page.keyboard.press('ArrowDown')
  await expect(header).toBeChecked()
  await tabTo(page, dialog.getByRole('textbox', { name: /Transform template/ }))
  await page.keyboard.type('ID-{$value}')
  await expect(dialog.getByLabel('Mapping validation')).toContainText(
    'ID-{$steps.source.outputs.value}',
  )
  await tabTo(page, dialog.getByRole('button', { name: 'Apply mapping' }))
  await page.keyboard.press('Enter')
  await expect(page.getByRole('region', { name: 'Review inferred data transfer' })).toContainText(
    'header.reference',
  )
  await expect(page.getByRole('region', { name: 'Review inferred data transfer' })).toContainText(
    'ID-{$steps.source.outputs.value}',
  )
})
