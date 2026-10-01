import { test, expect } from './helpers/fixtures'
import { fixturePath, selectBaseFilm, waitForEditor } from './helpers/upload'

test.describe('Editor — Multi-Image Navigation', () => {
  test('discards an uncommitted inspector draft when changing photos', async ({ page, multiImageEditorPage }) => {
    await page.setViewportSize({ width: 1600, height: 900 })
    await selectBaseFilm(page)
    await page.getByRole('button', { name: 'Open Advanced settings', exact: true }).click()
    await page.getByRole('region', { name: 'Advanced settings', exact: true }).getByRole('tab', { name: 'Manual', exact: true }).click()
    const inspector = page.getByRole('complementary', { name: 'Editing inspector', exact: true })
    const highlight = inspector.getByRole('slider', { name: 'Highlight', exact: true })
    const baseline = await highlight.getAttribute('aria-valuenow')
    await highlight.focus()
    await page.keyboard.press(baseline === '4' ? 'ArrowLeft' : 'ArrowRight')
    await expect(highlight).not.toHaveAttribute('aria-valuenow', baseline!)

    const strip = page.getByRole('tablist', { name: 'Image thumbnails', exact: true })
    await strip.getByRole('tab', { name: 'Image 2 of 2: test-image-2.jpg', exact: true }).click()
    await expect(inspector).toHaveCount(0)
    await expect(page.getByLabel('Applied color', { exact: true })).toContainText('Original')
    await strip.getByRole('tab', { name: 'Image 1 of 2: test-image.jpg', exact: true }).click()
    await page.getByRole('button', { name: 'Open Advanced settings', exact: true }).click()
    await inspector.getByRole('tab', { name: 'Manual', exact: true }).click()
    await expect(highlight).toHaveAttribute('aria-valuenow', baseline!)
  })

  test('preserves the edited batch after a failed append and retries the append', async ({ page, multiImageEditorPage }) => {
    const strip = page.getByRole('tablist', { name: 'Image thumbnails', exact: true })
    const second = strip.getByRole('tab', { name: 'Image 2 of 2: test-image-2.jpg', exact: true })
    await second.click()
    await selectBaseFilm(page)
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
    await expect(second).toHaveAttribute('aria-selected', 'true')
    await expect(selectedFilm).toHaveAttribute('aria-pressed', 'true')
    await expect(strip.getByRole('tab')).toHaveCount(2)

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
    await expect(strip.getByRole('tab')).toHaveCount(3)
    await expect(strip.getByRole('tab', { name: 'Image 2 of 3: test-image-2.jpg', exact: true })).toHaveAttribute('aria-selected', 'true')
    await expect(selectedFilm).toHaveAttribute('aria-pressed', 'true')
  })

  test('shows thumbnail strip with correct count', async ({ page, multiImageEditorPage }) => {
    const tablist = page.locator('[role="tablist"][aria-label="Image thumbnails"]')
    await expect(tablist).toBeVisible()

    const tabs = tablist.locator('[role="tab"]')
    await expect(tabs).toHaveCount(2)

    // First thumbnail should be selected
    await expect(tablist.getByRole('tab', { name: 'Image 1 of 2: test-image.jpg', exact: true })).toHaveAttribute('aria-selected', 'true')

    const actions = page.getByRole('toolbar', { name: 'Desktop editor actions' })
    await expect(actions).toBeVisible()
    const thumbnailsBox = await tablist.boundingBox()
    const actionsBox = await actions.boundingBox()
    expect(thumbnailsBox).toBeTruthy()
    expect(actionsBox).toBeTruthy()
    if (thumbnailsBox && actionsBox) {
      expect(actionsBox.y).toBeGreaterThanOrEqual(thumbnailsBox.y + thumbnailsBox.height)
    }
  })

  test('clicking thumbnail restores each photo selection', async ({ page, multiImageEditorPage }) => {
    const strip = page.getByRole('tablist', { name: 'Image thumbnails', exact: true })
    const first = strip.getByRole('tab', { name: 'Image 1 of 2: test-image.jpg', exact: true })
    const second = strip.getByRole('tab', { name: 'Image 2 of 2: test-image-2.jpg', exact: true })
    await selectBaseFilm(page)
    await second.click()
    await expect(second).toHaveAttribute('aria-selected', 'true')
    await expect(first).toHaveAttribute('aria-selected', 'false')
    await expect(page.getByRole('button', { name: 'Select Original', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await first.click()
    await expect(first).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('button', { name: 'Select film Provia', exact: true })).toHaveAttribute('aria-pressed', 'true')
  })

  test('arrow keys navigate between photos', async ({ page, multiImageEditorPage }) => {
    const strip = page.getByRole('tablist', { name: 'Image thumbnails', exact: true })
    const first = strip.getByRole('tab', { name: 'Image 1 of 2: test-image.jpg', exact: true })
    const second = strip.getByRole('tab', { name: 'Image 2 of 2: test-image-2.jpg', exact: true })
    await expect(first).toHaveAttribute('aria-selected', 'true')
    // Focus a non-slider surface so arrows execute the editor navigation command.
    await page.getByRole('button', { name: 'Help', exact: true }).focus()
    await page.keyboard.press('ArrowRight')
    await expect(second).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('ArrowLeft')
    await expect(first).toHaveAttribute('aria-selected', 'true')
  })
})
