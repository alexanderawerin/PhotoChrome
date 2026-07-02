import { test, expect } from './helpers/fixtures'
import { fixturePath } from './helpers/upload'

test.use({ viewport: { width: 393, height: 852 } })

test.describe('Editor — mobile header', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem('photochrome-help-version'))
  })

  test('shows the current file, batch position, and appends through Add', async ({ page, multiImageEditorPage }) => {
    await expect(page.getByRole('button', { name: 'Add photos', exact: true })).toBeVisible()
    await expect(page.getByText('1 of 2', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Back' })).toBeHidden()

    await page.getByLabel('Add photos to current batch').setInputFiles(fixturePath('test-image.jpg'))
    await expect(page.getByText('1 of 3', { exact: true })).toBeVisible()
  })

  test('opens unread updates first, then remembers them and opens Quick Guide', async ({ page, editorPage }) => {
    const help = page.getByRole('button', { name: 'Help', exact: true }).first()
    await help.click()
    await expect(page.getByRole('tab', { name: "What's New" })).toHaveAttribute('aria-selected', 'true')

    await page.keyboard.press('Escape')
    await help.click()
    await expect(page.getByRole('tab', { name: 'Quick Guide' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('tab', { name: 'Shortcuts' })).toHaveCount(0)
  })

  test('keeps primary tabs visible and cancels an unfinished Adjust tool on tab change', async ({ page, editorPage }) => {
    const modes = page.getByRole('navigation', { name: 'Editor modes' })
    await expect(modes.getByRole('button', { name: 'Presets' })).toHaveAttribute('aria-current', 'page')

    await page.locator('nav[aria-label="Film presets"] [aria-label^="Apply preset"]').first().click()
    await modes.getByRole('button', { name: 'Adjust' }).click()
    await page.getByRole('button', { name: 'Adjust Highlight' }).click()

    const slider = page.getByRole('slider', { name: 'Highlight' })
    const initialValue = await slider.getAttribute('aria-valuenow')
    await slider.focus()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('button', { name: 'Cancel' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Done' })).toBeVisible()

    await modes.getByRole('button', { name: 'Crop' }).click()
    await modes.getByRole('button', { name: 'Adjust' }).click()
    await page.getByRole('button', { name: 'Adjust Highlight' }).click()
    await expect(page.getByRole('slider', { name: 'Highlight' })).toHaveAttribute('aria-valuenow', initialValue ?? '0')
  })

  test('opens a reversible Crop session with all ratios, angle, zoom, rotate, and flip', async ({ page, editorPage }) => {
    const modes = page.getByRole('navigation', { name: 'Editor modes' })
    await modes.getByRole('button', { name: 'Crop' }).click()
    await expect(page.getByRole('button', { name: 'Rotate 90 degrees clockwise' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Flip horizontally' })).toBeVisible()
    await page.getByRole('button', { name: 'Open crop session' }).click()

    const dialog = page.getByRole('dialog', { name: 'Crop image' })
    await dialog.getByRole('button', { name: 'Choose crop ratio' }).click()
    const ratios = dialog.getByRole('menu', { name: 'Crop ratios' })
    await expect(ratios.getByRole('menuitem', { name: 'Original' })).toBeVisible()
    await expect(ratios.getByRole('menuitem', { name: 'Free' })).toBeVisible()
    await expect(ratios.getByRole('menuitem', { name: '9:16' })).toBeVisible()
    await dialog.getByRole('button', { name: 'Choose crop ratio' }).click()
    const angle = dialog.getByRole('slider', { name: 'Crop angle' })
    await expect(angle).toHaveAttribute('aria-valuemin', '-45')
    await expect(angle).toHaveAttribute('aria-valuemax', '45')
    await angle.focus()
    await page.keyboard.press('ArrowRight')
    await dialog.getByRole('button', { name: 'Cancel' }).click()

    await page.getByRole('button', { name: 'Open crop session' }).click()
    await expect(dialog.getByRole('slider', { name: 'Crop angle' })).toHaveAttribute('aria-valuenow', '0')
    await expect(dialog.getByRole('slider', { name: 'Crop zoom' })).toBeVisible()
  })
})
