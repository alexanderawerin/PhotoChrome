import sharp from 'sharp'
import type { Page } from '@playwright/test'
import { test, expect } from './helpers/fixtures'

const exportButton = (page: Page) => page.getByRole('button', { name: 'Export processed image (Ctrl+S)', exact: true })
const selectProvia = (page: Page) => page.getByRole('button', { name: 'Select film Provia', exact: true })

async function downloadedPixels(page: Page) {
  const pending = page.waitForEvent('download')
  await exportButton(page).click()
  const download = await pending
  const file = await download.path()
  expect(file).not.toBeNull()
  const decoded = await sharp(file!).removeAlpha().raw().toBuffer({ resolveWithObject: true })
  expect([decoded.info.width, decoded.info.height]).toEqual([200, 150])
  expect((await sharp(file!).metadata()).format).toBe('jpeg')
  return { name: download.suggestedFilename(), pixels: decoded.data }
}

test('a delayed actual LUT blocks single export until the intended film is ready', async ({ page, editorPage }) => {
  let release!: () => void
  let requested!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  const started = new Promise<void>(resolve => { requested = resolve })
  await page.route('**/lut/provia.png*', async route => {
    if (route.request().resourceType() !== 'image') return route.continue()
    requested()
    await gate
    await route.continue()
  })
  let downloads = 0
  page.on('download', () => { downloads++ })
  try {
    await selectProvia(page).click()
    await started
    await expect(exportButton(page)).toBeDisabled()
    await page.keyboard.press('Control+s')
    await expect(page.getByLabel('Applied color', { exact: true })).toContainText('Preparing:')
    expect(downloads).toBe(0)
  } finally {
    release()
  }
  await expect(exportButton(page)).toBeEnabled()
  const saved = await downloadedPixels(page)
  expect(saved.name).toMatch(/provia/)
  expect(downloads).toBe(1)
})

test('required LUT failure has no fallback download and Retry loads the intended film', async ({ page, editorPage }) => {
  let requests = 0
  await page.route('**/lut/provia.png*', async route => {
    if (route.request().resourceType() !== 'image') return route.continue()
    requests++
    if (requests === 1) return route.abort('failed')
    await route.continue()
  })
  let downloads = 0
  page.on('download', () => { downloads++ })
  await selectProvia(page).click()
  const alert = page.getByRole('alert')
  await expect(alert).toContainText('required film resource')
  await expect(exportButton(page)).toBeDisabled()
  await page.keyboard.press('Control+s')
  expect(downloads).toBe(0)
  await alert.getByRole('button', { name: 'Retry film', exact: true }).click()
  await expect(exportButton(page)).toBeEnabled()
  await expect(alert).toHaveCount(0)
  expect(requests).toBe(2)
  const retry = await downloadedPixels(page)
  expect(retry.name).toMatch(/provia/)
  await page.getByRole('button', { name: 'Back to editor', exact: true }).click()
  await page.getByRole('button', { name: 'Select Original', exact: true }).click()
  await expect(exportButton(page)).toBeEnabled()
  const original = await downloadedPixels(page)
  expect(original.name).toContain('original')
  const difference = retry.pixels.reduce((sum: number, value: number, index: number) => sum + Math.abs(value - original.pixels[index]), 0) / retry.pixels.length
  expect(difference).toBeGreaterThan(1)
})

test('late LUT completion after a film change cannot replace Original', async ({ page, editorPage }) => {
  let release!: () => void
  let requested!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  const started = new Promise<void>(resolve => { requested = resolve })
  let completed!: () => void
  const finished = new Promise<void>(resolve => { completed = resolve })
  await page.route('**/lut/provia.png*', async route => {
    if (route.request().resourceType() !== 'image') return route.continue()
    requested()
    await gate
    await route.fulfill({ response: await route.fetch() })
    completed()
  })
  const canvas = page.locator('canvas[aria-label="Preview"]')
  const originalPreview = await canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL())
  try {
    await selectProvia(page).click()
    await started
    await page.getByRole('button', { name: 'Select Original', exact: true }).click()
    await expect(exportButton(page)).toBeEnabled()
  } finally {
    release()
  }
  await finished
  await expect.poll(() => canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL())).toBe(originalPreview)
  expect((await downloadedPixels(page)).name).toContain('original')
})
