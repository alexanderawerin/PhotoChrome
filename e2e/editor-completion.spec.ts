import { clickEditorAction, chooseImage } from './helpers/editor-controls'
import { readFile } from 'node:fs/promises'
import sharp from 'sharp'
import { unzipSync } from 'fflate'
import AxeBuilder from '@axe-core/playwright'
import type { Locator, Page } from '@playwright/test'
import { test, expect } from './helpers/fixtures'
import {
  fixturePath,
  selectBaseFilm,
  uploadMultipleImages,
  waitForEditor,
} from './helpers/upload'

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

function currentExportButton(page: Page): Locator {
  return page.getByRole('button', { name: /^Export processed image/ })
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

async function canvasPixelHash(canvas: Locator): Promise<string> {
  return canvas.evaluate(async element => {
    if (!(element instanceof HTMLCanvasElement)) throw new Error('Expected preview canvas')
    const context = element.getContext('2d')
    if (!context) throw new Error('Preview canvas context unavailable')
    const pixels = context.getImageData(0, 0, element.width, element.height).data
    const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(pixels))
    return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2, '0')).join('')
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
    // The browser encoder is shared by every GPU/CPU export path. Importing a
    // Vite source module can instead patch a second module instance after HMR.
    const original = HTMLCanvasElement.prototype.toBlob
    let calls = 0
    // @ts-expect-error Test-only restoration hook.
    window.__restoreCompletionEncoder = () => { HTMLCanvasElement.prototype.toBlob = original }
    HTMLCanvasElement.prototype.toBlob = function (callback: BlobCallback, type?: string, quality?: unknown) {
      calls++
      if (mockMode === 'fail-all' || (mockMode === 'fail-second-call' && calls === 2)) {
        throw new Error('Forced completion export failure')
      }
      return original.call(this, callback, type, quality)
    }
  }, mode)
}

async function restoreProcessorMock(page: Page): Promise<void> {
  await page.evaluate(() => {
    // @ts-expect-error Test-only restoration hook.
    window.__restoreCompletionEncoder?.()
  })
}

async function uploadNamedBatch(page: Page): Promise<void> {
  const landscape = await readFile(fixturePath('test-image.jpg'))
  const portrait = await readFile(fixturePath('test-image-2.jpg'))
  const input = page.getByLabel('Choose photos or video to edit', { exact: true })
  await input.setInputFiles([
    { name: 'success.jpg', mimeType: 'image/jpeg', buffer: landscape },
    { name: 'failed.jpg', mimeType: 'image/jpeg', buffer: portrait },
    { name: 'original.jpg', mimeType: 'image/jpeg', buffer: landscape },
  ])
}

async function selectMobileFilm(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Films', exact: true }).click()
  await page.getByRole('button', { name: 'Select film Provia', exact: true }).click()
  await expect(currentExportButton(page)).toBeEnabled()
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

    const photo = page.getByRole('tab', { name: 'Image 2 of 2: test-image-2.jpg', exact: true, includeHidden: true })
    await chooseImage(page, 'Image 2 of 2: test-image-2.jpg')
    await expect(photo).toHaveAttribute('aria-selected', 'true')
    await selectBaseFilm(page)

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
    const savedPreview = dialog.getByRole('img', { name: `Exported photo: ${fileName}`, exact: true })
    await expect(savedPreview).toBeVisible()

    const downloadPath = await download.path()
    if (!downloadPath) throw new Error('Downloaded photo path unavailable')
    await expectDownloadedPixelsMatchPreview(await readFile(downloadPath), savedPreview)
  })

  test('batch completion includes only successful archive entries and accurate error counts', async ({ page, landingPage }) => {
    await uploadNamedBatch(page)
    await waitForEditor(page)
    await selectBaseFilm(page)

    await chooseImage(page, 'Image 2 of 3: failed.jpg')
    await selectBaseFilm(page)
    await installProcessorMock(page, 'fail-second-call')

    try {
      const downloadPromise = page.waitForEvent('download')
      await clickEditorAction(page, 'Export all photos')
      const download = await downloadPromise
      const archivePath = await download.path()
      if (!archivePath) throw new Error('Batch download path unavailable')

      const entries = unzipSync(new Uint8Array(await readFile(archivePath)))
      const jpegNames = Object.keys(entries).filter(name => name.endsWith('.jpg'))
      expect(jpegNames).toHaveLength(2)
      expect(jpegNames.some(name => name.includes('success'))).toBe(true)
      expect(jpegNames.some(name => name.includes('original'))).toBe(true)
      expect(strFromU8(entries['export-report.txt'])).toContain('failed.jpg: Forced completion export failure')
      expect(strFromU8(entries['export-report.txt'])).toContain('Skipped: 0')

      const dialog = completionDialog(page)
      await expect(dialog).toBeVisible()
      await expect(dialog).toContainText('2 exported · 1 error')
      const previews = completionPreviews(dialog)
      await expect(previews).toHaveCount(2)
      for (const name of jpegNames) {
        const savedPreview = dialog.getByRole('img', { name: `Exported photo: ${name}`, exact: true })
        await expectDownloadedPixelsMatchPreview(Buffer.from(entries[name]), savedPreview)
      }
      await expect(dialog.getByRole('img', { name: /failed\.jpg/ })).toHaveCount(0)
    } finally {
      await restoreProcessorMock(page)
    }
  })

  test('zero-success batch reports failure without a download or success completion', async ({ page, landingPage }) => {
    await uploadMultipleImages(page)
    await waitForEditor(page)
    await installProcessorMock(page, 'fail-all')
    let downloads = 0
    page.on('download', () => { downloads++ })
    try {
      await clickEditorAction(page, 'Export all photos')
      await expect(page.getByRole('alert')).toContainText('No photos were exported')
      await expect(completionDialog(page)).toHaveCount(0)
      await expect(page.getByRole('group', { name: 'Exported photos', exact: true })).toHaveCount(0)
      expect(downloads).toBe(0)
    } finally {
      await restoreProcessorMock(page)
    }
  })

  test('traps focus, blocks editor shortcuts, and restores export focus on Escape', async ({ page, editorPage }) => {
    const preview = page.locator('canvas[aria-label="Preview"]:visible')
    const beforeRecipe = await canvasPixelHash(preview)
    await selectBaseFilm(page)
    await expect.poll(() => canvasPixelHash(preview)).not.toBe(beforeRecipe)
    await expect(page.getByText('Processing...', { exact: true })).toHaveCount(0)
    const processedPreview = await canvasPixelHash(preview)
    const exportButton = currentExportButton(page)

    let downloads = 0
    page.on('download', () => { downloads++ })
    const downloadPromise = page.waitForEvent('download')
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    })
    await page.keyboard.down('Space')
    await expect.poll(() => canvasPixelHash(preview)).toBe(beforeRecipe)
    await exportButton.click()
    await downloadPromise

    const dialog = completionDialog(page)
    await expect(dialog).toBeVisible()
    await expect.poll(() => canvasPixelHash(preview)).toBe(processedPreview)
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
    await expect.poll(() => canvasPixelHash(preview)).toBe(processedPreview)
  })

  test('preserves editing on Back to editor and returns to the demo on New edit', async ({ page, editorPage }) => {
    await selectBaseFilm(page)
    const selected = page.getByRole('button', { name: 'Select film Provia', exact: true })
    await expect(selected).toHaveAttribute('aria-pressed', 'true')

    const exportButton = currentExportButton(page)
    const downloadPromise = page.waitForEvent('download')
    await exportButton.click()
    await downloadPromise

    const dialog = completionDialog(page)
    await expect(dialog).toBeVisible()
    const actions = dialog.getByRole('button')
    await expect(actions).toHaveCount(2)
    const newEdit = dialog.getByRole('button', { name: 'New edit', exact: true })
    const back = dialog.getByRole('button', { name: 'Back to editor', exact: true })
    const newEditBox = await newEdit.boundingBox()
    const backBox = await back.boundingBox()
    expect(newEditBox).not.toBeNull()
    expect(backBox).not.toBeNull()
    if (newEditBox && backBox) expect(newEditBox.x).toBeLessThan(backBox.x)

    await back.click()
    await expect(dialog).toBeHidden()
    await expect(selected).toHaveAttribute('aria-pressed', 'true')
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
      await selectMobileFilm(page)
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
