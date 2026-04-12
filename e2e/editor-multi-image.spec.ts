import { test, expect } from './helpers/fixtures'

test.describe('Editor — Multi-Image Navigation', () => {
  test('shows thumbnail strip with correct count', async ({ page, multiImageEditorPage }) => {
    const tablist = page.locator('[role="tablist"][aria-label="Image thumbnails"]')
    await expect(tablist).toBeVisible()

    const tabs = tablist.locator('[role="tab"]')
    await expect(tabs).toHaveCount(2)

    // First thumbnail should be selected
    await expect(tabs.first()).toHaveAttribute('aria-selected', 'true')
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
