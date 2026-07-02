import { test, expect } from './helpers/fixtures'
import { selectFirstRecipe } from './helpers/upload'

test.describe('Keyboard Shortcuts', () => {
  test('R rotates the image', async ({ page, editorPage }) => {
    const canvas = page.locator('canvas[aria-label="Preview"]')
    const beforeBox = await canvas.boundingBox()

    await page.keyboard.press('r')
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

  test('T opens tuning panel when recipe selected', async ({ page, editorPage }) => {
    await selectFirstRecipe(page)

    await page.keyboard.press('t')
    await expect(page.getByRole('complementary', { name: 'Editing inspector' }).getByText('Highlight')).toBeVisible()
    await expect(page.getByRole('complementary', { name: 'Editing inspector' }).getByText('Shadow')).toBeVisible()
  })

  test('Enter applies crop', async ({ page, editorPage }) => {
    await page.keyboard.press('c')
    await expect(page.getByRole('slider', { name: 'Crop angle' })).toBeVisible()

    await page.keyboard.press('Enter')
    await expect(page.getByRole('slider', { name: 'Crop angle' })).toBeHidden()
  })
})
