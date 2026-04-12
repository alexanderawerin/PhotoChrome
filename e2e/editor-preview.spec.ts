import { test, expect } from './helpers/fixtures'
import { selectFirstRecipe } from './helpers/upload'

/**
 * Checks that a canvas element is not entirely black/empty.
 * Samples pixels from the canvas and verifies at least some have non-zero values.
 */
async function canvasIsNotBlack(page: import('@playwright/test').Page, canvasSelector = 'canvas'): Promise<boolean> {
  return page.evaluate((selector) => {
    const canvas = document.querySelector(selector) as HTMLCanvasElement
    if (!canvas) return false
    const ctx = canvas.getContext('2d')
    if (!ctx) return false
    const { width, height } = canvas
    if (width === 0 || height === 0) return false

    // Sample 20 points across the canvas
    const points = [
      [0.25, 0.25], [0.5, 0.25], [0.75, 0.25],
      [0.25, 0.5],  [0.5, 0.5],  [0.75, 0.5],
      [0.25, 0.75], [0.5, 0.75], [0.75, 0.75],
      [0.1, 0.1],   [0.9, 0.9],  [0.5, 0.1],
      [0.1, 0.5],   [0.9, 0.5],  [0.5, 0.9],
      [0.3, 0.3],   [0.7, 0.7],  [0.3, 0.7],
      [0.7, 0.3],   [0.15, 0.85],
    ]

    let nonBlackPixels = 0
    for (const [rx, ry] of points) {
      const x = Math.floor(rx * (width - 1))
      const y = Math.floor(ry * (height - 1))
      const pixel = ctx.getImageData(x, y, 1, 1).data
      // A pixel is "not black" if any RGB channel > 5
      if (pixel[0] > 5 || pixel[1] > 5 || pixel[2] > 5) {
        nonBlackPixels++
      }
    }

    // At least 25% of sampled points should be non-black
    return nonBlackPixels >= 5
  }, canvasSelector)
}

test.describe('Editor — Preview Rendering', () => {
  test('main preview is not black after selecting a recipe', async ({ page, editorPage }) => {
    await selectFirstRecipe(page)
    // Wait for processing to complete
    await page.waitForTimeout(1000)

    const isRendered = await canvasIsNotBlack(page)
    expect(isRendered, 'Main preview canvas should not be black after applying a recipe').toBe(true)
  })

  test('recipe card previews are not black', async ({ page, editorPage }) => {
    // Wait for card previews to generate (debounced at 50ms each)
    await page.waitForTimeout(2000)

    // Check several recipe card canvases in the aside panel
    const cardCanvases = page.locator('aside [aria-label^="Apply preset"] canvas')
    const count = await cardCanvases.count()
    expect(count).toBeGreaterThan(0)

    // Sample up to 10 cards
    const sampled = Math.min(count, 10)
    let renderedCards = 0

    for (let i = 0; i < sampled; i++) {
      const isRendered = await page.evaluate((index) => {
        const canvases = document.querySelectorAll('aside [aria-label^="Apply preset"] canvas')
        const canvas = canvases[index] as HTMLCanvasElement
        if (!canvas || canvas.width === 0 || canvas.height === 0) return false
        const ctx = canvas.getContext('2d')
        if (!ctx) return false

        // Sample center pixel
        const pixel = ctx.getImageData(
          Math.floor(canvas.width / 2),
          Math.floor(canvas.height / 2),
          1, 1
        ).data
        return pixel[0] > 5 || pixel[1] > 5 || pixel[2] > 5
      }, i)

      if (isRendered) renderedCards++
    }

    // At least 80% of sampled cards should have rendered previews
    const ratio = renderedCards / sampled
    expect(ratio, `${renderedCards}/${sampled} recipe cards rendered — expected >= 80%`).toBeGreaterThanOrEqual(0.8)
  })
})
