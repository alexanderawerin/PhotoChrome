import { test, expect } from './helpers/fixtures'

test.describe('Processing engine golden parity', () => {
  test('CPU, worker, and WebGL preserve geometry, orientation, alpha, and pixel parity', async ({ page, landingPage }) => {
    const result = await page.evaluate(async () => {
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
          pixels[offset + 3] = 128 + ((x * 7 + y * 13) % 128)
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
        settings: {
          dynamicRange: 'DR200',
          whiteBalance: 'cloudy',
          highlight: 1,
          shadow: -1,
          color: 1,
          wbShiftRed: 1,
          wbShiftBlue: -1,
          colorChromeEffect: 'weak',
          colorChromeFXBlue: 'weak',
        },
        targetSize: { width, height },
      })

      const cpu = ImageProcessor.processOnCPU(source, plan)
      const worker = await ImageProcessor.processAsync(source, plan)
      const webglProcessor = new WebGLProcessor()
      webglProcessor.init(width, height)
      const webglCanvas = webglProcessor.processFrame(source, plan)
      const context = webglCanvas.getContext('2d')
      if (!context) throw new Error('2D output context unavailable')
      const webgl = context.getImageData(0, 0, width, height)
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
        cpuWebgl: compare(webgl, cpu),
        orientations: {
          none: compareOrientation(false, false),
          flipX: compareOrientation(true, false),
          flipY: compareOrientation(false, true),
          flipXY: compareOrientation(true, true),
        },
        // The asymmetric top-left sample catches vertical/horizontal inversion explicitly.
        topLeft: [cpu, worker, webgl].map(image => Array.from(image.data.slice(0, 4))),
      }
    })

    expect(result.dimensions).toEqual([[17, 11], [17, 11], [17, 11]])
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
