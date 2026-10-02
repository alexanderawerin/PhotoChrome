import { clickEditorAction } from './helpers/editor-controls'
import { test, expect } from './helpers/fixtures'
import { fixturePath, selectBaseFilm } from './helpers/upload'
import { advancedPanel } from './helpers/advanced'

test.use({ viewport: { width: 393, height: 852 } })

test.describe('Editor — mobile header', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem('photochrome-help-version'))
  })

  test('keeps modes in the header, omits filename navigation, and appends through Add', async ({ page, multiImageEditorPage }) => {
    await expect(page.getByRole('button', { name: 'Add photos', exact: true })).toBeVisible()
    await expect(page.locator('header').getByRole('navigation', { name: 'Editor modes', exact: true })).toBeVisible()
    await expect(page.locator('header').getByText(/test-image|of 2/)).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Previous image', exact: true })).toBeHidden()
    await expect(page.getByRole('button', { name: 'Next image', exact: true })).toBeHidden()
    await expect(page.getByRole('button', { name: 'Apply current color to all 2 images', exact: true, includeHidden: true })).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Back' })).toBeHidden()

    await page.getByLabel('Add photos to current batch').setInputFiles(fixturePath('test-image.jpg'))
    await expect(page.getByRole('button', { name: 'Apply current color to all 3 images', exact: true, includeHidden: true })).toHaveCount(1)
  })

  test('opens unread updates first, then remembers them and opens Quick Guide', async ({ page, editorPage }) => {
    await clickEditorAction(page, 'Help')
    await expect(page.getByRole('tab', { name: "What's New" })).toHaveAttribute('aria-selected', 'true')

    await page.keyboard.press('Escape')
    await clickEditorAction(page, 'Help')
    await expect(page.getByRole('tab', { name: 'Quick Guide' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('tab', { name: 'Shortcuts' })).toHaveCount(0)
  })

  test('keeps primary tabs visible and cancels unfinished Advanced color on tab change', async ({ page, editorPage }) => {
    const modes = page.getByRole('navigation', { name: 'Editor modes', exact: true })
    await expect(modes.getByRole('button', { name: 'Films', exact: true })).toHaveAttribute('aria-current', 'page')
    await selectBaseFilm(page)
    await modes.getByRole('button', { name: 'Open Advanced settings', exact: true }).click()
    const panel = advancedPanel(page)
    await panel.getByRole('tab', { name: 'Manual', exact: true }).click()
    const slider = panel.getByRole('slider', { name: 'Highlight', exact: true })
    const initialValue = await slider.getAttribute('aria-valuenow')
    await slider.focus()
    await page.keyboard.press('ArrowRight')
    await expect(slider).not.toHaveAttribute('aria-valuenow', initialValue!)
    await expect(panel.getByRole('button', { name: 'Cancel', exact: true })).toBeVisible()
    await expect(panel.getByRole('button', { name: 'Apply', exact: true })).toBeVisible()
    await expect(modes).toBeVisible()
    await modes.getByRole('button', { name: 'Crop', exact: true }).click()
    await expect(panel).toHaveCount(0)
    await modes.getByRole('button', { name: 'Open Advanced settings', exact: true }).click()
    await panel.getByRole('tab', { name: 'Manual', exact: true }).click()
    await expect(slider).toHaveAttribute('aria-valuenow', initialValue!)
  })

  test('opens a reversible Crop session with all ratios, angle, zoom, rotate, and flip', async ({ page, editorPage }) => {
    const modes = page.getByRole('navigation', { name: 'Editor modes' })
    await modes.getByRole('button', { name: 'Crop' }).click()
    await expect(page.getByRole('button', { name: 'Rotate clockwise' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Flip horizontal' })).toBeVisible()
    await page.getByRole('button', { name: 'Open crop session' }).click()

    const cropRegion = page.getByRole('region', { name: 'Crop settings', exact: true })
    await expect(cropRegion).toBeVisible()
    await expect(cropRegion).not.toHaveAttribute('aria-modal', 'true')
    await expect(page.getByRole('dialog', { name: /Crop/ })).toHaveCount(0)
    await expect(modes).toBeVisible()

    const ratioTrigger = cropRegion.getByRole('button', { name: 'Choose crop ratio', exact: true })
    await ratioTrigger.click()
    const ratios = page.getByRole('group', { name: 'Crop ratios', exact: true })
    await expect(ratios.getByRole('button', { name: 'Original', exact: true })).toBeVisible()
    await expect(ratios.getByRole('button', { name: 'Free', exact: true })).toBeVisible()
    await expect(ratios.getByRole('button', { name: '9:16', exact: true })).toBeVisible()
    await expect(ratios.getByRole('menuitem')).toHaveCount(0)
    await ratios.getByRole('button', { name: '9:16', exact: true }).click()
    await expect(ratioTrigger).toBeFocused()
    await expect(ratioTrigger.locator('span:not([aria-hidden="true"])')).toHaveText('9:16')

    const angle = cropRegion.getByRole('slider', { name: 'Crop angle' })
    await expect(angle).toHaveAttribute('aria-valuemin', '-45')
    await expect(angle).toHaveAttribute('aria-valuemax', '45')
    await angle.focus()
    await page.keyboard.press('ArrowRight')
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()

    await page.getByRole('button', { name: 'Open crop session' }).click()
    await expect(cropRegion.getByRole('slider', { name: 'Crop angle' })).toHaveAttribute('aria-valuenow', '0')
    await expect(cropRegion.getByRole('slider', { name: 'Crop zoom' })).toBeVisible()
  })
})
