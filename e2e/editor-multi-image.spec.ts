import { test, expect } from './helpers/fixtures'
import { fixturePath, selectFirstRecipe, waitForEditor } from './helpers/upload'

test.describe('Editor — Multi-Image Navigation', () => {
  test('discards an uncommitted inspector draft when changing photos', async ({ page, multiImageEditorPage }) => {
    await page.setViewportSize({ width: 1600, height: 900 })
    await selectFirstRecipe(page)
    const inspector = page.getByRole('complementary', { name: 'Editing inspector', exact: true })
    const highlight = inspector.getByRole('slider', { name: 'Highlight', exact: true })
    const baseline = await highlight.getAttribute('aria-valuenow')
    await highlight.focus()
    await page.keyboard.press(baseline === '4' ? 'ArrowLeft' : 'ArrowRight')
    await expect(highlight).not.toHaveAttribute('aria-valuenow', baseline!)

    const strip = page.getByRole('tablist', { name: 'Image thumbnails', exact: true })
    await strip.getByRole('tab', { name: 'Image 2 of 2: test-image-2.jpg', exact: true }).click()
    await expect(inspector.getByText('Choose a film first', { exact: true })).toBeVisible()
    await strip.getByRole('tab', { name: 'Image 1 of 2: test-image.jpg', exact: true }).click()
    await expect(highlight).toHaveAttribute('aria-valuenow', baseline!)
  })

  test('preserves the edited batch after a failed append and retries the append', async ({ page, multiImageEditorPage }) => {
    const strip = page.getByRole('tablist', { name: 'Image thumbnails', exact: true })
    const second = strip.getByRole('tab', { name: 'Image 2 of 2: test-image-2.jpg', exact: true })
    await second.click()
    await selectFirstRecipe(page)
    const selectedPreset = page.getByRole('complementary', { name: 'Preset browser' })
      .getByRole('region', { name: "Editor's Choice presets", exact: true })
      .getByRole('button', { name: /, selected$/ })
    const presetLabel = await selectedPreset.getAttribute('aria-label')

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
    await expect(selectedPreset).toHaveAttribute('aria-label', presetLabel!)
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
    await expect(selectedPreset).toHaveAttribute('aria-label', presetLabel!)
  })

  test('shows thumbnail strip with correct count', async ({ page, multiImageEditorPage }) => {
    const tablist = page.locator('[role="tablist"][aria-label="Image thumbnails"]')
    await expect(tablist).toBeVisible()

    const tabs = tablist.locator('[role="tab"]')
    await expect(tabs).toHaveCount(2)

    // First thumbnail should be selected
    await expect(tabs.first()).toHaveAttribute('aria-selected', 'true')

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

  test('clicking thumbnail switches active image', async ({ page, multiImageEditorPage }) => {
    const tabs = page.locator('[role="tablist"][aria-label="Image thumbnails"] [role="tab"]')

    // Click second thumbnail
    await tabs.nth(1).click()
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true')
    await expect(tabs.first()).toHaveAttribute('aria-selected', 'false')

    // Click first thumbnail back
    await tabs.first().click()
    await expect(tabs.first()).toHaveAttribute('aria-selected', 'true')
  })

  test('arrow key navigation between images', async ({ page, multiImageEditorPage }) => {
    const tabs = page.locator('[role="tablist"][aria-label="Image thumbnails"] [role="tab"]')

    await expect(tabs.first()).toHaveAttribute('aria-selected', 'true')

    // ArrowRight → second image
    await page.keyboard.press('ArrowRight')
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true')

    // ArrowLeft → first image
    await page.keyboard.press('ArrowLeft')
    await expect(tabs.first()).toHaveAttribute('aria-selected', 'true')
  })
})
