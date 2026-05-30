import { test, expect } from './helpers/fixtures'

test.describe("Editor — Editor's Choice", () => {
  test("Editor's Choice section is visible with 10 recipe cards", async ({ page, editorPage }) => {
    // Editor's Choice heading should be visible in the desktop aside panel
    const heading = page.locator('aside').getByText("Editor's Choice")
    await expect(heading).toBeVisible()

    // Should have exactly 10 recipe cards in the Editor's Choice section
    // The section uses aria-labelledby="group-editors-choice"
    const grid = page.locator('aside [aria-labelledby="group-editors-choice"]')
    await expect(grid).toBeVisible()

    const cards = grid.locator('[aria-label^="Apply preset"]')
    await expect(cards).toHaveCount(10)
  })

  test("Editor's Choice section appears before Film/UseCase groups", async ({ page, editorPage }) => {
    const sectionOrder = await page.locator('aside section[aria-label]').evaluateAll(
      sections => sections.map(s => s.getAttribute('aria-label'))
    )

    const favoritesIndex = sectionOrder.indexOf('Favorite presets')
    const smartPicksIndex = sectionOrder.indexOf('Smart Picks')
    const editorsChoiceIndex = sectionOrder.indexOf("Editor's Choice presets")
    const firstFilmGroupIndex = sectionOrder.findIndex(
      label => label !== null && label.endsWith(' presets') &&
        label !== 'Favorite presets' &&
        label !== 'Smart Picks' &&
        label !== "Editor's Choice presets"
    )

    expect(editorsChoiceIndex).toBeGreaterThan(-1)
    if (favoritesIndex !== -1) {
      expect(favoritesIndex).toBeLessThan(editorsChoiceIndex)
    }
    if (smartPicksIndex !== -1) {
      expect(smartPicksIndex).toBeLessThan(editorsChoiceIndex)
    }
    if (firstFilmGroupIndex !== -1) {
      expect(editorsChoiceIndex).toBeLessThan(firstFilmGroupIndex)
    }
  })
})
