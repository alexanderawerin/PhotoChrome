import { clickEditorAction, navigateImage } from './helpers/editor-controls'
import { readFile } from 'node:fs/promises'
import sharp from 'sharp'
import { strFromU8, unzipSync } from 'fflate'
import type { Page } from '@playwright/test'
import { test, expect } from './helpers/fixtures'

const preview = (page: Page) => page.locator('canvas[aria-label="Preview"]')
const exportAll = (page: Page) => page.getByRole('button', { name: 'Export all photos', exact: true, includeHidden: true })
const applyAll = (page: Page) => page.getByRole('button', { name: 'Apply current color to all 2 images', exact: true, includeHidden: true })

async function capturePreview(page: Page) {
  await expect(exportAll(page)).toBeEnabled()
  const png = await preview(page).evaluate((canvas: HTMLCanvasElement) => canvas.toDataURL('image/png'))
  return Buffer.from(png.split(',')[1], 'base64')
}

async function archive(page: Page) {
  const pending = page.waitForEvent('download')
  await clickEditorAction(page, 'Export all photos')
  const download = await pending
  expect(download.suggestedFilename()).toMatch(/^photochrome_batch_.+\.zip$/)
  const file = await download.path()
  if (!file) throw new Error('ZIP download unavailable')
  const entries = unzipSync(new Uint8Array(await readFile(file)))
  await expect(page.getByRole('dialog', { name: 'Export complete', exact: true })).toContainText('2 exported')
  expect(Object.keys(entries).filter(name => name.endsWith('.jpg'))).toHaveLength(2)
  expect(entries['export-report.txt']).toBeUndefined()
  return entries
}

async function matchesPreview(jpeg: Uint8Array, png: Buffer, dimensions: number[], profileId: string) {
  const metadata = await sharp(jpeg).metadata()
  expect(metadata.format).toBe('jpeg')
  expect([metadata.width, metadata.height]).toEqual(dimensions)
  expect(metadata.exif?.toString('latin1')).toContain(`"id":"${profileId}"`)
  const actual = await sharp(jpeg).removeAlpha().raw().toBuffer()
  const reference = await sharp(png).removeAlpha().raw().toBuffer()
  expect(actual.length).toBe(reference.length)
  // JPEG compression and the bottom watermark are expected output differences.
  const meanDifference = actual.reduce((sum: number, value: number, index: number) => sum + Math.abs(value - reference[index]), 0) / actual.length
  expect(meanDifference).toBeLessThan(5)
}

test('Export all includes geometry-only Original and a film photo with matching JPEGs and metadata', async ({ page, multiImageEditorPage }) => {
  await page.keyboard.press('r')
  await expect.poll(() => preview(page).evaluate((canvas: HTMLCanvasElement) => [canvas.width, canvas.height])).toEqual([150, 200])
  const first = await capturePreview(page)
  await navigateImage(page, 'next')
  await page.getByRole('button', { name: 'Select film Classic Neg', exact: true }).click()
  const second = await capturePreview(page)
  const entries = await archive(page)
  await matchesPreview(entries['photochrome_original_test-image.jpg'], first, [150, 200], 'original')
  await matchesPreview(entries['photochrome_base-classic-neg_test-image-2.jpg'], second, [150, 200], 'base-classic-neg')
  await expect(page.getByRole('group', { name: 'Exported photos', exact: true }).getByRole('img')).toHaveCount(2)
})

test('Apply to all copies committed manual color and preserves each composition', async ({ page, multiImageEditorPage }) => {
  await page.keyboard.press('r')
  await expect.poll(() => preview(page).evaluate((canvas: HTMLCanvasElement) => canvas.width)).toBe(150)
  await navigateImage(page, 'next')
  await page.getByRole('button', { name: 'Select film Classic Neg', exact: true }).click()
  await page.getByRole('button', { name: 'Open Advanced settings', exact: true }).click()
  const advanced = page.getByRole('region', { name: 'Advanced settings', exact: true })
  await advanced.getByRole('tab', { name: 'Manual', exact: true }).click()
  const color = advanced.getByRole('slider', { name: 'Color', exact: true })
  await color.focus()
  await page.keyboard.press('ArrowRight')
  await expect(color).toHaveAttribute('aria-valuenow', '1')
  await expect(applyAll(page)).toHaveCount(0)
  await expect(exportAll(page)).toHaveCount(0)
  await advanced.getByRole('button', { name: 'Apply', exact: true }).click()
  await expect(page.getByLabel('Applied color', { exact: true })).toContainText('Modified')
  await clickEditorAction(page, 'Apply current color to all 2 images')
  await expect(page.getByRole('status', { name: 'Applying preset to all images', exact: true })).toBeHidden()
  const second = await capturePreview(page)
  await navigateImage(page, 'previous')
  await expect(page.getByLabel('Applied color', { exact: true })).toContainText('Modified')
  const first = await capturePreview(page)
  const entries = await archive(page)
  await matchesPreview(entries['photochrome_base-classic-neg_test-image.jpg'], first, [150, 200], 'base-classic-neg')
  await matchesPreview(entries['photochrome_base-classic-neg_test-image-2.jpg'], second, [150, 200], 'base-classic-neg')
  for (const entry of Object.values(entries)) expect((await sharp(entry).metadata()).exif?.toString('latin1')).toContain('"color":1')
})

test('Apply Original to all removes color while retaining separate geometry', async ({ page, multiImageEditorPage }) => {
  await page.keyboard.press('r')
  await page.getByRole('button', { name: 'Select film Classic Neg', exact: true }).click()
  await expect(exportAll(page)).toBeEnabled()
  await navigateImage(page, 'next')
  await expect(page.getByRole('button', { name: 'Select Original', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(applyAll(page)).toBeEnabled()
  await clickEditorAction(page, 'Apply current color to all 2 images')
  await expect(page.getByRole('status', { name: 'Applying preset to all images', exact: true })).toBeHidden()
  const second = await capturePreview(page)
  await navigateImage(page, 'previous')
  await expect(page.getByRole('button', { name: 'Select Original', exact: true })).toHaveAttribute('aria-pressed', 'true')
  const first = await capturePreview(page)
  const entries = await archive(page)
  await matchesPreview(entries['photochrome_original_test-image.jpg'], first, [150, 200], 'original')
  await matchesPreview(entries['photochrome_original_test-image-2.jpg'], second, [150, 200], 'original')
})

test('partial failure ZIP contains only saved JPEGs and reports the actual completion counts', async ({ page, multiImageEditorPage }) => {
  await page.evaluate(() => {
    const original = Worker.prototype.postMessage
    let calls = 0
    Worker.prototype.postMessage = function (message: unknown, transfer: Transferable[] | StructuredSerializeOptions = []) {
      const request = message as { type?: string; requestId?: string }
      if (request.type === 'process' && calls++ === 0) {
        queueMicrotask(() => this.dispatchEvent(new MessageEvent('message', { data: {
          type: 'error', requestId: request.requestId, message: 'First photo processing failed',
        } })))
        return
      }
      return original.call(this, message, Array.isArray(transfer) ? { transfer } : transfer)
    }
  })
  const pending = page.waitForEvent('download')
  await clickEditorAction(page, 'Export all photos')
  const path = await (await pending).path()
  if (!path) throw new Error('ZIP download unavailable')
  const entries = unzipSync(new Uint8Array(await readFile(path)))
  expect(Object.keys(entries).sort()).toEqual(['export-report.txt', 'photochrome_original_test-image-2.jpg'])
  expect(strFromU8(entries['export-report.txt'])).toContain('test-image.jpg: First photo processing failed')
  const metadata = await sharp(entries['photochrome_original_test-image-2.jpg']).metadata()
  expect([metadata.format, metadata.width, metadata.height]).toEqual(['jpeg', 150, 200])
  await expect(page.getByRole('dialog', { name: 'Export complete', exact: true })).toContainText('1 exported · 1 error')
  await expect(page.getByRole('group', { name: 'Exported photos', exact: true }).getByRole('img')).toHaveCount(1)
})

test('zero successful files produce no ZIP and batch Retry saves the original request', async ({ page, multiImageEditorPage }) => {
  await page.keyboard.press('r')
  await expect.poll(() => preview(page).evaluate((canvas: HTMLCanvasElement) => [canvas.width, canvas.height])).toEqual([150, 200])
  const first = await capturePreview(page)
  await navigateImage(page, 'next')
  const second = await capturePreview(page)
  await page.evaluate(() => {
    const original = Worker.prototype.postMessage
    // @ts-expect-error Test restoration closure matches existing engine-boundary regressions.
    window.__restoreBatchFilmProcessor = () => { Worker.prototype.postMessage = original }
    Worker.prototype.postMessage = function (message: unknown, transfer: Transferable[] | StructuredSerializeOptions = []) {
      const request = message as { type?: string; requestId?: string }
      if (request.type === 'process') {
        queueMicrotask(() => this.dispatchEvent(new MessageEvent('message', { data: {
          type: 'error', requestId: request.requestId, message: 'Processing unavailable',
        } })))
        return
      }
      return original.call(this, message, Array.isArray(transfer) ? { transfer } : transfer)
    }
  })
  let downloads = 0
  page.on('download', () => { downloads++ })
  await clickEditorAction(page, 'Export all photos')
  const alert = page.getByRole('alert')
  await expect(alert).toContainText('No photos were exported')
  expect(downloads).toBe(0)
  await expect(page.getByRole('dialog', { name: 'Export complete', exact: true })).toHaveCount(0)
  await page.evaluate(() => {
    // @ts-expect-error Engine-boundary test restoration closure.
    window.__restoreBatchFilmProcessor()
  })
  await page.getByRole('button', { name: 'Select film Classic Neg', exact: true }).click()
  await expect(exportAll(page)).toBeEnabled()
  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
  })
  await page.keyboard.press('r')
  await expect.poll(() => preview(page).evaluate((canvas: HTMLCanvasElement) => [canvas.width, canvas.height])).toEqual([200, 150])
  const pending = page.waitForEvent('download')
  await alert.getByRole('button', { name: 'Retry', exact: true }).click()
  const path = await (await pending).path()
  if (!path) throw new Error('ZIP download unavailable')
  const entries = unzipSync(new Uint8Array(await readFile(path)))
  expect(Object.keys(entries).sort()).toEqual(['photochrome_original_test-image-2.jpg', 'photochrome_original_test-image.jpg'])
  await matchesPreview(entries['photochrome_original_test-image.jpg'], first, [150, 200], 'original')
  await matchesPreview(entries['photochrome_original_test-image-2.jpg'], second, [150, 200], 'original')
  await expect(page.getByRole('dialog', { name: 'Export complete', exact: true })).toContainText('2 exported')
  expect(downloads).toBe(1)
})
