import { test, expect } from './helpers/fixtures'
import { selectBaseFilm } from './helpers/upload'

test.describe('Editor — Tuning Panel', () => {
  const inspector = (page: import('@playwright/test').Page) =>
    page.getByRole('region', { name: 'Advanced settings', exact: true })

  const selectAndOpen = async (page: import('@playwright/test').Page) => {
    await selectBaseFilm(page)
    await page.getByRole('button', { name: 'Open Advanced settings' }).click()
    await inspector(page).getByRole('tab', { name: 'Manual', exact: true }).click()
  }

  test('Manual opens from Advanced for a base film', async ({ page, editorPage }) => {
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
    const highlight = inspector(page).getByRole('slider', { name: 'Highlight', exact: true })
    const presetValue = await highlight.getAttribute('aria-valuenow')
    await highlight.focus()
    await page.keyboard.press(presetValue === '4' ? 'ArrowLeft' : 'ArrowRight')
    await expect(highlight).not.toHaveAttribute('aria-valuenow', presetValue!)
    await inspector(page).getByRole('button', { name: 'Reset Highlight to profile' }).click()
    await expect(highlight).toHaveAttribute('aria-valuenow', presetValue!)
  })

  test('inspector is dedicated to adjustments', async ({ page, editorPage }) => {
    await selectAndOpen(page)
    await expect(inspector(page).getByText('Highlight')).toBeVisible()
    await expect(inspector(page).getByRole('tab')).toHaveCount(2)
    await expect(inspector(page).getByRole('tab', { name: 'Manual', exact: true })).toHaveAttribute('aria-selected', 'true')
    await expect(inspector(page).getByText('Provia', { exact: true })).toHaveCount(1)
    await expect(inspector(page).getByRole('button', { name: 'Choose crop ratio' })).toHaveCount(0)
  })
})
