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
    const panel = page.locator('aside')
    const headings = panel.locator('h3')

    // Collect heading texts in order
    const texts = await headings.allTextContents()
    const editorsChoiceIndex = texts.findIndex(t => t.trim() === "Editor's Choice")
    const filmGroupIndex = texts.findIndex((t, i) => i > 0 && t.trim() !== 'Favorites' && t.trim() !== "Editor's Choice")

    expect(editorsChoiceIndex).toBeGreaterThan(-1)
    // Editor's Choice must come before any film/use-case groups
    if (filmGroupIndex !== -1) {
      expect(editorsChoiceIndex).toBeLessThan(filmGroupIndex)
    }
  })
})
