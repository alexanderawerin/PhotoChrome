import { test, expect } from './helpers/fixtures'
import { selectBaseFilm, waitForEditor } from './helpers/upload'

test('demo shortcuts cannot transform or export the demo media', async ({ page, landingPage }) => {
  await waitForEditor(page)
  const canvas = page.locator('canvas[aria-label="Preview"]')
  const before = await canvas.evaluate((element: HTMLCanvasElement) => [element.width, element.height, element.toDataURL()])
  const downloads: string[] = []
  page.on('download', download => downloads.push(download.suggestedFilename()))
  await page.keyboard.press('r')
  await page.keyboard.press('f')
  await page.keyboard.press('c')
  await page.keyboard.press('t')
  await page.keyboard.press('Control+s')
  await expect(page.getByRole('slider', { name: 'Crop angle' })).toHaveCount(0)
  expect(await canvas.evaluate((element: HTMLCanvasElement) => [element.width, element.height, element.toDataURL()])).toEqual(before)
  expect(downloads).toEqual([])
})

test('Help blocks rotate/export and shortcuts resume after dismissal', async ({ page, editorPage }) => {
  const canvas = page.locator('canvas[aria-label="Preview"]')
  const before = await canvas.evaluate((element: HTMLCanvasElement) => [element.width, element.height])
  const downloads: string[] = []
  page.on('download', download => downloads.push(download.suggestedFilename()))
  await page.getByRole('button', { name: 'Help', exact: true }).click()
  const help = page.getByRole('dialog', { name: 'Photochrome help' })
  await expect(help).toBeVisible()
  await page.keyboard.press('r')
  await page.keyboard.press('Control+s')
  expect(await canvas.evaluate((element: HTMLCanvasElement) => [element.width, element.height])).toEqual(before)
  expect(downloads).toEqual([])
  await page.keyboard.press('Escape')
  await expect(help).toBeHidden()
  await page.keyboard.press('r')
  await expect.poll(() => canvas.evaluate((element: HTMLCanvasElement) => [element.width, element.height])).toEqual([before[1], before[0]])
})

test('unfinished tuning cannot be exported through buttons or shortcuts', async ({ page, editorPage }) => {
  await selectBaseFilm(page)
  await page.getByRole('button', { name: 'Open Advanced settings' }).click()
  const panel = page.getByRole('region', { name: 'Advanced settings' })
  await panel.getByRole('tab', { name: 'Manual', exact: true }).click()
  const highlight = panel.getByRole('slider', { name: 'Highlight', exact: true })
  await highlight.focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('button', { name: 'Export processed image (Ctrl+S)', exact: true })).toHaveCount(0)
  const draftHighlight = await highlight.getAttribute('aria-valuenow')
  const downloads: string[] = []
  page.on('download', download => downloads.push(download.suggestedFilename()))
  await page.keyboard.press('Control+s')
  await expect(panel).toBeVisible()
  await expect(highlight).toHaveAttribute('aria-valuenow', draftHighlight!)
  expect(downloads).toEqual([])
})
