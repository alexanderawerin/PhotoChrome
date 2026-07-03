import { test, expect } from './helpers/fixtures'
import { uploadImage, uploadMultipleImages, waitForEditor } from './helpers/upload'

test.describe('Playable demo', () => {
  test('shows real demo photos, presets, compare surface, and a persistent upload CTA', async ({ page, landingPage }) => {
    await waitForEditor(page)
    await expect(page.getByRole('button', { name: 'Upload photos' })).toBeVisible()
    await expect(page.locator('[aria-label^="Apply preset"]:visible').first()).toBeVisible()
    await expect(page.locator('canvas[aria-label="Preview"]')).toBeVisible()
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

})
