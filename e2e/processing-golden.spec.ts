import type { RecipeSettings } from '../src/engine/types'
import { test, expect } from './helpers/fixtures'
import { waitForEditor } from './helpers/upload'

const cases: { name: string; settings: RecipeSettings; realLut?: boolean; original?: boolean }[] = [
  { name: 'Original ignores stale nonneutral effects', original: true, settings: { sharpness: 4, clarity: 5, color: 4, highlight: 4, dynamicRange: 'DR400', whiteBalanceKelvin: 2500 } },
  { name: 'combined curve', settings: { dynamicRange: 'DR200', whiteBalance: 'cloudy', highlight: 1, shadow: -1, color: 1, wbShiftRed: 1, wbShiftBlue: -1, colorChromeEffect: 'weak', colorChromeFXBlue: 'weak' } },
  { name: 'sharpness maximum', settings: { sharpness: 4 } },
  { name: 'sharpness minimum', settings: { sharpness: -4 } },
  { name: 'clarity maximum', settings: { clarity: 5 } },
  { name: 'clarity minimum', settings: { clarity: -5 } },
  { name: 'tone saturation WB extremes', settings: { highlight: 4, shadow: -2, color: 4, wbShiftRed: -9, wbShiftBlue: 9 } },
  { name: 'Kelvin minimum', settings: { whiteBalanceKelvin: 2500, color: -4, highlight: -2, shadow: 4 } },
  { name: 'Kelvin maximum and DR400', settings: { whiteBalanceKelvin: 10000, dynamicRange: 'DR400' } },
  { name: 'real Provia LUT combined effects', realLut: true, settings: { sharpness: 4, clarity: -5, colorChromeEffect: 'strong', colorChromeFXBlue: 'strong', highlight: 4, shadow: -2, color: 4, whiteBalance: 'tungsten', wbShiftRed: -9, wbShiftBlue: 9, dynamicRange: 'DR400' } },
]

test.describe('Processing engine golden parity', () => {
  for (const fixture of cases) test(`CPU, worker, WebGL: ${fixture.name}`, async ({ page, landingPage, browserName }) => {
    test.skip(browserName !== 'chromium', 'WebGL golden parity is verified in Chromium')

    // Demo initialization mounts the Editor under StrictMode; its lifecycle
    // cleanup disposes the shared worker. Start independent engine work only
    // after that initialization, rather than racing DOMContentLoaded.
    await waitForEditor(page)
    await expect(page.getByLabel('Applied color', { exact: true })).not.toContainText(/Preparing:|Unavailable:/)

    const result = await page.evaluate(async ({ settings, realLut, original }) => {
      // @ts-expect-error Vite browser module path is unavailable to the Node compiler.
      const { ImageProcessor } = await import('/src/engine/processor.ts')
      // @ts-expect-error Vite browser module path is unavailable to the Node compiler.
      const { WebGLProcessor } = await import('/src/engine/webgl/processor.ts')
      // @ts-expect-error Vite browser module path is unavailable to the Node compiler.
      const { createProcessingPlanFromSimulation } = await import('/src/engine/processing-plan.ts')

      const width = 17
      const height = 11
      const pixels = new Uint8ClampedArray(width * height * 4)
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const offset = (y * width + x) * 4
          pixels[offset] = 20 + x * 9
          pixels[offset + 1] = 15 + y * 17
          pixels[offset + 2] = 10 + ((x * 3 + y * 5) % 18) * 11
          pixels[offset + 3] = (x * 7 + y * 13) % 256
        }
      }
      const source = new ImageData(pixels, width, height)
      const plan = createProcessingPlanFromSimulation({
        recipe: { id: 'golden', name: 'Golden', simulationId: 'golden-simulation' },
        simulation: {
          id: 'golden-simulation',
          name: 'Golden simulation',
          curve: { points: [[0, 0], [64, 58], [128, 132], [192, 205], [255, 255]] },
          colorBalance: {
            shadows: { r: 0.02, g: -0.01, b: 0.01 },
            highlights: { r: 0.01, g: 0, b: -0.02 },
          },
          saturation: 0.08,
        },
        settings: { ...settings, grainEffect: 'off' },
        targetSize: { width, height },
      })

      if (realLut) {
        // @ts-expect-error Vite browser module path is unavailable to the Node compiler.
        const { getSimulation, loadSimulationLUT } = await import('/src/presets/simulations/index.ts')
        plan.simulation = structuredClone(getSimulation('provia'))
        plan.recipe.simulationId = 'provia'
        plan.lut = await loadSimulationLUT('provia')
        if (!plan.lut) throw new Error('Real Provia LUT unavailable')
      }

      if (original) plan.colorMode = 'original'
      const cpu = ImageProcessor.processOnCPU(source, plan)
      const worker = await ImageProcessor.processAsync(source, plan)
      const webglProcessor = new WebGLProcessor()
      webglProcessor.init(width, height)
      webglProcessor.processFrame(source, plan)
      // Raw engine readback precedes Canvas/JPEG transparency flattening.
      const webgl = webglProcessor.getImageData()
      webglProcessor.dispose()

      const compare = (actual: ImageData, expected: ImageData) => {
        let maxRgbDelta = 0
        let changedRgbChannels = 0
        let alphaMismatches = 0
        for (let index = 0; index < expected.data.length; index += 4) {
          for (let channel = 0; channel < 3; channel++) {
            const delta = Math.abs(actual.data[index + channel] - expected.data[index + channel])
            maxRgbDelta = Math.max(maxRgbDelta, delta)
            if (delta > 3) changedRgbChannels++
          }
          if (actual.data[index + 3] !== expected.data[index + 3]) alphaMismatches++
        }
        return { maxRgbDelta, changedRgbChannels, alphaMismatches }
      }

      const compareOrientation = (flipX: boolean, flipY: boolean) => {
        let maxDelta = 0
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const actualOffset = (y * width + x) * 4
            const expectedX = flipX ? width - 1 - x : x
            const expectedY = flipY ? height - 1 - y : y
            const expectedOffset = (expectedY * width + expectedX) * 4
            for (let channel = 0; channel < 4; channel++) {
              maxDelta = Math.max(maxDelta, Math.abs(webgl.data[actualOffset + channel] - cpu.data[expectedOffset + channel]))
            }
          }
        }
        return maxDelta
      }

      return {
        dimensions: [cpu, worker, webgl].map(image => [image.width, image.height]),
        cpuWorker: compare(worker, cpu),
        originalSource: original ? compare(cpu, source) : null,
        cpuWebgl: compare(webgl, cpu),
        orientations: {
          none: compareOrientation(false, false),
          flipX: compareOrientation(true, false),
          flipY: compareOrientation(false, true),
          flipXY: compareOrientation(true, true),
        },
        // The asymmetric top-left sample catches vertical/horizontal inversion explicitly.
        topLeft: [cpu, worker, webgl].map((image: ImageData) => Array.from(image.data.slice(0, 4))),
      }
    }, fixture)
    console.log(`${fixture.name}: ${JSON.stringify(result.cpuWebgl)}`)

    expect(result.dimensions).toEqual([[17, 11], [17, 11], [17, 11]])
    if (fixture.original) expect(result.originalSource).toEqual({ maxRgbDelta: 0, changedRgbChannels: 0, alphaMismatches: 0 })
    expect(result.cpuWorker).toEqual({ maxRgbDelta: 0, changedRgbChannels: 0, alphaMismatches: 0 })
    expect(result.cpuWebgl.alphaMismatches).toBe(0)
    expect(result.cpuWebgl.maxRgbDelta).toBeLessThanOrEqual(12)
    expect(result.cpuWebgl.changedRgbChannels).toBeLessThanOrEqual(17 * 11 * 3 * 0.3)
    expect(result.orientations.none).toBeLessThan(result.orientations.flipX)
    expect(result.orientations.none).toBeLessThan(result.orientations.flipY)
    expect(result.orientations.none).toBeLessThan(result.orientations.flipXY)
    expect(result.topLeft[1]).toEqual(result.topLeft[0])
    for (let channel = 0; channel < 4; channel++) {
      expect(Math.abs(result.topLeft[2][channel] - result.topLeft[0][channel])).toBeLessThanOrEqual(12)
    }
  })
})
