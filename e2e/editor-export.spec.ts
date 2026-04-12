import { test, expect } from './helpers/fixtures'
import { selectFirstRecipe } from './helpers/upload'

test.describe('Editor — Export', () => {
  test('export triggers a download', async ({ page, editorPage }) => {
    await selectFirstRecipe(page)

    // Listen for download
    const downloadPromise = page.waitForEvent('download')

    // Click desktop export button
    const exportButton = page.locator('[aria-label*="Export processed image (Ctrl+S)"]')
    await exportButton.click()

    const download = await downloadPromise
    const filename = download.suggestedFilename()
    expect(filename).toMatch(/^photochrome_.*\.jpg$/)
  })

  test('Ctrl+S triggers export with recipe selected', async ({ page, editorPage }) => {
    await selectFirstRecipe(page)

    const downloadPromise = page.waitForEvent('download')
    await page.keyboard.press('Control+s')

    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/\.jpg$/)
  })
})
