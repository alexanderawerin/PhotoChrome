import { test, expect } from './helpers/fixtures'
import { selectFirstRecipe } from './helpers/upload'

test.describe('Editor — Basic Flow', () => {
  test('shows editor UI with canvas, toolbar, and recipe panel', async ({ page, editorPage }) => {
    await expect(page.locator('canvas').first()).toBeVisible()
    // Desktop toolbar (first in DOM)
    await expect(page.locator('[role="toolbar"][aria-label="Editing tools"]').first()).toBeVisible()
    // Recipe cards in the desktop aside panel
    await expect(page.locator('aside [aria-label^="Apply preset"]').first()).toBeVisible()
  })

  test('displays recipe cards in the panel', async ({ page, editorPage }) => {
    // Count only in desktop side panel
    const cards = page.locator('aside [aria-label^="Apply preset"]')
    const count = await cards.count()
    expect(count).toBeGreaterThan(10) // We have ~52 recipes
  })

  test('selects a recipe and shows tune button', async ({ page, editorPage }) => {
    // Before selection — desktop toolbar shows "Select preset" placeholder
    const desktopToolbar = page.locator('.hidden.md\\:block [role="toolbar"], .hidden.md\\:block').first()
    await expect(page.getByText('Select preset').first()).toBeVisible()

    // Click first recipe in desktop panel
    await selectFirstRecipe(page)

    // Tune button with recipe name should appear in desktop toolbar
    await expect(page.locator('[aria-label^="Tune "]').first()).toBeVisible()
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

  test('toggle side panel visibility', async ({ page, editorPage }) => {
    const toggle = page.locator('[aria-label="Hide panel"], [aria-label="Show panel"]')
    // Initially panel is open — recipe cards are visible in aside
    await expect(page.locator('aside [aria-label^="Apply preset"]').first()).toBeVisible()

    // Click to hide
    await toggle.click()
    await page.waitForTimeout(400)

    // Click to show
    await toggle.click()
    await page.waitForTimeout(400)
    await expect(page.locator('aside [aria-label^="Apply preset"]').first()).toBeVisible()
  })
})
