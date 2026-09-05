import { test, expect } from './helpers/fixtures'
import AxeBuilder from '@axe-core/playwright'
import type { Locator, Page } from '@playwright/test'
import { uploadVideo } from './helpers/upload'

test.use({ viewport: { width: 393, height: 852 } })

const FILM_CATEGORIES = [
  'Provia',
  'Velvia',
  'Astia',
  'Pro 400H',
  'Superia',
  'Acros',
  'Neopan',
  'Eterna',
  'Classic Chrome',
  'Classic Neg.',
]

function mobilePresetNav(page: Page): Locator {
  return page.getByRole('navigation', { name: 'Film presets' })
}

function categories(page: Page): Locator {
  return mobilePresetNav(page).getByRole('group', { name: 'Preset categories' })
}

function carousel(page: Page): Locator {
  return mobilePresetNav(page).getByRole('region', { name: 'Preset carousel' })
}

async function scrollLeft(region: Locator): Promise<number> {
  return region.evaluate((element: HTMLElement) => element.scrollLeft)
}

async function cardRelativeLeft(card: Locator): Promise<number> {
  return card.evaluate((element: HTMLElement) => {
    const region = element.closest('[role="region"][aria-label="Preset carousel"]')
    if (!(region instanceof HTMLElement)) return Number.NaN
    return element.getBoundingClientRect().left - region.getBoundingClientRect().left
  })
}

async function cardIsInCarouselViewport(card: Locator): Promise<boolean> {
  return card.evaluate((element: HTMLElement) => {
    const region = element.closest('[role="region"][aria-label="Preset carousel"]')
    if (!(region instanceof HTMLElement)) return false
    const cardRect = element.getBoundingClientRect()
    const regionRect = region.getBoundingClientRect()
    const cardCenter = cardRect.left + cardRect.width / 2
    return cardCenter >= regionRect.left && cardCenter <= regionRect.right
  })
}

async function selectedRecipeLabel(region: Locator): Promise<string | null> {
  const selected = region.locator('[aria-label^="Apply preset"][aria-label$=", selected"]')
  return selected.first().getAttribute('aria-label')
}

async function expectTouchTarget(locator: Locator): Promise<void> {
  const box = await locator.boundingBox()
  expect(box).not.toBeNull()
  if (!box) return
  expect(box.width).toBeGreaterThanOrEqual(44)
  expect(box.height).toBeGreaterThanOrEqual(44)
}

test.describe('Editor — mobile preset categories', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem('photochrome_favorites')
      localStorage.removeItem('photochrome-help-version')
    })
  })

  test('renders the category row and keeps Random as the first carousel item', async ({ page, editorPage }) => {
    const nav = mobilePresetNav(page)
    const categoryRow = categories(page)
    const presetCarousel = carousel(page)

    await expect(nav).toBeVisible()
    await expect(categoryRow).toBeVisible()
    await expect(presetCarousel).toBeVisible()
    await expect(categoryRow.getByRole('button', { name: 'Smart Picks', exact: true })).toBeVisible({ timeout: 15_000 })

    const categoryButtons = categoryRow.getByRole('button')
    const categoryNames = await categoryButtons.evaluateAll(buttons =>
      buttons.map(button => (button.textContent ?? '').replace(/\s+/g, ' ').trim())
    )
    expect(categoryNames.slice(0, 3)).toEqual(['Favorites', 'Smart Picks', "Editor's Choice"])
    expect(categoryNames.slice(3)).toEqual(FILM_CATEGORIES)
    for (const name of categoryNames) {
      await expectTouchTarget(categoryRow.getByRole('button', { name, exact: true }))
    }

    await expect(categoryRow.getByRole('button', { name: 'Favorites', exact: true })).toHaveAttribute('aria-current', 'true')
    await expect(categoryRow.getByRole('button', { name: 'Smart Picks', exact: true })).not.toHaveAttribute('aria-current', 'true')
    await expect(categoryRow.getByRole('button', { name: "Editor's Choice", exact: true })).not.toHaveAttribute('aria-current', 'true')

    const firstCarouselButton = presetCarousel.locator('button').first()
    await expect(firstCarouselButton).toHaveAttribute('aria-label', 'Random preset')
  })

  test('clicking a category scrolls its cards into view and marks it active', async ({ page, editorPage }) => {
    const categoryRow = categories(page)
    const presetCarousel = carousel(page)
    const targetCategory = categoryRow.getByRole('button', { name: "Editor's Choice", exact: true })
    const targetGroup = presetCarousel.getByRole('group', { name: "Editor's Choice presets", exact: true })
    const targetCard = targetGroup.locator('[data-recipe-card]').first()
    const initialScrollLeft = await scrollLeft(presetCarousel)

    await targetCategory.click()

    await expect(targetCategory).toHaveAttribute('aria-current', 'true')
    await expect.poll(() => scrollLeft(presetCarousel)).toBeGreaterThan(initialScrollLeft)
    await expect.poll(() => cardIsInCarouselViewport(targetCard)).toBe(true)
  })

  test('manual card scrolling synchronizes the active category', async ({ page, editorPage }) => {
    const categoryRow = categories(page)
    const presetCarousel = carousel(page)
    const targetCategory = categoryRow.getByRole('button', { name: 'Provia', exact: true })
    const targetGroup = presetCarousel.getByRole('group', { name: 'Provia presets', exact: true })
    const targetCard = targetGroup.locator('[data-recipe-card]').first()

    await targetCard.evaluate((element: HTMLElement) => {
      element.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'start' })
    })

    await expect.poll(() => cardIsInCarouselViewport(targetCard)).toBe(true)
    await expect(targetCategory).toHaveAttribute('aria-current', 'true')
  })

  test('keeps the visible film card stable while adding and removing a favorite', async ({ page, editorPage }) => {
    const categoryRow = categories(page)
    const presetCarousel = carousel(page)
    const targetCategory = categoryRow.getByRole('button', { name: 'Provia', exact: true })
    const targetGroup = presetCarousel.getByRole('group', { name: 'Provia presets', exact: true })
    const targetCard = targetGroup.locator('[data-recipe-card]').first()
    const secondCard = targetGroup.locator('[data-recipe-card]').nth(1)

    await targetCard.evaluate((element: HTMLElement) => {
      element.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'start' })
    })
    await expect(targetCategory).toHaveAttribute('aria-current', 'true')
    await expect.poll(() => cardIsInCarouselViewport(targetCard)).toBe(true)

    const firstFavoriteToggle = targetCard.getByRole('button', { name: 'Add to favorites' })
    await expectTouchTarget(firstFavoriteToggle)
    await firstFavoriteToggle.click()
    await expect(targetCard.getByRole('button', { name: 'Remove from favorites' })).toBeVisible()

    // 0→1 keeps the Favorites slot the same width.  1→2 grows it by one card,
    // which is the transition that must preserve the visible Provia card.
    const positionWithOneFavorite = await cardRelativeLeft(targetCard)
    const secondFavoriteToggle = secondCard.getByRole('button', { name: 'Add to favorites' })
    await expectTouchTarget(secondFavoriteToggle)
    await secondFavoriteToggle.click()
    await expect(secondCard.getByRole('button', { name: 'Remove from favorites' })).toBeVisible()
    expect(Math.abs((await cardRelativeLeft(targetCard)) - positionWithOneFavorite)).toBeLessThan(12)

    const positionWithTwoFavorites = await cardRelativeLeft(targetCard)
    await secondCard.getByRole('button', { name: 'Remove from favorites' }).click()
    await expect(secondCard.getByRole('button', { name: 'Add to favorites' })).toBeVisible()
    expect(Math.abs((await cardRelativeLeft(targetCard)) - positionWithTwoFavorites)).toBeLessThan(12)
  })

  test('keeps Favorites empty section and demo restrictions while Random applies a preset', async ({ page, landingPage }) => {
    const presetCarousel = carousel(page)
    const favoritesGroup = presetCarousel.getByRole('group', { name: 'Favorites presets', exact: true })
    const modes = page.getByRole('navigation', { name: 'Editor modes' })

    await expect(page.getByRole('button', { name: 'Upload photos', exact: true })).toBeVisible({ timeout: 15_000 })
    await expect(favoritesGroup).toBeVisible()
    await expect(favoritesGroup.locator('[aria-label^="Apply preset"]')).toHaveCount(0)
    await expect(modes.getByRole('button', { name: /^presets$/i })).toHaveAttribute('aria-current', 'page')
    await expect(modes.getByRole('button', { name: /^adjust$/i })).toHaveCount(0)
    await expect(modes.getByRole('button', { name: /^crop$/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Export/ })).toHaveCount(0)

    const accessibility = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    expect(accessibility.violations).toEqual([])

    const random = presetCarousel.getByRole('button', { name: 'Random preset', exact: true })
    await random.click()
    await expect.poll(() => selectedRecipeLabel(presetCarousel)).toBeTruthy()
    const firstRandomRecipe = await selectedRecipeLabel(presetCarousel)
    expect(firstRandomRecipe).toBeTruthy()

    await random.click()
    await expect.poll(() => selectedRecipeLabel(presetCarousel)).not.toBe(firstRandomRecipe)
    const secondRandomRecipe = await selectedRecipeLabel(presetCarousel)
    expect(secondRandomRecipe).toBeTruthy()
    expect(secondRandomRecipe).not.toBe(firstRandomRecipe)
  })

  test('activates a category from the keyboard', async ({ page, editorPage }) => {
    const categoryRow = categories(page)
    const targetCategory = categoryRow.getByRole('button', { name: 'Provia', exact: true })

    await targetCategory.focus()
    await page.keyboard.press('Enter')

    await expect(targetCategory).toHaveAttribute('aria-current', 'true')
    await expect(categoryRow.locator('[aria-current="true"]')).toHaveCount(1)
  })

  test('syncs the final category when the preset carousel reaches its end', async ({ page, editorPage }) => {
    const categoryRow = categories(page)
    const presetCarousel = carousel(page)
    const lastCategory = categoryRow.getByRole('button', { name: 'Classic Neg.', exact: true })

    await presetCarousel.evaluate((element: HTMLElement) => {
      element.scrollLeft = element.scrollWidth
      element.dispatchEvent(new Event('scroll', { bubbles: true }))
    })

    await expect(lastCategory).toHaveAttribute('aria-current', 'true')
    await expect.poll(async () => presetCarousel.evaluate((element: HTMLElement) => {
      return element.scrollLeft + element.clientWidth >= element.scrollWidth - 1
    })).toBe(true)
  })

  test('reuses preset navigation in the mobile video editor', async ({ page, landingPage }) => {
    await uploadVideo(page)

    const nav = mobilePresetNav(page)
    const categoryRow = categories(page)
    const presetCarousel = carousel(page)

    await expect(page.getByText('test-video.mp4', { exact: true })).toBeVisible()
    await expect(nav).toBeVisible()
    await expect(categoryRow.getByRole('button', { name: 'Favorites', exact: true })).toBeVisible()
    await expect(categoryRow.getByRole('button', { name: "Editor's Choice", exact: true })).toBeVisible()
    await expect(presetCarousel.getByRole('button', { name: 'Random preset', exact: true })).toBeVisible()
  })
})
