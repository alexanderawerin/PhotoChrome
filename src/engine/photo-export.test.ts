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
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  function stubDownload() {
    const anchor = {
      href: '',
      download: '',
      click: vi.fn(),
      remove: vi.fn(),
    }
    vi.stubGlobal('document', {
      createElement: vi.fn(() => anchor),
      body: { appendChild: vi.fn() },
    })
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:photochrome-test')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    return anchor
  }

  it('returns a structured processing error', async () => {
    vi.spyOn(ImageProcessor, 'processAsync').mockRejectedValue(new Error('Worker crashed'))

    await expect(exportPhoto(request())).resolves.toEqual({
      status: 'error',
      error: { code: 'processing-failed', message: 'Worker crashed' },
    })
  })

  it('returns a capped preview of the watermarked export pixels', async () => {
    stubDownload()
    const processed = { width: 1, height: 1, data: new Uint8ClampedArray([10, 20, 30, 255]) } as ImageData
    const watermarked = { width: 1, height: 1, data: new Uint8ClampedArray([40, 50, 60, 255]) } as ImageData
    const preview = { width: 1, height: 1, data: new Uint8ClampedArray([40, 50, 60, 255]) } as ImageData
    const process = vi.spyOn(ImageProcessor, 'processAsync').mockResolvedValue(processed)
    const watermark = vi.spyOn(ImageProcessor, 'addWatermark').mockReturnValue(watermarked)
    const encode = vi.spyOn(ImageProcessor, 'imageDataToBlob').mockResolvedValue(new Blob(['jpeg'], { type: 'image/jpeg' }))
    const thumbnail = vi.spyOn(ImageProcessor, 'createThumbnail').mockResolvedValue(preview)

    const result = await exportPhoto(request())

    expect(result).toEqual({
      status: 'success',
      fileName: 'photochrome_test.jpg',
      preview: { fileName: 'photochrome_test.jpg', imageData: preview },
    })
    expect(process).toHaveBeenCalledOnce()
    expect(watermark).toHaveBeenCalledWith(processed, 'Photochrome')
    expect(encode).toHaveBeenCalledWith(watermarked, 0.95, {})
    expect(thumbnail).toHaveBeenCalledWith(expect.any(File), 480)
    expect((thumbnail.mock.calls[0][0] as File).name).toBe('photochrome_test.jpg')
  })

  it('keeps a successful export when thumbnail generation fails', async () => {
    stubDownload()
    vi.spyOn(ImageProcessor, 'processAsync').mockResolvedValue(request().imageData)
    vi.spyOn(ImageProcessor, 'addWatermark').mockReturnValue(request().imageData)
    vi.spyOn(ImageProcessor, 'imageDataToBlob').mockResolvedValue(new Blob(['jpeg'], { type: 'image/jpeg' }))
    vi.spyOn(ImageProcessor, 'createThumbnail').mockRejectedValue(new Error('Preview decode failed'))

    await expect(exportPhoto(request())).resolves.toEqual({
      status: 'success',
      fileName: 'photochrome_test.jpg',
      preview: null,
    })
  })

  it('does not trigger a download when cancelled after encoding', async () => {
    const anchor = stubDownload()
    const controller = new AbortController()
    vi.spyOn(ImageProcessor, 'processAsync').mockResolvedValue(request().imageData)
    vi.spyOn(ImageProcessor, 'addWatermark').mockReturnValue(request().imageData)
    vi.spyOn(ImageProcessor, 'imageDataToBlob').mockImplementation(async () => {
      controller.abort()
      return new Blob(['jpeg'], { type: 'image/jpeg' })
    })

    await expect(exportPhoto(request(controller.signal))).resolves.toEqual({ status: 'cancelled' })
    expect(anchor.click).not.toHaveBeenCalled()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('removes the download anchor when the browser rejects the click', async () => {
    const anchor = stubDownload()
    anchor.click.mockImplementation(() => { throw new Error('Download blocked') })
    vi.spyOn(ImageProcessor, 'processAsync').mockResolvedValue(request().imageData)
    vi.spyOn(ImageProcessor, 'addWatermark').mockReturnValue(request().imageData)
    vi.spyOn(ImageProcessor, 'imageDataToBlob').mockResolvedValue(new Blob(['jpeg'], { type: 'image/jpeg' }))

    await expect(exportPhoto(request())).resolves.toEqual({
      status: 'error',
      error: { code: 'download-failed', message: 'Download blocked' },
    })
    expect(anchor.remove).toHaveBeenCalledOnce()
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
