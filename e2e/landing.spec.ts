import { test, expect } from './helpers/fixtures'
import { fixturePath, uploadImage, uploadMultipleImages, waitForEditor } from './helpers/upload'

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

    // Editor is visible with its preview canvas on both mobile and desktop.
    await expect(page.locator('canvas[aria-label="Preview"]')).toBeVisible()
  })

  test('keeps the current editor visible and previews the selected photo while decoding', async ({ page, landingPage }) => {
    await waitForEditor(page)

    await page.evaluate(() => {
      const original = window.createImageBitmap
      let release!: () => void
      const gate = new Promise<void>(resolve => { release = resolve })
      // @ts-expect-error Test-only decode gate.
      window.__releaseImageDecode = release
      // @ts-expect-error Test-only restoration hook.
      window.__restoreCreateImageBitmap = () => { window.createImageBitmap = original }
      window.createImageBitmap = new Proxy(original, {
        apply: (target, thisArg, args) => gate.then(() => Reflect.apply(target, thisArg, args)),
      })
    })

    await page.locator('input[aria-label="Choose photos or video to edit"]').setInputFiles(fixturePath('test-image.jpg'))

    const loading = page.getByRole('status', { name: 'Loading image' })
    await expect(loading).toBeVisible()
    await expect(page.locator('.loading-preview')).toBeVisible()
    await expect(page.locator('.loading-preview')).toHaveAttribute('src', /^blob:/)
    await expect(page.locator('canvas[aria-label="Preview"]')).toBeVisible()
    await expect(page.getByRole('main', { name: 'Photochrome start screen' })).toHaveCount(0)
    await expect(page.locator('.contents[inert]')).toHaveCount(1)
    await page.keyboard.press('c')
    await expect(page.locator('[role="slider"][aria-label="Crop angle"]:visible')).toHaveCount(0)

    await page.evaluate(() => {
      // @ts-expect-error Test-only decode gate.
      window.__releaseImageDecode()
    })
    await expect(loading).toBeHidden()
    await expect(page.locator('.loading-preview')).toHaveCount(0)
    await page.evaluate(() => {
      // @ts-expect-error Test-only restoration hook.
      window.__restoreCreateImageBitmap()
    })
    await page.keyboard.press('c')
    await expect(page.locator('[role="slider"][aria-label="Crop angle"]:visible')).toHaveCount(1)
  })

  test('retries a failed image load with the originally selected photo', async ({ page, landingPage }) => {
    await waitForEditor(page)

    await page.evaluate(() => {
      const original = window.createImageBitmap
      let failed = false
      // @ts-expect-error Test-only restoration hook.
      window.__restoreCreateImageBitmap = () => { window.createImageBitmap = original }
      window.createImageBitmap = new Proxy(original, {
        apply(target, thisArg, args) {
          if (!failed) {
            failed = true
            return Promise.reject(new Error('Forced image decode failure'))
          }
          return Reflect.apply(target, thisArg, args)
        },
      })
    })

    await page.locator('input[aria-label="Choose photos or video to edit"]').setInputFiles(fixturePath('test-image.jpg'))
    await expect(page.locator('[data-slot="empty-title"]')).toContainText('Failed to load image')

    await page.evaluate(() => {
      // @ts-expect-error Test-only restoration hook.
      window.__restoreCreateImageBitmap()
    })
    await page.getByRole('button', { name: 'Retry' }).click()
    await waitForEditor(page)
    await expect(page.locator('p:visible').filter({ hasText: 'test-image.jpg' })).toHaveCount(1)
  })

  test('retries a failed video load as video and exposes video recovery input', async ({ page, landingPage }) => {
    await waitForEditor(page)

    await page.evaluate(() => {
      const originalCreateObjectURL = URL.createObjectURL
      let failed = false
      // @ts-expect-error Test-only restoration hook.
      window.__restoreVideoObjectURL = () => { URL.createObjectURL = originalCreateObjectURL }
      URL.createObjectURL = (blob: Blob | MediaSource) => {
        if (!failed && blob instanceof File && blob.type.startsWith('video/')) {
          failed = true
          const invalidUrl = originalCreateObjectURL(new Blob(['invalid video'], { type: 'video/mp4' }))
          URL.revokeObjectURL(invalidUrl)
          return invalidUrl
        }
        return originalCreateObjectURL(blob)
      }
    })

    await page.locator('input[aria-label="Choose photos or video to edit"]').setInputFiles(fixturePath('test-video.mp4'))
    const loading = page.getByRole('status', { name: 'Loading video' })
    await expect(loading).toBeVisible()
    await expect(page.locator('canvas[aria-label="Preview"]')).toBeVisible()
    await expect(page.locator('[data-slot="empty-title"]')).toContainText('Failed to load video')
    const chooseAnother = page.getByLabel('Choose another video')
    await expect(chooseAnother).toHaveAttribute('accept', expect.stringContaining('video/mp4'))

    await page.evaluate(() => {
      // @ts-expect-error Test-only restoration hook.
      window.__restoreVideoObjectURL()
    })
    await page.getByRole('button', { name: 'Retry' }).click()
    await expect(page.getByText('3s • 640×360')).toBeVisible()
    await expect(page.locator('[data-slot="empty-title"]')).toHaveCount(0)
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
