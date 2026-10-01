import { test, expect } from './helpers/fixtures'
import { selectBaseFilm } from './helpers/upload'
import sharp from 'sharp'

test.describe('Editor — Export', () => {
  test('export triggers a download', async ({ page, editorPage }) => {
    await selectBaseFilm(page)

    // Listen for download
    const downloadPromise = page.waitForEvent('download')

    // Click desktop export button
    const exportButton = page.getByRole('button', { name: 'Export processed image (Ctrl+S)', exact: true })
    await exportButton.click()

    const download = await downloadPromise
    const filename = download.suggestedFilename()
    expect(filename).toMatch(/^photochrome_.*\.jpg$/)
    const file = await download.path()
    if (!file) throw new Error('JPEG download unavailable')
    const metadata = await sharp(file).metadata()
    expect([metadata.format, metadata.width, metadata.height]).toEqual(['jpeg', 200, 150])
    const completion = page.getByRole('dialog', { name: 'Export complete' })
    await expect(completion).toBeVisible()
    await completion.getByRole('button', { name: 'Back to editor' }).click()
    await expect(completion).toBeHidden()
  })

  test('Ctrl+S triggers export with a base film selected', async ({ page, editorPage }) => {
    await selectBaseFilm(page)

    const downloadPromise = page.waitForEvent('download')
    await page.keyboard.press('Control+s')

    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/\.jpg$/)
  })
})
