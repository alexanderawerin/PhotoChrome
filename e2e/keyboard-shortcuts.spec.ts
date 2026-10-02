import { test, expect } from './helpers/fixtures'
import { selectBaseFilm } from './helpers/upload'

test.describe('Keyboard Shortcuts', () => {
  test('R rotates the image', async ({ page, editorPage }) => {
    const canvas = page.locator('canvas[aria-label="Preview"]')
    const before = await canvas.evaluate((element: HTMLCanvasElement) => ({
      width: element.width,
      height: element.height,
    }))

    await page.keyboard.press('r')

    await expect.poll(() => canvas.evaluate((element: HTMLCanvasElement) => ({
      width: element.width,
      height: element.height,
    }))).toEqual({ width: before.height, height: before.width })
  })

  test('C opens crop mode', async ({ page, editorPage }) => {
    await page.keyboard.press('c')
    await expect(page.getByRole('slider', { name: 'Crop angle' })).toBeVisible()
  })

  test('Escape cancels crop mode', async ({ page, editorPage }) => {
    await page.keyboard.press('c')
    await expect(page.getByRole('slider', { name: 'Crop angle' })).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.getByRole('slider', { name: 'Crop angle' })).toBeHidden()
  })

  test('T opens Advanced when a film is selected', async ({ page, editorPage }) => {
    await selectBaseFilm(page)
    // Film resources can be ready before the worker finishes its first preview.
    // The enabled action is the observable boundary shared with shortcut guards.
    await expect(page.getByRole('navigation', { name: 'Editor modes', exact: true })
      .getByRole('button', { name: 'Open Advanced settings', exact: true })).toBeEnabled()

    await page.keyboard.press('t')
    const panel = page.getByRole('region', { name: 'Advanced settings', exact: true })
    await expect(panel.getByRole('tab', { name: 'Recipes', exact: true })).toHaveAttribute('aria-selected', 'true')
    await panel.getByRole('tab', { name: 'Manual', exact: true }).click()
    await expect(panel.getByRole('slider', { name: 'Highlight', exact: true })).toBeVisible()
  })

  test('Enter applies crop', async ({ page, editorPage }) => {
    await page.keyboard.press('c')
    await expect(page.getByRole('slider', { name: 'Crop angle' })).toBeVisible()
    await expect(page.getByRole('toolbar', { name: 'Editor actions', exact: true })
      .getByRole('button', { name: 'Done', exact: true })).toBeEnabled()
    // Enter on the focused ratio button opens its chooser; exercise the global
    // shortcut from a neutral surface after the crop draft is ready to apply.
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur())

    await page.keyboard.press('Enter')
    await expect(page.getByRole('slider', { name: 'Crop angle' })).toBeHidden()
  })
})
