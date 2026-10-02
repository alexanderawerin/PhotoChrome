import { openCropSession, editorModes, editorControls, editorActions } from './helpers/editor-controls'
import { test, expect } from './helpers/fixtures'

test.describe('Editor — Transform (Rotate & Crop)', () => {
  test('rotate clockwise button works', async ({ page, editorPage }) => {
    const canvas = page.locator('canvas[aria-label="Preview"]')
    const dimensions = await canvas.evaluate((element: HTMLCanvasElement) => [element.width, element.height])
    await editorModes(page).getByRole('button', { name: 'Crop', exact: true }).click()
    await editorControls(page).getByRole('group', { name: 'Crop tools', exact: true })
      .getByRole('button', { name: 'Rotate clockwise', exact: true }).click()
    await expect.poll(() => canvas.evaluate((element: HTMLCanvasElement) => [element.width, element.height]))
      .toEqual([dimensions[1], dimensions[0]])
  })

  test('crop mode shows crop toolbar with ratio chooser', async ({ page, editorPage }) => {
    await openCropSession(page)
    await expect(page.getByRole('button', { name: 'Choose crop ratio', exact: true })).toBeVisible()
    await expect(page.getByRole('slider', { name: 'Crop angle' })).toBeVisible()
    await expect(page.getByRole('slider', { name: 'Crop zoom' })).toBeVisible()
  })

  test('select crop ratio and apply on desktop', async ({ page, editorPage }) => {
    await openCropSession(page)
    await page.getByRole('button', { name: 'Choose crop ratio' }).click()
    const ratios = page.getByRole('group', { name: 'Crop ratios', exact: true })
    const square = ratios.getByRole('button', { name: '1:1', exact: true })
    await expect(square).toHaveAttribute('aria-pressed', 'false')
    await square.click()
    await page.getByRole('button', { name: 'Choose crop ratio', exact: true }).click()
    await expect(square).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: 'Choose crop ratio', exact: true }).click()
    await editorActions(page).getByRole('button', { name: 'Done', exact: true }).click()
    await expect(page.getByRole('slider', { name: 'Crop angle' })).toBeHidden()
  })

  test('cancel crop returns to normal mode', async ({ page, editorPage }) => {
    await openCropSession(page)
    await editorActions(page).getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(page.getByRole('slider', { name: 'Crop angle' })).toBeHidden()
  })
})
