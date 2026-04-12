import { test, expect } from './helpers/fixtures'
import { uploadImage, uploadMultipleImages, waitForEditor } from './helpers/upload'

test.describe('Landing Screen', () => {
  test('displays the landing screen with title and upload button', async ({ page, landingPage }) => {
    await expect(page.locator('h1')).toHaveText('Photochrome')
    await expect(page.getByRole('button', { name: 'Upload Photos or Video' })).toBeVisible()
    await expect(page.locator('footer')).toContainText('Alexander Awerin')
  })

  test('uploads a single image and transitions to editor', async ({ page, landingPage }) => {
    await uploadImage(page)
    await waitForEditor(page)

    // Editor is visible with canvas (works on both mobile and desktop)
    await expect(page.locator('canvas').first()).toBeVisible()
  })

  test('uploads multiple images and shows thumbnail strip', async ({ page, landingPage, viewport }) => {
    // Thumbnail strip is desktop-only (hidden md:block)
    test.skip(!!viewport && viewport.width < 768, 'Thumbnail strip is desktop-only')

    await uploadMultipleImages(page)
    await waitForEditor(page)

    const tablist = page.locator('[role="tablist"][aria-label="Image thumbnails"]')
    await expect(tablist).toBeVisible()
    await expect(tablist.locator('[role="tab"]')).toHaveCount(2)
  })

  test('back button returns to landing screen', async ({ page, editorPage }) => {
    await page.locator('[aria-label="Back"]').click()
    await expect(page.locator('[aria-label="Photochrome start screen"]')).toBeVisible()
    await expect(page.locator('h1')).toHaveText('Photochrome')
  })
})
