import { test, expect } from './helpers/fixtures'

test.describe('Editor — Transform (Rotate & Crop)', () => {
  test('rotate clockwise button works', async ({ page, editorPage }) => {
    const canvas = page.locator('canvas').first()
    const beforeBox = await canvas.boundingBox()

    // Desktop button includes keyboard hint "(R)"
    await page.locator('[aria-label="Rotate clockwise (R)"]').click()
    // Wait for re-render
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

  test('crop mode shows crop toolbar with ratio buttons', async ({ page, editorPage }) => {
    await page.locator('[aria-label="Crop image (C)"]').click()

    const cropToolbar = page.locator('[aria-label="Crop aspect ratio selection"]')
    await expect(cropToolbar).toBeVisible()
    await expect(page.locator('[aria-label="Apply crop"]')).toBeVisible()
    await expect(page.locator('[aria-label="Cancel crop"]')).toBeVisible()

    const ratioGroup = page.locator('[aria-label="Aspect ratios"]')
    await expect(ratioGroup).toBeVisible()
  })

  test('select crop ratio and apply', async ({ page, editorPage }) => {
    await page.locator('[aria-label="Crop image (C)"]').click()
    await expect(page.locator('[aria-label="Crop aspect ratio selection"]')).toBeVisible()

    // Select 1:1 ratio — use button inside the crop toolbar
    const cropToolbar = page.locator('[aria-label="Crop aspect ratio selection"]')
    await cropToolbar.getByRole('button', { name: /1:1/ }).click()

    // Apply crop
    await page.locator('[aria-label="Apply crop"]').click()

    // Crop toolbar should disappear, normal toolbar should return
    await expect(page.locator('[aria-label="Crop aspect ratio selection"]')).not.toBeVisible()
    await expect(page.locator('[aria-label="Editing tools"]').first()).toBeVisible()
  })

  test('cancel crop returns to normal mode', async ({ page, editorPage }) => {
    await page.locator('[aria-label="Crop image (C)"]').click()
    await expect(page.locator('[aria-label="Crop aspect ratio selection"]')).toBeVisible()

    await page.locator('[aria-label="Cancel crop"]').click()
    await expect(page.locator('[aria-label="Crop aspect ratio selection"]')).not.toBeVisible()
    await expect(page.locator('[aria-label="Editing tools"]').first()).toBeVisible()
  })
})
