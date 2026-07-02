import { test, expect } from './helpers/fixtures'
import { selectFirstRecipe } from './helpers/upload'

test.describe('Editor — Basic Flow', () => {
  test('shows editor UI with canvas and preset browser while inspector starts hidden', async ({ page, editorPage }) => {
    await expect(page.locator('canvas[aria-label="Preview"]')).toBeVisible()
    await expect(page.getByRole('complementary', { name: 'Preset browser' })).toBeVisible()
    await expect(page.getByRole('complementary', { name: 'Editing inspector' })).toBeHidden()
  })

  test('displays recipe cards in the panel', async ({ page, editorPage }) => {
    // Count only in desktop side panel
    const cards = page.locator('aside [aria-label^="Apply preset"]')
    const count = await cards.count()
    expect(count).toBeGreaterThan(10) // We have ~52 recipes
  })

  test('selects a recipe and shows tune button', async ({ page, editorPage }) => {
    await expect(page.getByRole('button', { name: 'Open Adjust inspector' })).toBeDisabled()

    // Click first recipe in desktop panel
    await selectFirstRecipe(page)

    await expect(page.getByRole('button', { name: 'Open Adjust inspector' })).toBeEnabled()
  })

  test('export button is disabled without recipe', async ({ page, editorPage }) => {
    // Desktop export button (includes keyboard hint)
    const exportButton = page.locator('[aria-label*="Export processed image (Ctrl+S)"]')
    await expect(exportButton).toBeDisabled()
  })

  test('export button enables after selecting recipe', async ({ page, editorPage }) => {
    await selectFirstRecipe(page)
    const exportButton = page.locator('[aria-label*="Export processed image (Ctrl+S)"]')
    await expect(exportButton).toBeEnabled()
  })

  test('toggle inspector visibility without hiding presets', async ({ page, editorPage }) => {
    await selectFirstRecipe(page)
    const show = page.getByRole('button', { name: 'Open Adjust inspector' })
    await show.click()
    await expect(page.getByRole('complementary', { name: 'Editing inspector' })).toBeVisible()

    await page.getByRole('button', { name: 'Close Adjust inspector' }).click()
    await page.waitForTimeout(400)
    await show.click()
    await page.waitForTimeout(400)
    await expect(page.getByRole('complementary', { name: 'Preset browser' })).toBeVisible()
  })
})

test.describe('Editor — Wide Desktop', () => {
  test.use({ viewport: { width: 1600, height: 900 } })

  test('pins the Adjust inspector and removes its toggle', async ({ page, editorPage }) => {
    await expect(page.getByRole('complementary', { name: 'Editing inspector' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Open Adjust inspector' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Close Adjust inspector' })).toHaveCount(0)
  })
})
