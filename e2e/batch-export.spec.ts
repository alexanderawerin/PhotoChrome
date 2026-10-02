import { clickEditorAction } from './helpers/editor-controls'
import { readFile } from 'node:fs/promises'
import { unzipSync } from 'fflate'
import { test, expect } from './helpers/fixtures'
import { selectBaseFilm, uploadMultipleImages, waitForEditor } from './helpers/upload'

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

test('Export all creates a stored-JPEG ZIP including Original photos', async ({ page, landingPage }) => {
  await uploadMultipleImages(page)
  await waitForEditor(page)
  await selectBaseFilm(page)

  const downloadPromise = page.waitForEvent('download')
  await clickEditorAction(page, 'Export all photos')
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/^photochrome_batch_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}\.zip$/)

  const path = await download.path()
  if (!path) throw new Error('Batch download path unavailable')
  const bytes = new Uint8Array(await readFile(path))
  const entries = unzipSync(bytes)
  const jpegNames = Object.keys(entries).filter(name => name.endsWith('.jpg'))
  expect(jpegNames).toHaveLength(2)
  expect(entries[jpegNames[0]].slice(0, 2)).toEqual(new Uint8Array([0xff, 0xd8]))
  expect(entries['photochrome_original_test-image-2.jpg']).toBeDefined()
  expect(entries['export-report.txt']).toBeUndefined()

  const methods = storedCompressionMethods(bytes)
  expect(methods.get(jpegNames[0]), 'JPEG must use ZIP method 0 (stored)').toBe(0)
  await expect(page.getByRole('status', { name: 'Batch export progress' })).toBeHidden()
  await expect(page.getByRole('dialog', { name: 'Export complete' })).toContainText('2 exported')
})

test('cancelling batch export destroys the partial archive and does not download', async ({ page, landingPage }) => {
  await uploadMultipleImages(page)
  await waitForEditor(page)
  await selectBaseFilm(page)
  await clickEditorAction(page, 'Apply current color to all 2 images')
  await expect(page.getByRole('status', { name: 'Applying preset to all images', exact: true })).toBeHidden()

  await page.evaluate(() => {
    const original = Worker.prototype.postMessage
    // @ts-expect-error Test-only restoration hook.
    window.__restoreBatchProcessor = () => { Worker.prototype.postMessage = original }
    Worker.prototype.postMessage = function (message: unknown, transfer: Transferable[] | StructuredSerializeOptions = []) {
      if ((message as { type?: string }).type === 'process') {
        // @ts-expect-error Observed browser worker boundary, not an editor API.
        window.__batchWorkerRequestSeen = true
        return
      }
      return original.call(this, message, Array.isArray(transfer) ? { transfer } : transfer)
    }
  })

  let downloaded = false
  page.on('download', () => { downloaded = true })
  await clickEditorAction(page, 'Export all photos')
  const progress = page.getByRole('status', { name: 'Batch export progress' })
  await expect(progress).toBeVisible()
  await page.waitForFunction(() => {
    // @ts-expect-error Observed browser worker request.
    return window.__batchWorkerRequestSeen === true
  })
  await progress.getByRole('button', { name: 'Cancel' }).click()
  await expect(progress).toBeHidden()
  await page.waitForTimeout(500)
  expect(downloaded).toBe(false)

  await page.evaluate(() => {
    // @ts-expect-error Test-only restoration hook.
    window.__restoreBatchProcessor()
  })
})
