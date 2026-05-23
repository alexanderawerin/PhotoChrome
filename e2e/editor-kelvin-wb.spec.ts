import { test, expect } from './helpers/fixtures'
import { selectFirstRecipe } from './helpers/upload'

test.describe('Editor — Kelvin White Balance', () => {
  const tuningOverlay = (page: import('@playwright/test').Page) =>
    page.locator('.tuning-panel-overlay')

  test('WB section shows Preset/Kelvin toggle', async ({ page, editorPage }) => {
    await selectFirstRecipe(page)
    await page.locator('[aria-label^="Tune "]').first().click()
    await expect(tuningOverlay(page)).toHaveClass(/tuning-panel-open/)

    const panel = tuningOverlay(page)
    await expect(panel.getByRole('button', { name: 'White Balance Preset mode' })).toBeVisible()
    await expect(panel.getByRole('button', { name: 'White Balance Kelvin mode' })).toBeVisible()
  })

  test('switching to Kelvin mode shows slider', async ({ page, editorPage }) => {
    await selectFirstRecipe(page)
    await page.locator('[aria-label^="Tune "]').first().click()
    await expect(tuningOverlay(page)).toHaveClass(/tuning-panel-open/)

    const panel = tuningOverlay(page)
    await panel.getByRole('button', { name: 'White Balance Kelvin mode' }).click()

    // Kelvin slider should appear
    await expect(panel.locator('#slider-kelvin')).toBeVisible()
    await expect(panel.getByText(/\d+K/)).toBeVisible()
  })

  test('switching back to Preset mode hides slider', async ({ page, editorPage }) => {
    await selectFirstRecipe(page)
    await page.locator('[aria-label^="Tune "]').first().click()

    const panel = tuningOverlay(page)
    await panel.getByRole('button', { name: 'White Balance Kelvin mode' }).click()
    await expect(panel.locator('#slider-kelvin')).toBeVisible()

    await panel.getByRole('button', { name: 'White Balance Preset mode' }).click()
    // Wait for preset mode to activate before asserting slider is gone
    await expect(panel.getByText('Auto')).toBeVisible()
    await expect(panel.locator('#slider-kelvin')).not.toBeVisible()
  })
})
