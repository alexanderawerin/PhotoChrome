import { test, expect } from './helpers/fixtures'
import { selectFirstRecipe } from './helpers/upload'

test.describe('Editor — Tuning Panel', () => {
  // Tuning panel slides over recipe panel inside <aside>
  const tuningOverlay = (page: import('@playwright/test').Page) =>
    page.locator('.tuning-panel-overlay')

  test('tuning panel opens when tune button is clicked', async ({ page, editorPage }) => {
    await selectFirstRecipe(page)
    await page.locator('[aria-label^="Tune "]').first().click()

    // Panel should slide open
    await expect(tuningOverlay(page)).toHaveClass(/tuning-panel-open/)
    await expect(tuningOverlay(page).getByText('Highlight')).toBeVisible()
    await expect(tuningOverlay(page).getByText('Shadow')).toBeVisible()
  })

  test('tuning panel shows sliders for main parameters', async ({ page, editorPage }) => {
    await selectFirstRecipe(page)
    await page.locator('[aria-label^="Tune "]').first().click()
    await expect(tuningOverlay(page)).toHaveClass(/tuning-panel-open/)

    const panel = tuningOverlay(page)
    await expect(panel.getByText('Highlight')).toBeVisible()
    await expect(panel.getByText('Shadow')).toBeVisible()
    await expect(panel.getByText('Color', { exact: true })).toBeVisible()
    await expect(panel.getByText('Sharpness')).toBeVisible()
  })

  test('apply tuning closes the panel', async ({ page, editorPage }) => {
    await selectFirstRecipe(page)
    await page.locator('[aria-label^="Tune "]').first().click()
    await expect(tuningOverlay(page)).toHaveClass(/tuning-panel-open/)

    // Click Apply within tuning overlay (not recipe cards)
    await tuningOverlay(page).getByRole('button', { name: 'Apply', exact: true }).click()

    // Panel should slide closed
    await expect(tuningOverlay(page)).toHaveClass(/tuning-panel-closed/)
  })

  test('cancel tuning closes the panel', async ({ page, editorPage }) => {
    await selectFirstRecipe(page)
    await page.locator('[aria-label^="Tune "]').first().click()
    await expect(tuningOverlay(page)).toHaveClass(/tuning-panel-open/)

    await tuningOverlay(page).getByRole('button', { name: 'Cancel' }).click()

    // Panel should slide closed
    await expect(tuningOverlay(page)).toHaveClass(/tuning-panel-closed/)
  })
})
