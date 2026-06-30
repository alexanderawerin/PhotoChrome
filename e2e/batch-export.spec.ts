import { readFile } from 'node:fs/promises'
import { strFromU8, unzipSync } from 'fflate'
import { test, expect } from './helpers/fixtures'
import { selectFirstRecipe, uploadMultipleImages, waitForEditor } from './helpers/upload'

function storedCompressionMethods(zip: Uint8Array): Map<string, number> {
  const methods = new Map<string, number>()
  const decoder = new TextDecoder()
  for (let offset = 0; offset <= zip.length - 30; offset++) {
    if (
      zip[offset] !== 0x50 || zip[offset + 1] !== 0x4b ||
      zip[offset + 2] !== 0x03 || zip[offset + 3] !== 0x04
    ) continue
    const method = zip[offset + 8] | (zip[offset + 9] << 8)
    const nameLength = zip[offset + 26] | (zip[offset + 27] << 8)
    const name = decoder.decode(zip.subarray(offset + 30, offset + 30 + nameLength))
    methods.set(name, method)
  }
  return methods
}

test('Export all creates a stored-JPEG ZIP and reports skipped photos', async ({ page, landingPage }) => {
  await uploadMultipleImages(page)
  await waitForEditor(page)
  await selectFirstRecipe(page)

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export all photos' }).first().click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^photochrome_batch_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}\.zip$/)

  const path = await download.path()
  if (!path) throw new Error('Batch download path unavailable')
  const bytes = new Uint8Array(await readFile(path))
  const entries = unzipSync(bytes)
  const jpegNames = Object.keys(entries).filter(name => name.endsWith('.jpg'))
  expect(jpegNames).toHaveLength(1)
  expect(entries[jpegNames[0]].slice(0, 2)).toEqual(new Uint8Array([0xff, 0xd8]))
  expect(strFromU8(entries['export-report.txt'])).toContain('test-image-2.jpg: No recipe selected')

  const methods = storedCompressionMethods(bytes)
  expect(methods.get(jpegNames[0]), 'JPEG must use ZIP method 0 (stored)').toBe(0)
  await expect(page.getByRole('status', { name: 'Batch export result' })).toContainText(
    '1 exported, 1 skipped, 0 errors'
  )
})

test('cancelling batch export destroys the partial archive and does not download', async ({ page, landingPage }) => {
  await uploadMultipleImages(page)
  await waitForEditor(page)
  await selectFirstRecipe(page)
  await page.getByRole('button', { name: 'Apply current preset to all 2 images' }).first().click()
  await page.waitForTimeout(400)

  await page.evaluate(async () => {
    // @ts-expect-error Vite browser module path is unavailable to the Node compiler.
    const { ImageProcessor } = await import('/src/engine/processor.ts')
    const original = ImageProcessor.processAsync
    // @ts-expect-error Test-only restoration hook.
    window.__restoreBatchProcessor = () => { ImageProcessor.processAsync = original }
    ImageProcessor.processAsync = (_image: ImageData, _plan: unknown, options?: { signal?: AbortSignal }) => (
      new Promise((_resolve, reject) => {
        options?.signal?.addEventListener('abort', () => {
          reject(new DOMException('Cancelled', 'AbortError'))
        }, { once: true })
      })
    )
  })

  let downloaded = false
  page.on('download', () => { downloaded = true })
  await page.getByRole('button', { name: 'Export all photos' }).first().click()
  const progress = page.getByRole('status', { name: 'Batch export progress' })
  await expect(progress).toBeVisible()
  await progress.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByRole('status', { name: 'Batch export result' })).toContainText('Batch export cancelled')
  await page.waitForTimeout(500)
  expect(downloaded).toBe(false)

  await page.evaluate(() => {
    // @ts-expect-error Test-only restoration hook.
    window.__restoreBatchProcessor()
  })
})
