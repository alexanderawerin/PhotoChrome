import { clickEditorAction } from './helpers/editor-controls'
import { test, expect } from './helpers/fixtures'
import AxeBuilder from '@axe-core/playwright'
import type { Locator, Page } from '@playwright/test'
import { uploadVideo } from './helpers/upload'
import { advancedPanel, openAdvanced } from './helpers/advanced'

test.use({ viewport: { width: 393, height: 852 } })

const FILMS = ['Provia', 'Velvia', 'Astia', 'Pro 400H', 'Superia', 'Acros', 'Neopan', 'Eterna', 'Classic Chrome', 'Classic Neg']
const selection = (page: Page) => page.getByRole('group', { name: 'Film selection', exact: true })
const film = (page: Page, name: string) => selection(page).getByRole('button', { name: `Select film ${name}`, exact: true })

async function expectTouchTarget(locator: Locator) {
  const box = await locator.boundingBox()
  expect(box).not.toBeNull()
  if (!box) return
  expect(box.width).toBeGreaterThanOrEqual(44)
  expect(box.height).toBeGreaterThanOrEqual(44)
}

async function visibleInSelection(locator: Locator) {
  return locator.evaluate(element => {
    const group = element.closest('[aria-label="Film selection"]')!
    const region = group.getBoundingClientRect()
    const button = element.getBoundingClientRect()
    return button.left >= region.left - 1 && button.right <= region.right + 1
  })
}

test.describe('Editor — mobile films', () => {
  test('offers Original and exactly ten films with touch-sized main choices', async ({ page, editorPage }) => {
    await expect(selection(page)).toBeVisible()
    await expect(selection(page).getByRole('button', { name: /^Select / })).toHaveCount(11)
    const original = selection(page).getByRole('button', { name: 'Select Original', exact: true })
    await expect(original).toHaveAttribute('aria-pressed', 'true')
    await expectTouchTarget(original)
    for (const name of FILMS) {
      await expect(film(page, name)).toBeVisible()
      await expectTouchTarget(film(page, name))
    }
    await expect(page.getByRole('button', { name: /Random|Smart Picks|Editor's Choice/ })).toHaveCount(0)
  })

  test('selecting a film scrolls it into view and has one active color', async ({ page, editorPage }) => {
    const target = film(page, 'Classic Neg')
    await target.click()
    await expect(target).toHaveAttribute('aria-pressed', 'true')
    await expect(selection(page).locator('button[aria-pressed="true"]')).toHaveCount(1)
    await expect.poll(() => visibleInSelection(target)).toBe(true)
  })

  test('native film-row scrolling preserves the applied choice', async ({ page, editorPage }) => {
    await film(page, 'Provia').click()
    await film(page, 'Classic Neg').evaluate(element => element.scrollIntoView({ block: 'nearest', inline: 'end', behavior: 'auto' }))
    await expect.poll(() => visibleInSelection(film(page, 'Classic Neg'))).toBe(true)
    await expect(film(page, 'Provia')).toHaveAttribute('aria-pressed', 'true')
    await expect(film(page, 'Classic Neg')).toHaveAttribute('aria-pressed', 'false')
  })

  test('keeps film-row scroll position and selected film after Help rerenders', async ({ page, editorPage }) => {
    await film(page, 'Classic Neg').click()
    const scroll = await selection(page).locator('.film-selector-scroll').evaluate(element => element.scrollLeft)
    await clickEditorAction(page, 'Help')
    const dialog = page.getByRole('dialog', { name: 'Photochrome help', exact: true })
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(film(page, 'Classic Neg')).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(() => selection(page).locator('.film-selector-scroll').evaluate(element => element.scrollLeft)).toBe(scroll)
  })

  test('favorites belong to film-scoped Advanced recipes and persist after Cancel', async ({ page, editorPage }) => {
    await film(page, 'Provia').click()
    await openAdvanced(page)
    const panel = advancedPanel(page)
    const card = panel.locator('[data-recipe-card]').filter({ has: page.getByRole('button', { name: 'Apply preset Provia Portrait', exact: true }) })
    const favorite = card.getByRole('button', { name: 'Add to favorites', exact: true })
    await expectTouchTarget(favorite)
    await favorite.click()
    await panel.getByRole('button', { name: 'Cancel', exact: true }).click()
    await openAdvanced(page)
    await expect(card.getByRole('button', { name: 'Remove from favorites', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await expect(panel.getByRole('button', { name: /^Apply preset/ })).toHaveCount(8)
  })

  test('the three-photo demo applies base films and preserves action restrictions', async ({ page, landingPage }) => {
    await expect(page.getByRole('button', { name: 'Upload photos', exact: true })).toBeVisible({ timeout: 15000 })
    const modes = page.getByRole('navigation', { name: 'Editor modes', exact: true })
    await expect(modes.getByRole('button', { name: 'Films', exact: true })).toHaveAttribute('aria-current', 'page')
    await expect(modes.getByRole('button', { name: 'Open Advanced settings', exact: true })).toHaveCount(0)
    await expect(modes.getByRole('button', { name: 'Crop', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Export/ })).toHaveCount(0)
    await film(page, 'Provia').click()
    await expect(film(page, 'Provia')).toHaveAttribute('aria-pressed', 'true')
    await film(page, 'Velvia').click()
    await expect(film(page, 'Velvia')).toHaveAttribute('aria-pressed', 'true')
    const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    expect(accessibility.violations).toEqual([])
  })

  test('keyboard selects films and Original without recipe browsing', async ({ page, editorPage }) => {
    await film(page, 'Provia').focus()
    await page.keyboard.press('Enter')
    await expect(film(page, 'Provia')).toHaveAttribute('aria-pressed', 'true')
    const original = selection(page).getByRole('button', { name: 'Select Original', exact: true })
    await original.focus()
    await page.keyboard.press('Space')
    await expect(original).toHaveAttribute('aria-pressed', 'true')
  })

  test('reduced motion retains keyboard selection and reachable row ends', async ({ page, editorPage }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await film(page, 'Classic Neg').focus()
    await page.keyboard.press('Enter')
    await expect(film(page, 'Classic Neg')).toHaveAttribute('aria-pressed', 'true')
    await expect.poll(() => visibleInSelection(film(page, 'Classic Neg'))).toBe(true)
  })

  test('video uses the same eleven neutral color choices', async ({ page, landingPage }) => {
    await uploadVideo(page)
    await expect(page.getByLabel('Video preview', { exact: true })).toBeVisible()
    await expect(selection(page)).toBeVisible()
    await expect(selection(page).getByRole('button', { name: /^Select / })).toHaveCount(11)
    await expect(selection(page).getByRole('button', { name: 'Select Original', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await film(page, 'Provia').click()
    await expect(film(page, 'Provia')).toHaveAttribute('aria-pressed', 'true')
  })
})
