import { test, expect } from './helpers/fixtures'

const SMART_PICKS_TIMEOUT = 10_000

test.describe('Editor — Smart Picks', () => {
  test('Smart Picks section appears after loading a color photo', async ({ page, editorPage }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-chrome', 'desktop-only test')
    const section = page.locator('aside section[aria-label="Smart Picks"]')
    await expect(section).toBeVisible({ timeout: SMART_PICKS_TIMEOUT })
  })

  test('Smart Picks contains exactly 5 cards', async ({ page, editorPage }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-chrome', 'desktop-only test')
    const section = page.locator('aside section[aria-label="Smart Picks"]')
    await expect(section).toBeVisible({ timeout: SMART_PICKS_TIMEOUT })
    const cards = section.locator('[aria-label^="Apply preset"]')
    await expect(cards).toHaveCount(5)
  })

  test('Clicking a Smart Picks card applies the recipe', async ({ page, editorPage }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-chrome', 'desktop-only test')
    const section = page.locator('aside section[aria-label="Smart Picks"]')
    await expect(section).toBeVisible({ timeout: SMART_PICKS_TIMEOUT })

    const firstCard = section.locator('[aria-label^="Apply preset"]').first()
    const cardLabel = await firstCard.getAttribute('aria-label')
    await firstCard.click()

    const selectedSelector = cardLabel?.replace('Apply preset ', '').replace(/, selected$/, '')
    await expect(
      page.locator(`aside section[aria-label="Smart Picks"] [aria-label*="${selectedSelector}, selected"]`).first()
    ).toBeVisible({ timeout: SMART_PICKS_TIMEOUT })
  })

  test('Smart Picks remain selectable after switching images', async ({ page, multiImageEditorPage }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-chrome', 'desktop-only test')
    const section = page.locator('aside section[aria-label="Smart Picks"]')
    await expect(section).toBeVisible({ timeout: SMART_PICKS_TIMEOUT })

    const thumbnails = page.getByRole('tablist', { name: 'Image thumbnails' })
    const secondImage = thumbnails.getByRole('tab').nth(1)
    await secondImage.click()
    await expect(secondImage).toHaveAttribute('aria-selected', 'true')
    await expect(section.getByRole('button', { name: /^Apply preset / })).toHaveCount(5)
    const card = section.getByRole('button', { name: /^Apply preset / }).first()
    await card.click()
    await expect(card).toHaveAttribute('aria-label', /, selected$/)
  })

  test('Smart Picks visible in horizontal mobile scroll', async ({ page, editorPage }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chrome', 'mobile-only test')

    const mobilePanel = page.getByRole('navigation', { name: 'Film presets' })
    const categoryRow = mobilePanel.getByRole('group', { name: 'Preset categories' })
    await expect(categoryRow.getByRole('button', { name: 'Smart Picks', exact: true })).toBeVisible({ timeout: 5_000 })
  })

  test("Editor's Choice visible in horizontal mobile scroll (bug fix)", async ({ page, editorPage }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chrome', 'mobile-only test')

    const mobilePanel = page.getByRole('navigation', { name: 'Film presets' })
    const categoryRow = mobilePanel.getByRole('group', { name: 'Preset categories' })
    await expect(categoryRow.getByRole('button', { name: "Editor's Choice", exact: true })).toBeVisible({ timeout: 5_000 })
  })
})
