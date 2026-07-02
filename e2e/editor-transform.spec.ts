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

  test('crop mode shows crop toolbar with ratio buttons', async ({ page, editorPage }) => {
    await page.getByRole('button', { name: 'Open Crop inspector' }).click()
    await expect(page.getByRole('slider', { name: 'Crop angle' })).toBeVisible()
    await expect(page.getByRole('slider', { name: 'Crop zoom' })).toBeVisible()
  })

  test('select crop ratio and apply', async ({ page, editorPage }) => {
    await page.getByRole('button', { name: 'Open Crop inspector' }).click()
    await page.getByRole('button', { name: 'Choose crop ratio' }).click()
    await page.getByRole('menuitem', { name: '1:1' }).click()
    await page.getByRole('button', { name: 'Apply', exact: true }).click()
    await expect(page.getByRole('slider', { name: 'Crop angle' })).toBeHidden()
  })

  test('cancel crop returns to normal mode', async ({ page, editorPage }) => {
    await page.getByRole('button', { name: 'Open Crop inspector' }).click()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('slider', { name: 'Crop angle' })).toBeHidden()
  })
})
