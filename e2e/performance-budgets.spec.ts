import { test, expect } from './helpers/fixtures'
import { fixturePath, selectFirstRecipe, uploadVideo, waitForEditor } from './helpers/upload'
import { readFile } from 'node:fs/promises'
import { unzipSync } from 'fflate'

const BUDGETS_MS = {
  twoPhotoEditor: 5_000,
  recipePreview: 2_500,
  firstTenCards: 5_000,
  photoExport: 10_000,
  videoExport: 45_000,
  twentyPhotoBatch: 120_000,
} as const

async function mainPreviewSignature(page: import('@playwright/test').Page): Promise<number> {
  return page.locator('canvas[aria-label="Preview"]').evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext('2d')
    if (!context || canvas.width === 0 || canvas.height === 0) return 0
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data
    const stride = Math.max(4, Math.floor(data.length / 256 / 4) * 4)
    let signature = 0
    for (let index = 0; index < data.length; index += stride) {
      signature = (signature + data[index] * 3 + data[index + 1] * 5 + data[index + 2] * 7) >>> 0
    }
    return signature
  })
}

async function renderedCardCount(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(() => {
    const canvases = document.querySelectorAll<HTMLCanvasElement>('aside [aria-label^="Apply preset"] canvas')
    let rendered = 0
    for (const canvas of canvases) {
      if (canvas.width === 0 || canvas.height === 0) continue
      const context = canvas.getContext('2d')
      if (!context) continue
      const pixel = context.getImageData(canvas.width >> 1, canvas.height >> 1, 1, 1).data
      if (pixel[0] > 5 || pixel[1] > 5 || pixel[2] > 5) rendered++
    }
    return rendered
  })
}

test.describe('Chromium performance budgets', () => {
  test.describe.configure({ mode: 'serial' })

  test('two-photo editor and first ten recipe cards meet readiness budgets', async ({ page, landingPage }) => {
    const startedAt = performance.now()
    await page.locator('input#media-upload').setInputFiles([
      fixturePath('test-image.jpg'),
      fixturePath('test-image-2.jpg'),
    ])
    await waitForEditor(page)
    await expect(page.locator('[role="tablist"][aria-label="Image thumbnails"] [role="tab"]')).toHaveCount(2)
    const editorReadyMs = performance.now() - startedAt

    await expect.poll(() => renderedCardCount(page), { timeout: BUDGETS_MS.firstTenCards }).toBeGreaterThanOrEqual(10)
    const firstTenCardsMs = performance.now() - startedAt

    expect(editorReadyMs).toBeLessThanOrEqual(BUDGETS_MS.twoPhotoEditor)
    expect(firstTenCardsMs).toBeLessThanOrEqual(BUDGETS_MS.firstTenCards)
  })

  test('recipe preview meets its budget', async ({ page, editorPage }) => {
    const before = await mainPreviewSignature(page)
    const card = page.locator('aside [aria-label^="Apply preset"]').first()
    const startedAt = performance.now()
    await card.click()
    await expect.poll(() => mainPreviewSignature(page), { timeout: BUDGETS_MS.recipePreview }).not.toBe(before)
    expect(performance.now() - startedAt).toBeLessThanOrEqual(BUDGETS_MS.recipePreview)
  })

  test('photo export meets its budget', async ({ page, editorPage }) => {
    await selectFirstRecipe(page)
    const downloadPromise = page.waitForEvent('download')
    const startedAt = performance.now()
    await page.locator('[aria-label*="Export processed image (Ctrl+S)"]').click()
    await downloadPromise
    expect(performance.now() - startedAt).toBeLessThanOrEqual(BUDGETS_MS.photoExport)
  })

  test('three-second video export meets its budget', async ({ page, landingPage }) => {
    test.setTimeout(60_000)
    await uploadVideo(page)
    await selectFirstRecipe(page)
    const downloadPromise = page.waitForEvent('download')
    const startedAt = performance.now()
    await page.getByRole('button', { name: 'Export video' }).click()
    await downloadPromise
    expect(performance.now() - startedAt).toBeLessThanOrEqual(BUDGETS_MS.videoExport)
  })

  test('twenty-photo batch export meets its budget', async ({ page, landingPage }) => {
    test.setTimeout(140_000)
    const photos = Array.from(
      { length: 20 },
      (_, index) => fixturePath(index % 2 === 0 ? 'test-image.jpg' : 'test-image-2.jpg')
    )
    await page.locator('input#media-upload').setInputFiles(photos)
    await waitForEditor(page)
    await expect(page.locator('[role="tablist"][aria-label="Image thumbnails"] [role="tab"]')).toHaveCount(20)
    await selectFirstRecipe(page)
    await page.getByRole('button', { name: 'Apply current preset to all 20 images' }).first().click()
    await page.waitForTimeout(500)

    const downloadPromise = page.waitForEvent('download')
    const startedAt = performance.now()
    await page.getByRole('button', { name: 'Export all photos' }).first().click()
    const download = await downloadPromise
    const elapsed = performance.now() - startedAt
    expect(elapsed).toBeLessThanOrEqual(BUDGETS_MS.twentyPhotoBatch)

    const path = await download.path()
    if (!path) throw new Error('Batch download path unavailable')
    const entries = unzipSync(new Uint8Array(await readFile(path)))
    expect(Object.keys(entries).filter(name => name.endsWith('.jpg'))).toHaveLength(20)
    expect(entries['export-report.txt']).toBeUndefined()
  })
})
