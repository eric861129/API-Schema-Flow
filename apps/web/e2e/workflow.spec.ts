import { readFile } from 'node:fs/promises'
import { expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

import { test } from './review-helpers'

test('builds, validates, saves, reopens, and exports an accepted Reservation workflow', async ({
  reviewPage: page,
}, testInfo) => {
  await page.getByRole('button', { name: 'Workflows', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Workflow editor' })).toBeVisible()
  await page.getByRole('button', { name: 'Create workflow' }).click()
  await page.getByRole('textbox', { name: 'Workflow ID' }).fill('createAndReadReservation')
  await page.getByRole('textbox', { name: 'Summary' }).fill('Create and read a reservation')
  const endpoint = page.getByRole('combobox', { name: 'Endpoint', exact: true })
  await endpoint.selectOption({ label: 'POST /reservations · createReservation' })
  await page.getByRole('button', { name: 'Add step' }).click()
  await endpoint.selectOption({ label: 'GET /reservations/{id} · getReservation' })
  await page.getByRole('button', { name: 'Add step' }).click()
  await expect(
    page.getByRole('region', { name: 'Accepted mapping bindings' }).getByRole('checkbox'),
  ).toHaveCount(1)
  await page
    .getByRole('region', { name: 'Accepted mapping bindings' })
    .getByRole('checkbox')
    .check()
  await page.getByRole('combobox', { name: 'Format' }).selectOption('json')
  await page.getByRole('button', { name: 'Validate and preview' }).click()
  await expect(page.getByText('Valid Arazzo document')).toBeVisible()
  const preview = page.getByRole('region', { name: 'Arazzo preview' }).locator('pre')
  const document = JSON.parse(await preview.innerText())
  expect(document.workflows[0].steps).toMatchObject([
    { stepId: 'createReservation', operationId: 'createReservation' },
    { stepId: 'getReservation', operationId: 'getReservation', dependsOn: ['createReservation'] },
  ])
  expect(document.workflows[0].steps[1].parameters).toMatchObject([
    { name: 'id', in: 'path', value: '$steps.createReservation.outputs.id' },
  ])
  const mock = page.getByRole('region', { name: 'Local Mock and Trace' })
  await expect(mock.getByRole('button', { name: 'Run in Local Mock' })).toBeEnabled()
  await mock.getByRole('button', { name: 'Fill sample request' }).click()
  await expect(mock.getByRole('textbox', { name: 'POST request JSON' })).toHaveValue(/spaceId/u)
  await mock.getByRole('button', { name: 'Run in Local Mock' }).click()
  await expect(
    mock.getByText('Passed: GET returned the same entity created by POST.'),
  ).toBeVisible()
  const trace = mock.getByLabel('Execution Trace')
  await expect(trace.locator('li')).toHaveCount(2)
  await expect(trace).toContainText('HTTP 201')
  await expect(trace).toContainText('HTTP 200')
  await expect(trace).toContainText('00000000-0000-4000-8000-000000000001')
  await expect(trace).not.toContainText('11111111-1111-4111-8111-111111111111')
  await mock.getByRole('button', { name: 'Reset Mock session' }).click()
  await expect(mock).toContainText('0 entities in memory')
  await expect(trace).toHaveCount(0)
  await mock.getByRole('textbox', { name: 'POST request JSON' }).fill('{"spaceId":"invalid"}')
  await mock.getByRole('button', { name: 'Run in Local Mock' }).click()
  await expect(mock.getByRole('alert')).toContainText('Required request field')
  await expect(mock).toContainText('0 entities in memory')
  await mock.getByRole('button', { name: 'Fill sample request' }).click()
  const arazzoDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download Arazzo' }).click()
  const exportedArazzo = JSON.parse(await readFile((await (await arazzoDownload).path())!, 'utf8'))
  expect(exportedArazzo).toEqual(document)
  await page.getByRole('combobox', { name: 'Format' }).selectOption('yaml')
  await page.getByRole('button', { name: 'Validate and preview' }).click()
  await expect(preview).toContainText('arazzo: 1.1.0')
  await page.screenshot({ path: testInfo.outputPath('workflow-preview.png'), fullPage: true })
  const yamlDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download Arazzo' }).click()
  expect((await yamlDownload).suggestedFilename()).toBe('createandreadreservation.arazzo.yaml')
  const axe = await new AxeBuilder({ page }).analyze()
  expect(
    axe.violations.filter((item) => ['critical', 'serious'].includes(item.impact ?? '')),
  ).toEqual([])

  await page.getByRole('button', { name: 'Project', exact: true }).click()
  const projectDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save Project' }).click()
  const project = await readFile((await (await projectDownload).path())!, 'utf8')
  expect(JSON.parse(project).workflow.selectedMappings).toHaveLength(1)
  expect(project).not.toContain('11111111-1111-4111-8111-111111111111')
  await page.getByRole('button', { name: 'Close project' }).click()
  await page.reload()
  await page.getByRole('button', { name: 'Workflows', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Workflow ID' })).toHaveValue(
    'createAndReadReservation',
  )
  await expect(
    page.getByRole('region', { name: 'Accepted mapping bindings' }).getByRole('checkbox'),
  ).toBeChecked()

  await page.getByRole('textbox', { name: 'Workflow ID' }).fill('temporaryChange')
  await page.getByRole('button', { name: 'Project', exact: true }).click()
  await page.getByLabel('Project file', { exact: true }).setInputFiles({
    name: 'project.json',
    mimeType: 'application/json',
    buffer: Buffer.from(project),
  })
  await expect(page.getByRole('region', { name: 'Project load preview' })).toBeVisible()
  await page.getByRole('button', { name: 'Apply project' }).click()
  await expect(page.getByRole('textbox', { name: 'Workflow ID' })).toHaveValue(
    'createAndReadReservation',
  )
  await page.getByRole('button', { name: 'Validate and preview' }).click()
  await expect(page.getByText('Valid Arazzo document')).toBeVisible()
})

test('shows the workflow authoring controls in Traditional Chinese', async ({
  reviewPage: page,
}) => {
  await page.getByRole('combobox', { name: 'Language' }).selectOption('zh-TW')
  await page.getByRole('button', { name: '工作流程', exact: true }).click()
  await expect(page.getByRole('heading', { name: '建立 API 任務' })).toBeVisible()
  await page.getByRole('button', { name: '建立工作流程' }).click()
  await expect(page.getByRole('region', { name: '工作流程資訊' })).toBeVisible()
  await expect(page.getByRole('region', { name: '依序執行的步驟' })).toBeVisible()
  await expect(page.getByRole('region', { name: '已接受的映射繫結' })).toBeVisible()
  await expect(page.getByRole('region', { name: '本機 Mock 與執行紀錄' })).toBeVisible()
  await expect(page.getByRole('button', { name: '在本機 Mock 執行' })).toBeDisabled()
})
