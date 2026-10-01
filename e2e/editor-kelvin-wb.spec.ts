import { test, expect } from './helpers/fixtures'
import { selectBaseFilm, selectAdvancedRecipe } from './helpers/upload'

test.describe('Editor — Kelvin White Balance', () => {
  const tuningOverlay = (page: import('@playwright/test').Page) =>
    page.getByRole('region', { name: 'Advanced settings', exact: true })

  const selectAndOpen = async (page: import('@playwright/test').Page) => {
    await selectBaseFilm(page)
    await page.getByRole('button', { name: 'Open Advanced settings' }).click()
    await tuningOverlay(page).getByRole('tab', { name: 'Manual', exact: true }).click()
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
    await selectBaseFilm(page, 'Classic Chrome')
    await selectAdvancedRecipe(page, 'Classic Color', false)
    await tuningOverlay(page).getByRole('tab', { name: 'Manual', exact: true }).click()

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
