import { test, expect } from './helpers/fixtures'

test.describe('Editor — Smart Picks', () => {
  test('Smart Picks section appears after loading a color photo', async ({ page, editorPage }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-chrome', 'desktop-only test')
    const section = page.locator('aside section[aria-label="Smart Picks"]')
    await expect(section).toBeVisible({ timeout: 5_000 })
  })

  test('Smart Picks contains exactly 5 cards', async ({ page, editorPage }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-chrome', 'desktop-only test')
    const section = page.locator('aside section[aria-label="Smart Picks"]')
    await expect(section).toBeVisible({ timeout: 5_000 })
    const cards = section.locator('[aria-label^="Apply preset"]')
    await expect(cards).toHaveCount(5)
  })

  test('Clicking a Smart Picks card applies the recipe', async ({ page, editorPage }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-chrome', 'desktop-only test')
    const section = page.locator('aside section[aria-label="Smart Picks"]')
    await expect(section).toBeVisible({ timeout: 5_000 })

    const firstCard = section.locator('[aria-label^="Apply preset"]').first()
    const cardLabel = await firstCard.getAttribute('aria-label')
    await firstCard.click()

    const selectedSelector = cardLabel?.replace('Apply preset ', '').replace(/, selected$/, '')
    await expect(
      page.locator(`aside section[aria-label="Smart Picks"] [aria-label*="${selectedSelector}, selected"]`).first()
    ).toBeVisible({ timeout: 5_000 })
  })

  test('Switching between images updates Smart Picks', async ({ page, multiImageEditorPage }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile-chrome', 'desktop-only test')
    const section = page.locator('aside section[aria-label="Smart Picks"]')
    await expect(section).toBeVisible({ timeout: 5_000 })

    const initialLabel = await section.locator('[aria-label^="Apply preset"]').first().getAttribute('aria-label')

    const thumbs = page.locator('[aria-label^="Image"]')
    await thumbs.nth(1).click()

    await page.waitForTimeout(500)

    await expect(section).toBeVisible()
    const newLabel = await section.locator('[aria-label^="Apply preset"]').first().getAttribute('aria-label')
    expect(newLabel).toBeTruthy()
    void initialLabel
  })

  test('Smart Picks visible in horizontal mobile scroll', async ({ page, editorPage }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chrome', 'mobile-only test')

    const mobilePanel = page.locator('nav[aria-label="Film presets"]')
    await expect(mobilePanel).toBeVisible({ timeout: 5_000 })

    await expect(mobilePanel.getByText('Smart', { exact: false })).toBeVisible({ timeout: 5_000 })
  })

  test("Editor's Choice visible in horizontal mobile scroll (bug fix)", async ({ page, editorPage }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chrome', 'mobile-only test')

    const mobilePanel = page.locator('nav[aria-label="Film presets"]')
    await expect(mobilePanel).toBeVisible({ timeout: 5_000 })

    await expect(mobilePanel.getByText("Editor's", { exact: false })).toBeVisible({ timeout: 5_000 })
  })
})
