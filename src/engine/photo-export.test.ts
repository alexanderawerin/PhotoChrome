import { afterEach, describe, expect, it, vi } from 'vitest'
import { exportPhoto } from './photo-export'
import { ImageProcessor } from './processor'
import type { ProcessingPlan } from './types'

const processingPlan: ProcessingPlan = {
  version: 1,
  recipe: { id: 'test', name: 'Test', simulationId: 'simulation' },
  simulation: { id: 'simulation', name: 'Simulation', curve: { points: [[0, 0], [255, 255]] } },
  settings: {},
  lut: null,
  targetSize: { width: 1, height: 1 },
}

const request = (signal?: AbortSignal) => ({
  imageData: { width: 1, height: 1, data: new Uint8ClampedArray(4) } as ImageData,
  plan: processingPlan,
  fileName: 'photochrome_test.jpg',
  watermarkText: 'Photochrome',
  exifInfo: {},
  signal,
})

describe('exportPhoto', () => {
  afterEach(() => vi.restoreAllMocks())

  it('returns a structured processing error', async () => {
    vi.spyOn(ImageProcessor, 'processAsync').mockRejectedValue(new Error('Worker crashed'))

    await expect(exportPhoto(request())).resolves.toEqual({
      status: 'error',
      error: { code: 'processing-failed', message: 'Worker crashed' },
    })
  })

  it('returns cancelled without converting AbortError into an export error', async () => {
    const controller = new AbortController()
    vi.spyOn(ImageProcessor, 'processAsync').mockImplementation(async () => {
      controller.abort()
      throw new DOMException('cancelled', 'AbortError')
    })

    await expect(exportPhoto(request(controller.signal))).resolves.toEqual({ status: 'cancelled' })
  })
})
