import { test, expect } from './helpers/fixtures'
import { selectBaseFilm } from './helpers/upload'
import sharp from 'sharp'

async function mockPhotoExportFailure(page: import('@playwright/test').Page, errorName = 'Error') {
  await page.evaluate((name) => {
    const original = Worker.prototype.postMessage
    const originalEncoder = HTMLCanvasElement.prototype.toBlob
    // @ts-expect-error Test-only restoration hook.
    window.__restorePhotoExport = () => {
      Worker.prototype.postMessage = original
      HTMLCanvasElement.prototype.toBlob = originalEncoder
    }
    if (name === 'AbortError') {
      HTMLCanvasElement.prototype.toBlob = () => { throw new DOMException('Cancelled by user', 'AbortError') }
      return
    }
    Worker.prototype.postMessage = function (message: unknown, transfer: Transferable[] | StructuredSerializeOptions = []) {
      const request = message as { type?: string; requestId?: string }
      if (request.type === 'process') {
        queueMicrotask(() => this.dispatchEvent(new MessageEvent('message', { data: {
          type: 'error', requestId: request.requestId, message: 'Forced worker failure',
        } })))
        return
      }
      return original.call(this, message, Array.isArray(transfer) ? { transfer } : transfer)
    }
  }, errorName)
}

test.describe('Photo export recovery', () => {
  test('shows a dismissible alert and Retry succeeds after the worker recovers', async ({ page, editorPage }) => {
    await selectBaseFilm(page)
    await mockPhotoExportFailure(page)

    await page.getByRole('button', { name: 'Export processed image (Ctrl+S)', exact: true }).click()
    const alert = page.getByRole('alert')
    await expect(alert).toContainText('Forced worker failure')

    await alert.getByRole('button', { name: 'Dismiss' }).click()
    await expect(alert).toHaveCount(0)

    await page.getByRole('button', { name: 'Export processed image (Ctrl+S)', exact: true }).click()
    await expect(alert).toBeVisible()
    // Recovery retains the failed export's film even after the live edit changes.
    await page.getByRole('button', { name: 'Select Original', exact: true }).click()
    await page.evaluate(() => {
      // @ts-expect-error Test-only restoration hook.
      window.__restorePhotoExport()
    })

    const downloadPromise = page.waitForEvent('download')
    await alert.getByRole('button', { name: 'Retry' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/^photochrome_.+\.jpg$/)
    expect(download.suggestedFilename()).toContain('base-provia')
    const file = await download.path()
    if (!file) throw new Error('Retry JPEG path unavailable')
    const metadata = await sharp(file).metadata()
    expect([metadata.format, metadata.width, metadata.height]).toEqual(['jpeg', 200, 150])
    expect(metadata.exif?.toString('latin1')).toContain('"id":"base-provia"')
    await expect(alert).toHaveCount(0)
  })

  test('does not present user cancellation as an error', async ({ page, editorPage }) => {
    await selectBaseFilm(page)
    await mockPhotoExportFailure(page, 'AbortError')

    await page.getByRole('button', { name: 'Export processed image (Ctrl+S)', exact: true }).click()
    await expect(page.getByRole('alert')).toHaveCount(0)
  })
})
