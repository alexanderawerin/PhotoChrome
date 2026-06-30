import { test, expect } from './helpers/fixtures'
import { selectFirstRecipe } from './helpers/upload'

async function mockPhotoExportFailure(page: import('@playwright/test').Page, errorName = 'Error') {
  await page.evaluate(async (name) => {
    // @ts-expect-error Vite browser module path is unavailable to the Node compiler.
    const { ImageProcessor } = await import('/src/engine/processor.ts')
    const original = ImageProcessor.processAsync
    // @ts-expect-error Test-only restoration hook.
    window.__restorePhotoExport = () => { ImageProcessor.processAsync = original }
    ImageProcessor.processAsync = async () => {
      if (name === 'AbortError') throw new DOMException('Cancelled by user', 'AbortError')
      throw new Error('Forced worker failure')
    }
  }, errorName)
}

test.describe('Photo export recovery', () => {
  test('shows a dismissible alert and Retry succeeds after the worker recovers', async ({ page, editorPage }) => {
    await selectFirstRecipe(page)
    await mockPhotoExportFailure(page)

    await page.locator('[aria-label*="Export processed image (Ctrl+S)"]').click()
    const alert = page.getByRole('alert')
    await expect(alert).toContainText('Forced worker failure')

    await alert.getByRole('button', { name: 'Dismiss' }).click()
    await expect(alert).toHaveCount(0)

    await page.locator('[aria-label*="Export processed image (Ctrl+S)"]').click()
    await expect(alert).toBeVisible()
    await page.evaluate(() => {
      // @ts-expect-error Test-only restoration hook.
      window.__restorePhotoExport()
    })

    const downloadPromise = page.waitForEvent('download')
    await alert.getByRole('button', { name: 'Retry' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/^photochrome_.+\.jpg$/)
    await expect(alert).toHaveCount(0)
  })

  test('does not present user cancellation as an error', async ({ page, editorPage }) => {
    await selectFirstRecipe(page)
    await mockPhotoExportFailure(page, 'AbortError')

    await page.locator('[aria-label*="Export processed image (Ctrl+S)"]').click()
    await expect(page.getByRole('alert')).toHaveCount(0)
  })
})
