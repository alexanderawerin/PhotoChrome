import { test, expect } from './helpers/fixtures'
import { selectFirstRecipe } from './helpers/upload'

test.describe('Keyboard Shortcuts', () => {
  test('R rotates the image', async ({ page, editorPage }) => {
    const canvas = page.locator('canvas').first()
    const beforeBox = await canvas.boundingBox()

    await page.keyboard.press('r')
    await page.waitForTimeout(500)

    const afterBox = await canvas.boundingBox()
    expect(beforeBox).toBeTruthy()
    expect(afterBox).toBeTruthy()
    if (beforeBox && afterBox) {
      const ratioBefore = beforeBox.width / beforeBox.height
      const ratioAfter = afterBox.width / afterBox.height
      expect(ratioBefore).not.toBeCloseTo(ratioAfter, 0)
    }
  })

  test('C opens crop mode', async ({ page, editorPage }) => {
    await page.keyboard.press('c')
    await expect(page.locator('[aria-label="Crop aspect ratio selection"]')).toBeVisible()
  })

  test('Escape cancels crop mode', async ({ page, editorPage }) => {
    await page.keyboard.press('c')
    await expect(page.locator('[aria-label="Crop aspect ratio selection"]')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.locator('[aria-label="Crop aspect ratio selection"]')).not.toBeVisible()
    await expect(page.locator('[aria-label="Editing tools"]').first()).toBeVisible()
  })

  test('T opens tuning panel when recipe selected', async ({ page, editorPage }) => {
    await selectFirstRecipe(page)

    await page.keyboard.press('t')
    // Check tuning labels in desktop aside panel
    await expect(page.locator('aside').getByText('Highlight')).toBeVisible()
    await expect(page.locator('aside').getByText('Shadow')).toBeVisible()
  })

  test('Enter applies crop', async ({ page, editorPage }) => {
    await page.keyboard.press('c')
    await expect(page.locator('[aria-label="Crop aspect ratio selection"]')).toBeVisible()

    await page.keyboard.press('Enter')
    await expect(page.locator('[aria-label="Crop aspect ratio selection"]')).not.toBeVisible()
  })
})
