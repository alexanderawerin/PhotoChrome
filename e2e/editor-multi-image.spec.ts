import { navigateImage } from './helpers/editor-controls'
import { previewPixels } from './helpers/advanced'
import { test, expect } from './helpers/fixtures'
import { fixturePath, selectBaseFilm, waitForEditor } from './helpers/upload'

test.describe('Editor — Multi-Image Navigation', () => {
  test('discards an uncommitted inspector draft when changing photos', async ({ page, multiImageEditorPage }) => {
    await page.setViewportSize({ width: 1600, height: 900 })
    await selectBaseFilm(page)
    await page.getByRole('button', { name: 'Open Advanced settings', exact: true }).click()
    await page.getByRole('region', { name: 'Advanced settings', exact: true }).getByRole('tab', { name: 'Manual', exact: true }).click()
    const inspector = page.getByRole('region', { name: 'Advanced settings', exact: true })
    const highlight = inspector.getByRole('slider', { name: 'Highlight', exact: true })
    const baseline = await highlight.getAttribute('aria-valuenow')
    await highlight.focus()
    await page.keyboard.press(baseline === '4' ? 'ArrowLeft' : 'ArrowRight')
    await expect(highlight).not.toHaveAttribute('aria-valuenow', baseline!)

    await navigateImage(page, 'next')
    await expect(inspector).toHaveCount(0)
    await expect(page.getByLabel('Applied color', { exact: true })).toContainText('Original')
    await navigateImage(page, 'previous')
    await page.getByRole('button', { name: 'Open Advanced settings', exact: true }).click()
    await inspector.getByRole('tab', { name: 'Manual', exact: true }).click()
    await expect(highlight).toHaveAttribute('aria-valuenow', baseline!)
  })

  test('preserves the edited batch after a failed append and retries the append', async ({ page, multiImageEditorPage }) => {
    await navigateImage(page, 'next')
    await selectBaseFilm(page)
    const beforeAppend = await previewPixels(page, 'photo')
    const selectedFilm = page.getByRole('button', { name: 'Select film Provia', exact: true })

    await page.evaluate(() => {
      const original = window.createImageBitmap
      window.createImageBitmap = new Proxy(original, {
        apply() {
          window.createImageBitmap = original
          return Promise.reject(new Error('Forced append failure'))
        },
      })
    })
    await page.getByLabel('Add photos to current batch', { exact: true }).setInputFiles(fixturePath('test-image.jpg'))
    await expect(page.getByRole('alert')).toContainText('Failed to load image')
    await page.getByRole('button', { name: 'Back to editor', exact: true }).click()
    await expect(selectedFilm).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(() => previewPixels(page, 'photo')).toBe(beforeAppend)
    await expect(page.getByRole('button', { name: 'Apply current color to all 2 images', exact: true, includeHidden: true })).toHaveCount(1)

    await page.evaluate(() => {
      const original = window.createImageBitmap
      window.createImageBitmap = new Proxy(original, {
        apply() {
          window.createImageBitmap = original
          return Promise.reject(new Error('Forced append retry'))
        },
      })
    })
    await page.getByLabel('Add photos to current batch', { exact: true }).setInputFiles(fixturePath('test-image.jpg'))
    await expect(page.getByRole('alert')).toContainText('Failed to load image')
    await page.getByRole('button', { name: 'Retry', exact: true }).click()
    await waitForEditor(page)
    await expect(selectedFilm).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(() => previewPixels(page, 'photo')).toBe(beforeAppend)
    await expect(page.getByRole('button', { name: 'Apply current color to all 3 images', exact: true, includeHidden: true })).toHaveCount(1)
  })

  test('places the single mode switch in the header and photo navigation on the stage', async ({ page, multiImageEditorPage }) => {
    const header = page.locator('header')
    await expect(header.getByRole('navigation', { name: 'Editor modes', exact: true })).toBeVisible()
    await expect(page.getByRole('navigation', { name: 'Editor modes', exact: true })).toHaveCount(1)
    await expect(header.getByText(/test-image|of 2/)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Choose image', exact: true })).toHaveCount(0)
    await expect(page.getByRole('tablist', { name: 'Image thumbnails', exact: true })).toHaveCount(0)
    const workspace = page.getByRole('region', { name: 'Photo workspace', exact: true })
    const previous = workspace.getByRole('button', { name: 'Previous image', exact: true })
    const next = workspace.getByRole('button', { name: 'Next image', exact: true })
    await expect(previous).toBeVisible()
    await expect(next).toBeVisible()
    await expect(header.getByRole('button', { name: /^(Previous|Next) image$/ })).toHaveCount(0)
    const photo = await page.getByLabel('Preview', { exact: true }).boundingBox()
    const left = await previous.boundingBox()
    const right = await next.boundingBox()
    expect(left!.x + left!.width).toBeLessThan(photo!.x + photo!.width / 2)
    expect(right!.x).toBeGreaterThan(photo!.x + photo!.width / 2)
  })

  test('stage navigation restores each photo selection', async ({ page, multiImageEditorPage }) => {
    await selectBaseFilm(page)
    await navigateImage(page, 'next')
    await expect(page.getByRole('button', { name: 'Select Original', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await navigateImage(page, 'previous')
    await expect(page.getByRole('button', { name: 'Select film Provia', exact: true })).toHaveAttribute('aria-pressed', 'true')
  })

  test('arrow keys navigate between photos', async ({ page, multiImageEditorPage }) => {
    const firstPixels = await previewPixels(page, 'photo')
    // Focus a non-slider surface so arrows execute the editor navigation command.
    await page.getByRole('navigation', { name: 'Editor modes', exact: true }).getByRole('button', { name: 'Films', exact: true }).focus()
    await page.keyboard.press('ArrowRight')
    await expect.poll(() => previewPixels(page, 'photo')).not.toBe(firstPixels)
    await page.keyboard.press('ArrowLeft')
    await expect.poll(() => previewPixels(page, 'photo')).toBe(firstPixels)
  })
})
