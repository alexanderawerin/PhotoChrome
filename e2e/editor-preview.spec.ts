import { test, expect } from './helpers/fixtures'
import { selectBaseFilm } from './helpers/upload'

/**
 * Checks that a canvas element is not entirely black/empty.
 * Samples pixels from the canvas and verifies at least some have non-zero values.
 */
async function canvasIsNotBlack(page: import('@playwright/test').Page, canvasSelector = 'canvas[aria-label="Preview"]'): Promise<boolean> {
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
  test.beforeEach(({ browserName }) => {
    test.skip(browserName !== 'chromium', 'Preview rendering pixel assertions are verified in Chromium')
  })

  test('WebGL pipeline compiles and applies preprocessing settings', async ({ page, landingPage }) => {
    const pixel = await page.evaluate(async () => {
      // Vite serves this browser-only module; it is intentionally imported inside the page.
      // @ts-expect-error Absolute Vite module paths are not visible to the Node test compiler.
      const { WebGLProcessor } = await import('/src/engine/webgl/processor.ts')
      // @ts-expect-error Absolute Vite module paths are not visible to the Node test compiler.
      const { createProcessingPlanFromSimulation } = await import('/src/engine/processing-plan.ts')
      const processor = new WebGLProcessor()

      try {
        processor.init(4, 4)
        const data = new Uint8ClampedArray(4 * 4 * 4)
        for (let i = 0; i < data.length; i += 4) {
          data[i] = 100
          data[i + 1] = 100
          data[i + 2] = 100
          data[i + 3] = 255
        }

        const output = processor.processFrame(
          new ImageData(data, 4, 4),
          createProcessingPlanFromSimulation({
            recipe: { id: 'webgl-audit', name: 'WebGL audit', simulationId: 'webgl-audit' },
            simulation: {
              id: 'webgl-audit',
              name: 'WebGL audit',
              curve: { points: [[0, 0], [255, 255]] },
            },
            settings: {
              dynamicRange: 'DR200',
              whiteBalanceKelvin: 3000,
            },
            targetSize: { width: 4, height: 4 },
          })
        )

        const context = (output as HTMLCanvasElement).getContext('2d')
        if (!context) throw new Error('2D output context unavailable')
        return Array.from(context.getImageData(2, 2, 1, 1).data)
      } finally {
        processor.dispose()
      }
    })

    expect(pixel[0], 'Warm Kelvin preprocessing should raise red over blue').toBeGreaterThan(pixel[2])
    expect(pixel[3]).toBe(255)
  })

  test('WebGL applies recipe saturation after a HaldCLUT', async ({ page, landingPage }) => {
    const chroma = await page.evaluate(async () => {
      // @ts-expect-error Absolute Vite module paths are not visible to the Node test compiler.
      const { WebGLProcessor } = await import('/src/engine/webgl/processor.ts')
      // @ts-expect-error Absolute Vite module paths are not visible to the Node test compiler.
      const { getSimulation, loadSimulationLUT } = await import('/src/presets/simulations/index.ts')
      // @ts-expect-error Absolute Vite module paths are not visible to the Node test compiler.
      const { createProcessingPlanFromSimulation } = await import('/src/engine/processing-plan.ts')
      // @ts-expect-error Absolute Vite module paths are not visible to the Node test compiler.
      const { getCachedLUT } = await import('/src/presets/simulations/index.ts')
      const simulation = getSimulation('provia')
      if (!simulation) throw new Error('Provia simulation unavailable')
      await loadSimulationLUT('provia')

      const processor = new WebGLProcessor()
      try {
        processor.init(4, 4)
        const data = new Uint8ClampedArray(4 * 4 * 4)
        for (let i = 0; i < data.length; i += 4) {
          data[i] = 180
          data[i + 1] = 100
          data[i + 2] = 60
          data[i + 3] = 255
        }
        const source = new ImageData(data, 4, 4)

        const renderChroma = (color: number) => {
          const output = processor.processFrame(source, createProcessingPlanFromSimulation({
            recipe: { id: 'provia-test', name: 'Provia test', simulationId: simulation.id },
            simulation,
            settings: { color },
            lut: getCachedLUT(simulation.id),
            targetSize: { width: 4, height: 4 },
          }))
          const context = (output as HTMLCanvasElement).getContext('2d')
          if (!context) throw new Error('2D output context unavailable')
          const pixel = context.getImageData(2, 2, 1, 1).data
          return Math.max(pixel[0], pixel[1], pixel[2]) - Math.min(pixel[0], pixel[1], pixel[2])
        }

        return {
          muted: renderChroma(-4),
          vivid: renderChroma(4),
        }
      } finally {
        processor.dispose()
      }
    })

    expect(chroma.vivid).toBeGreaterThan(chroma.muted)
  })

  test('main preview is not black after selecting a base film', async ({ page, editorPage }) => {
    await selectBaseFilm(page)
    await expect.poll(() => canvasIsNotBlack(page), { message: 'Main preview should render the ready base film' }).toBe(true)
  })

  test('Advanced previews leave offscreen cards idle, render after scrolling, and stop in Manual', async ({ page, editorPage }) => {
    await selectBaseFilm(page)
    await page.setViewportSize({ width: 393, height: 600 })
    await page.evaluate(async () => {
      // Instrument the existing processing boundary, without a public editor API.
      // Use the exact application-loaded URL: a Vite timestamp query creates
      // a different module identity from importing the bare source path.
      const processorUrl = performance.getEntriesByType('resource')
        .map(entry => entry.name)
        .filter(url => new URL(url).pathname === '/src/engine/processor.ts').at(-1)
      if (!processorUrl) throw new Error('Application processor module request was not recorded')
      const { ImageProcessor } = await import(processorUrl)
      const calls: string[] = []
      ;(window as unknown as { previewWork: string[] }).previewWork = calls
      const original = ImageProcessor.process.bind(ImageProcessor)
      ImageProcessor.process = (image: ImageData, plan: { recipe: { id: string } }) => {
        if (Math.max(image.width, image.height) <= 250) calls.push(plan.recipe.id)
        return original(image, plan)
      }
    })
    await page.getByRole('button', { name: 'Open Advanced settings', exact: true }).click()
    const panel = page.getByRole('region', { name: 'Advanced settings', exact: true })
    const card = panel.getByRole('button', { name: 'Apply preset Provia Portrait', exact: true })
    const offscreen = panel.getByRole('button', { name: 'Apply preset Provia Afternoon', exact: true })
    await expect(card.locator('.film-thumbnail')).toHaveAttribute('data-preview-state', 'ready')
    await expect(offscreen.locator('.film-thumbnail')).toHaveAttribute('data-preview-state', 'idle')
    expect(await offscreen.locator('canvas').evaluate((canvas: HTMLCanvasElement) => [canvas.width, canvas.height])).toEqual([0, 0])
    expect(await page.evaluate(() => (window as unknown as { previewWork: string[] }).previewWork)).not.toContain('provia-afternoon')
    await offscreen.scrollIntoViewIfNeeded()
    await expect(offscreen.locator('.film-thumbnail')).toHaveAttribute('data-preview-state', 'ready')
    expect(await page.evaluate(() => (window as unknown as { previewWork: string[] }).previewWork)).toContain('provia-afternoon')
    await card.scrollIntoViewIfNeeded()
    await expect.poll(() => card.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
      const context = canvas.getContext('2d')
      if (!context || !canvas.width || !canvas.height) return false
      const pixel = context.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data
      return pixel[0] > 5 || pixel[1] > 5 || pixel[2] > 5
    }), { message: 'Visible Advanced recipe preview should render' }).toBe(true)
    await panel.getByRole('tab', { name: 'Manual', exact: true }).click()
    await expect(panel.locator('[data-recipe-card]')).toHaveCount(0)
    await expect(panel.getByRole('slider', { name: 'Highlight', exact: true })).toBeVisible()
  })


})
