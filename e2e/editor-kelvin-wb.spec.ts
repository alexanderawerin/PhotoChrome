import { test, expect } from './helpers/fixtures'
import { selectFirstRecipe } from './helpers/upload'

test.describe('Editor — Kelvin White Balance', () => {
  const tuningOverlay = (page: import('@playwright/test').Page) =>
    page.getByRole('complementary', { name: 'Editing inspector' })

  const selectAndOpen = async (page: import('@playwright/test').Page) => {
    await selectFirstRecipe(page)
    await page.getByRole('button', { name: 'Open Adjust inspector' }).click()
  }

  test('WB section shows Preset/Kelvin toggle', async ({ page, editorPage }) => {
    await selectAndOpen(page)
    const panel = tuningOverlay(page)
    await expect(panel.getByRole('button', { name: 'White Balance Preset mode' })).toBeVisible()
    await expect(panel.getByRole('button', { name: 'White Balance Kelvin mode' })).toBeVisible()
  })

  test('switching to Kelvin mode shows slider', async ({ page, editorPage }) => {
    await selectAndOpen(page)
    const panel = tuningOverlay(page)
    await panel.getByRole('button', { name: 'White Balance Kelvin mode' }).click()

    // Kelvin slider should appear
    await expect(panel.locator('#slider-kelvin')).toBeVisible()
    await expect(panel.getByText(/\d+K/)).toBeVisible()
  })

  test('switching back to Preset mode hides slider', async ({ page, editorPage }) => {
    await selectAndOpen(page)

    const panel = tuningOverlay(page)
    await panel.getByRole('button', { name: 'White Balance Kelvin mode' }).click()
    await expect(panel.locator('#slider-kelvin')).toBeVisible()

    await panel.getByRole('button', { name: 'White Balance Preset mode' }).click()
    // Wait for preset mode to activate before asserting slider is gone
    await expect(panel.getByText('Auto')).toBeVisible()
    await expect(panel.locator('#slider-kelvin')).not.toBeVisible()
  })

  test('recipe with kelvin WB: switching to preset mode disables kelvin', async ({ page, editorPage }) => {
    // Select Classic Color — a recipe that has whiteBalanceKelvin: 5300
    // Use .first() because the card appears in both Editor's Choice and Classic Chrome sections
    const classicColorCard = page.locator('aside [aria-label="Apply preset Classic Color"]').first()
    await classicColorCard.click()
    await page.locator('aside [aria-label="Apply preset Classic Color, selected"]').first().waitFor({ state: 'visible', timeout: 10_000 })
    await page.getByRole('button', { name: 'Open Adjust inspector' }).click()

    const panel = tuningOverlay(page)

    // Recipe has whiteBalanceKelvin — panel should start in Kelvin mode
    await expect(panel.locator('#slider-kelvin')).toBeVisible()

    // Switch to Preset mode explicitly
    await panel.getByRole('button', { name: 'White Balance Preset mode' }).click()

    // Kelvin slider must disappear and preset buttons must be visible
    await expect(panel.locator('#slider-kelvin')).not.toBeVisible()
    await expect(panel.getByText('Auto')).toBeVisible()
  })
})
