import { readFile } from 'node:fs/promises'
import sharp from 'sharp'
import { unzipSync } from 'fflate'
import AxeBuilder from '@axe-core/playwright'
import type { Locator, Page } from '@playwright/test'
import { test, expect } from './helpers/fixtures'
import {
  fixturePath,
  selectFirstRecipe,
  uploadMultipleImages,
  waitForEditor,
} from './helpers/upload'

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

function currentExportButton(page: Page): Locator {
  return page.locator('button[aria-label^="Export processed image"]:visible').first()
}

function completionDialog(page: Page, name = 'Export complete'): Locator {
  return page.getByRole('dialog', { name, exact: true })
}

function completionPreviews(dialog: Locator): Locator {
  return dialog.locator('canvas[role="img"][aria-label^="Exported photo: "]')
}

async function canvasPng(canvas: Locator): Promise<Buffer> {
  const dataUrl = await canvasDataUrl(canvas)
  const separator = dataUrl.indexOf(',')
  if (separator < 0) throw new Error('Completion preview did not return a data URL')
  return Buffer.from(dataUrl.slice(separator + 1), 'base64')
}

async function canvasDataUrl(canvas: Locator): Promise<string> {
  return canvas.evaluate(element => {
    if (!(element instanceof HTMLCanvasElement)) throw new Error('Completion preview is not a canvas')
    return element.toDataURL('image/png')
  })
}

type RawImage = {
  data: Buffer
  width: number
  height: number
}

async function resizeForComparison(input: Buffer): Promise<RawImage> {
  const result = await sharp(input)
    .resize({ width: 480, height: 480, fit: 'inside' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  return {
    data: result.data,
    width: result.info.width,
    height: result.info.height,
  }
}

async function expectDownloadedPixelsMatchPreview(downloaded: Buffer, preview: Locator): Promise<void> {
  const [downloadedImage, previewImage] = await Promise.all([
    resizeForComparison(downloaded),
    canvasPng(preview).then(resizeForComparison),
  ])

  expect(previewImage.width).toBe(downloadedImage.width)
  expect(previewImage.height).toBe(downloadedImage.height)
  expect(previewImage.data.length).toBe(downloadedImage.data.length)

  let totalDifference = 0
  let largeDifferencePixels = 0
  const pixelCount = downloadedImage.width * downloadedImage.height
  for (let offset = 0; offset < downloadedImage.data.length; offset += 3) {
    const difference = Math.abs(downloadedImage.data[offset] - previewImage.data[offset])
      + Math.abs(downloadedImage.data[offset + 1] - previewImage.data[offset + 1])
      + Math.abs(downloadedImage.data[offset + 2] - previewImage.data[offset + 2])
    totalDifference += difference
    if (difference > 45) largeDifferencePixels++
  }

  // The downloaded image is JPEG while the completion canvas is lossless. A
  // small amount of error is expected, but the thumbnail must be the same
  // exported output rather than a source or recipe-card preview.
  const meanAbsoluteError = totalDifference / (pixelCount * 3)
  expect(meanAbsoluteError).toBeLessThan(18)
  expect(largeDifferencePixels / pixelCount).toBeLessThan(0.12)
}

async function installProcessorMock(
  page: Page,
  mode: 'fail-all' | 'fail-second-call'
): Promise<void> {
  await page.evaluate(async (mockMode) => {
    // @ts-expect-error Vite browser module path is unavailable to the Node compiler.
    const { ImageProcessor } = await import('/src/engine/processor.ts')
    const original = ImageProcessor.processAsync
    let calls = 0
    // @ts-expect-error Test-only restoration hook.
    window.__restoreCompletionProcessor = () => { ImageProcessor.processAsync = original }
    ImageProcessor.processAsync = (imageData: ImageData, plan: unknown, options: unknown) => {
      calls++
      if (mockMode === 'fail-all' || (mockMode === 'fail-second-call' && calls === 2)) {
        return Promise.reject(new Error('Forced completion export failure'))
      }
      return original.call(ImageProcessor, imageData, plan, options)
    }
  }, mode)
}

async function restoreProcessorMock(page: Page): Promise<void> {
  await page.evaluate(() => {
    // @ts-expect-error Test-only restoration hook.
    window.__restoreCompletionProcessor?.()
  })
}

async function uploadNamedBatch(page: Page): Promise<void> {
  const landscape = await readFile(fixturePath('test-image.jpg'))
  const portrait = await readFile(fixturePath('test-image-2.jpg'))
  const input = page.getByLabel('Choose photos or video to edit', { exact: true })
  await input.setInputFiles([
    { name: 'success.jpg', mimeType: 'image/jpeg', buffer: landscape },
    { name: 'failed.jpg', mimeType: 'image/jpeg', buffer: portrait },
    { name: 'skipped.jpg', mimeType: 'image/jpeg', buffer: landscape },
  ])
}

async function selectMobilePreset(page: Page): Promise<void> {
  await page
    .getByRole('region', { name: 'Preset carousel', exact: true })
    .locator('[aria-label^="Apply preset"]')
    .first()
    .click()
}

async function expectTouchTarget(locator: Locator): Promise<void> {
  const box = await locator.boundingBox()
  expect(box).not.toBeNull()
  if (!box) return
  expect(box.width).toBeGreaterThanOrEqual(44)
  expect(box.height).toBeGreaterThanOrEqual(44)
}

test.describe('Editor — Export completion', () => {
  test.skip(({ isMobile }) => isMobile, 'Desktop completion coverage runs in the chromium project')

  test('single export shows only the current photo and its downloaded pixels', async ({ page, landingPage }) => {
    await uploadMultipleImages(page)
    await waitForEditor(page)

    const thumbnails = page.locator('[role="tablist"][aria-label="Image thumbnails"] [role="tab"]')
    await thumbnails.nth(1).click()
    await expect(thumbnails.nth(1)).toHaveAttribute('aria-selected', 'true')
    await selectFirstRecipe(page)

    const downloadPromise = page.waitForEvent('download')
    const exportButton = currentExportButton(page)
    await expect(exportButton).toBeEnabled()
    await exportButton.click()
    const download = await downloadPromise
    const fileName = download.suggestedFilename()
    expect(fileName).toContain('test-image-2')

    const dialog = completionDialog(page)
    await expect(dialog).toBeVisible()
    await expect(dialog).toContainText('1 photo exported')
    const previews = completionPreviews(dialog)
    await expect(previews).toHaveCount(1)
    await expect(previews.first()).toHaveAttribute('aria-label', `Exported photo: ${fileName}`)
    await expect(previews.first()).toHaveAttribute('role', 'img')

    const downloadPath = await download.path()
    if (!downloadPath) throw new Error('Downloaded photo path unavailable')
    await expectDownloadedPixelsMatchPreview(await readFile(downloadPath), previews.first())
  })

  test('batch completion includes only successful archive entries and keeps skip/error counts', async ({ page, landingPage }) => {
    await uploadNamedBatch(page)
    await waitForEditor(page)
    await selectFirstRecipe(page)

    const thumbnails = page.locator('[role="tablist"][aria-label="Image thumbnails"] [role="tab"]')
    await thumbnails.nth(1).click()
    await selectFirstRecipe(page)
    await installProcessorMock(page, 'fail-second-call')

    try {
      const downloadPromise = page.waitForEvent('download')
      await page.getByRole('button', { name: 'Export all photos' }).click()
      const download = await downloadPromise
      const archivePath = await download.path()
      if (!archivePath) throw new Error('Batch download path unavailable')

      const entries = unzipSync(new Uint8Array(await readFile(archivePath)))
      const jpegNames = Object.keys(entries).filter(name => name.endsWith('.jpg'))
      expect(jpegNames).toHaveLength(1)
      expect(jpegNames[0]).toContain('success')
      expect(strFromU8(entries['export-report.txt'])).toContain('failed.jpg: Forced completion export failure')
      expect(strFromU8(entries['export-report.txt'])).toContain('skipped.jpg: No recipe selected')

      const dialog = completionDialog(page)
      await expect(dialog).toBeVisible()
      await expect(dialog).toContainText('1 exported · 1 skipped · 1 error')
      const previews = completionPreviews(dialog)
      await expect(previews).toHaveCount(1)
      await expect(previews.first()).toHaveAttribute('aria-label', `Exported photo: ${jpegNames[0]}`)
      await expect(previews.first()).not.toHaveAttribute('aria-label', /failed\.jpg/)

      await expectDownloadedPixelsMatchPreview(Buffer.from(entries[jpegNames[0]]), previews.first())
    } finally {
      await restoreProcessorMock(page)
    }
  })

  test('zero-success batch uses empty completion wording and has no previews', async ({ page, landingPage }) => {
    await uploadMultipleImages(page)
    await waitForEditor(page)
    await selectFirstRecipe(page)
    await page.getByRole('button', { name: 'Apply current preset to all 2 images' }).click()
    await installProcessorMock(page, 'fail-all')

    try {
      const downloadPromise = page.waitForEvent('download')
      await page.getByRole('button', { name: 'Export all photos' }).click()
      const download = await downloadPromise
      const archivePath = await download.path()
      if (!archivePath) throw new Error('Batch download path unavailable')

      const entries = unzipSync(new Uint8Array(await readFile(archivePath)))
      expect(Object.keys(entries).filter(name => name.endsWith('.jpg'))).toHaveLength(0)

      const dialog = completionDialog(page, 'No photos exported')
      await expect(dialog).toBeVisible()
      await expect(dialog).toContainText('0 exported · 2 errors')
      await expect(dialog).not.toContainText('0 skipped')
      await expect(completionPreviews(dialog)).toHaveCount(0)
    } finally {
      await restoreProcessorMock(page)
    }
  })

  test('traps focus, blocks editor shortcuts, and restores export focus on Escape', async ({ page, editorPage }) => {
    const preview = page.locator('canvas[aria-label="Preview"]:visible')
    const beforeRecipe = await canvasDataUrl(preview)
    await selectFirstRecipe(page)
    await expect.poll(() => canvasDataUrl(preview)).not.toBe(beforeRecipe)
    await expect(page.getByText('Processing...', { exact: true })).toHaveCount(0)
    const processedPreview = await canvasDataUrl(preview)
    const exportButton = currentExportButton(page)

    let downloads = 0
    page.on('download', () => { downloads++ })
    const downloadPromise = page.waitForEvent('download')
    await page.keyboard.down('Space')
    await expect.poll(() => canvasDataUrl(preview)).not.toBe(processedPreview)
    await exportButton.click()
    await downloadPromise

    const dialog = completionDialog(page)
    await expect(dialog).toBeVisible()
    const before = await preview.evaluate((element: HTMLCanvasElement) => ({ width: element.width, height: element.height }))

    const focusIsInside = () => dialog.evaluate(element => element.contains(document.activeElement))
    await expect.poll(focusIsInside).toBe(true)
    for (let index = 0; index < 5; index++) {
      await page.keyboard.press('Tab')
      await expect.poll(focusIsInside).toBe(true)
    }

    await page.keyboard.press('c')
    await page.keyboard.press('r')
    await page.keyboard.press('Control+s')
    await expect(dialog).toBeVisible()
    await expect(page.getByRole('slider', { name: 'Crop angle' })).toBeHidden()
    await expect.poll(() => preview.evaluate((element: HTMLCanvasElement) => ({ width: element.width, height: element.height }))).toEqual(before)
    await page.waitForTimeout(150)
    expect(downloads).toBe(1)

    await page.keyboard.up('Space')
    await page.keyboard.press('Escape')
    await expect(dialog).toBeHidden()
    await expect(exportButton).toBeFocused()
    await expect.poll(() => canvasDataUrl(preview)).toBe(processedPreview)
  })

  test('preserves editing on Back to editor and returns to the demo on New edit', async ({ page, editorPage }) => {
    await selectFirstRecipe(page)
    const selected = page.locator('aside [aria-label^="Apply preset"][aria-label$=", selected"]')
    await expect(selected.first()).toBeVisible()

    const exportButton = currentExportButton(page)
    const downloadPromise = page.waitForEvent('download')
    await exportButton.click()
    await downloadPromise

    const dialog = completionDialog(page)
    await expect(dialog).toBeVisible()
    const actions = dialog.locator('button')
    await expect(actions).toHaveCount(2)
    await expect(actions.nth(0)).toHaveText('New edit')
    await expect(actions.nth(1)).toHaveText('Back to editor')
    const newEditBox = await actions.nth(0).boundingBox()
    const backBox = await actions.nth(1).boundingBox()
    expect(newEditBox).not.toBeNull()
    expect(backBox).not.toBeNull()
    if (newEditBox && backBox) expect(newEditBox.x).toBeLessThan(backBox.x)

    await actions.nth(1).click()
    await expect(dialog).toBeHidden()
    await expect(selected.first()).toBeVisible()
    await expect(exportButton).toBeEnabled()

    const secondDownloadPromise = page.waitForEvent('download')
    await exportButton.click()
    await secondDownloadPromise
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'New edit', exact: true }).click()
    await expect(dialog).toBeHidden()
    await expect(page.getByRole('button', { name: 'Upload photos', exact: true })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: /^adjust$/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^crop$/i })).toHaveCount(0)
  })
})

for (const viewport of [
  { width: 320, height: 740 },
  { width: 393, height: 852 },
]) {
  test.describe(`Editor — mobile completion at ${viewport.width}px`, () => {
    test.skip(({ isMobile }) => !isMobile, 'Completion mobile coverage runs in the mobile-chrome project')
    test.use({ viewport })

    test('keeps actions touch-sized, traps focus, and has no detected WCAG A/AA violations', async ({ page, editorPage }) => {
      await selectMobilePreset(page)
      const exportButton = currentExportButton(page)
      const downloadPromise = page.waitForEvent('download')
      await exportButton.click()
      await downloadPromise

      const dialog = completionDialog(page)
      await expect(dialog).toBeVisible()
      await expect(dialog.getByText('1 photo exported', { exact: false })).toBeVisible()
      await expectTouchTarget(dialog.getByRole('button', { name: 'New edit', exact: true }))
      await expectTouchTarget(dialog.getByRole('button', { name: 'Back to editor', exact: true }))

      const focusIsInside = () => dialog.evaluate(element => element.contains(document.activeElement))
      await expect.poll(focusIsInside).toBe(true)
      await page.keyboard.press('Tab')
      await expect.poll(focusIsInside).toBe(true)

      const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze()
      expect(results.violations).toEqual([])

      await page.keyboard.press('Escape')
      await expect(dialog).toBeHidden()
      await expect(exportButton).toBeFocused()
    })
  })
}

function strFromU8(bytes: Uint8Array | undefined): string {
  if (!bytes) throw new Error('Expected export-report.txt in batch archive')
  return new TextDecoder().decode(bytes)
}
