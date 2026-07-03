import { test, expect } from './helpers/fixtures'
import { selectFirstRecipe } from './helpers/upload'

test.describe('Keyboard Shortcuts', () => {
  test('R rotates the image', async ({ page, editorPage }) => {
    const canvas = page.locator('canvas[aria-label="Preview"]')
    const before = await canvas.evaluate(element => ({
      width: element.width,
      height: element.height,
    }))

    await page.keyboard.press('r')

    await expect.poll(() => canvas.evaluate(element => ({
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
