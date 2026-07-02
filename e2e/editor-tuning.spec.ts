import { test, expect } from './helpers/fixtures'
import { selectFirstRecipe } from './helpers/upload'

test.describe('Editor — Tuning Panel', () => {
  const inspector = (page: import('@playwright/test').Page) =>
    page.getByRole('complementary', { name: 'Editing inspector' })

  const selectAndOpen = async (page: import('@playwright/test').Page) => {
    await selectFirstRecipe(page)
    await page.getByRole('button', { name: 'Open Adjust inspector' }).click()
  }

  test('tuning panel opens when tune button is clicked', async ({ page, editorPage }) => {
    await selectAndOpen(page)
    await expect(inspector(page).getByText('Highlight')).toBeVisible()
    await expect(inspector(page).getByText('Shadow')).toBeVisible()
  })

  test('tuning panel shows sliders for main parameters', async ({ page, editorPage }) => {
    await selectAndOpen(page)
    const panel = inspector(page)
    await expect(panel.getByText('Highlight')).toBeVisible()
    await expect(panel.getByText('Shadow')).toBeVisible()
    await expect(panel.getByText('Color', { exact: true })).toBeVisible()
    await expect(panel.getByText('Sharpness')).toBeVisible()
  })

  test('reset control restores a slider to the preset value', async ({ page, editorPage }) => {
    await selectAndOpen(page)
    await expect(inspector(page).getByRole('button', { name: 'Reset Highlight to preset' })).toBeVisible()
  })

  test('inspector is dedicated to adjustments', async ({ page, editorPage }) => {
    await selectAndOpen(page)
    await expect(inspector(page).getByText('Highlight')).toBeVisible()
    await expect(inspector(page).getByRole('tab')).toHaveCount(0)
    await expect(inspector(page).getByRole('button', { name: 'Choose crop ratio' })).toHaveCount(0)
  })
})
