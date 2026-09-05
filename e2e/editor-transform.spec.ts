import { test, expect } from './helpers/fixtures'

test.describe('Editor — Transform (Rotate & Crop)', () => {
  test('rotate clockwise button works', async ({ page, editorPage }) => {
    const canvas = page.locator('canvas[aria-label="Preview"]')
    await page.getByRole('button', { name: 'Open Crop inspector' }).click()
    const beforeBox = await canvas.boundingBox()

    await page.getByRole('button', { name: 'Rotate 90 degrees clockwise' }).click()
    // Wait for re-render
    await page.waitForTimeout(500)

    const afterBox = await canvas.boundingBox()
    expect(beforeBox).toBeTruthy()
    expect(afterBox).toBeTruthy()
    if (beforeBox && afterBox) {
      const ratioBefore = beforeBox.width / beforeBox.height
      const ratioAfter = afterBox.width / afterBox.height
      expect(Math.abs(ratioBefore - ratioAfter)).toBeGreaterThan(0.1)
    }
  })

  test('crop mode shows crop toolbar with ratio chooser', async ({ page, editorPage }) => {
    await page.getByRole('button', { name: 'Open Crop inspector' }).click()
    await expect(page.getByRole('button', { name: 'Choose crop ratio', exact: true })).toBeVisible()
    await expect(page.getByRole('slider', { name: 'Crop angle' })).toBeVisible()
    await expect(page.getByRole('slider', { name: 'Crop zoom' })).toBeVisible()
  })

  test('select crop ratio and apply on desktop', async ({ page, editorPage }) => {
    await page.getByRole('button', { name: 'Open Crop inspector' }).click()
    await page.getByRole('button', { name: 'Choose crop ratio' }).click()
    const ratios = page.getByRole('group', { name: 'Crop ratios', exact: true })
    const square = ratios.getByRole('button', { name: '1:1', exact: true })
    await expect(square).toHaveAttribute('aria-pressed', 'false')
    await square.click()
    await page.getByRole('button', { name: 'Choose crop ratio', exact: true }).click()
    await expect(square).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('button', { name: 'Choose crop ratio', exact: true }).click()
    await page.getByRole('button', { name: 'Apply', exact: true }).click()
    await expect(page.getByRole('slider', { name: 'Crop angle' })).toBeHidden()
  })

  test('cancel crop returns to normal mode', async ({ page, editorPage }) => {
    await page.getByRole('button', { name: 'Open Crop inspector' }).click()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('slider', { name: 'Crop angle' })).toBeHidden()
  })
})
