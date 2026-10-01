import { afterEach, describe, expect, it, vi } from 'vitest'
import { ImageProcessor } from './processor'

const file = new File(['image'], 'photo.jpg', { type: 'image/jpeg' })

function decoderFixture() {
  const bitmap = { width: 4_000, height: 2_000, close: vi.fn() }
  const drawImage = vi.fn()
  const getImageData = vi.fn((_x: number, _y: number, width: number, height: number) => ({ width, height, data: new Uint8ClampedArray(4) }))
  const context = { drawImage, getImageData }
  const canvases: { width: number; height: number; getContext: () => typeof context | null }[] = []
  const createElement = vi.fn(() => {
    const canvas = { width: 0, height: 0, getContext: (): typeof context | null => context }
    canvases.push(canvas)
    return canvas
  })
  vi.stubGlobal('createImageBitmap', vi.fn(async () => bitmap))
  vi.stubGlobal('document', { createElement })
  return { bitmap, canvases, createElement, drawImage, getImageData }
}

afterEach(() => vi.unstubAllGlobals())

describe('on-demand photo decoding', () => {
  it('retains source dimensions and only reads preview-sized RGBA on load', async () => {
    const fixture = decoderFixture()
    const validate = vi.fn()
    const result = await ImageProcessor.decodeImagePreview(file, 1_000, validate)
    expect(result).toMatchObject({ width: 4_000, height: 2_000, thumbnail: { width: 1_000, height: 500 } })
    expect(result).not.toHaveProperty('original')
    expect(validate).toHaveBeenCalledExactlyOnceWith(4_000, 2_000)
    expect(fixture.drawImage).toHaveBeenCalledExactlyOnceWith(fixture.bitmap, 0, 0, 1_000, 500)
    expect(fixture.getImageData).toHaveBeenCalledExactlyOnceWith(0, 0, 1_000, 500)
    expect(fixture.canvases).toHaveLength(1)
    expect(fixture.canvases[0]).toMatchObject({ width: 0, height: 0 })
    expect(fixture.bitmap.close).toHaveBeenCalledOnce()
  })

  it('copies full-resolution pixels only when export requests them', async () => {
    const fixture = decoderFixture()
    const validate = vi.fn()
    const result = await ImageProcessor.decodeImageOriginal(file, undefined, validate)
    expect(result).toMatchObject({ width: 4_000, height: 2_000 })
    expect(validate).toHaveBeenCalledExactlyOnceWith(4_000, 2_000)
    expect(fixture.getImageData).toHaveBeenCalledExactlyOnceWith(0, 0, 4_000, 2_000)
    expect(fixture.canvases[0]).toMatchObject({ width: 0, height: 0 })
    expect(fixture.bitmap.close).toHaveBeenCalledOnce()
  })

  it.each(['preview', 'original'] as const)('closes a %s bitmap before allocating any canvas when dimensions are rejected', async kind => {
    const fixture = decoderFixture()
    const validate = () => { throw new Error('64 MP limit') }
    const decoding = kind === 'preview'
      ? ImageProcessor.decodeImagePreview(file, 1_000, validate)
      : ImageProcessor.decodeImageOriginal(file, undefined, validate)
    await expect(decoding).rejects.toThrow('64 MP limit')
    expect(fixture.createElement).not.toHaveBeenCalled()
    expect(fixture.bitmap.close).toHaveBeenCalledOnce()
  })

  it.each(['draw', 'readback', 'context'] as const)('releases bitmap and canvas after a %s failure', async phase => {
    const fixture = decoderFixture()
    if (phase === 'draw') fixture.drawImage.mockImplementation(() => { throw new Error('Copy failed') })
    else if (phase === 'readback') fixture.getImageData.mockImplementation(() => { throw new Error('Read failed') })
    else fixture.createElement.mockImplementation(() => {
      const canvas = { width: 0, height: 0, getContext: () => null }
      fixture.canvases.push(canvas)
      return canvas
    })
    await expect(ImageProcessor.decodeImageOriginal(file)).rejects.toThrow()
    expect(fixture.canvases[0]).toMatchObject({ width: 0, height: 0 })
    expect(fixture.bitmap.close).toHaveBeenCalledOnce()
  })

  it.each(['preview', 'original'] as const)('rejects a late %s native decode after cancellation and closes the bitmap', async kind => {
    const fixture = decoderFixture()
    let finish!: (bitmap: typeof fixture.bitmap) => void
    vi.stubGlobal('createImageBitmap', vi.fn(() => new Promise(resolve => { finish = resolve })))
    const controller = new AbortController()
    const decoding = kind === 'preview'
      ? ImageProcessor.decodeImagePreview(file, 1_000, undefined, controller.signal)
      : ImageProcessor.decodeImageOriginal(file, controller.signal)
    controller.abort()
    finish(fixture.bitmap)
    await expect(decoding).rejects.toMatchObject({ name: 'AbortError' })
    expect(fixture.createElement).not.toHaveBeenCalled()
    expect(fixture.bitmap.close).toHaveBeenCalledOnce()
  })

  it('checks cancellation after readback and releases the copied canvas', async () => {
    const fixture = decoderFixture()
    const controller = new AbortController()
    fixture.getImageData.mockImplementation((_x, _y, width, height) => {
      controller.abort()
      return { width, height, data: new Uint8ClampedArray(4) }
    })
    await expect(ImageProcessor.decodeImagePreview(file, 1_000, undefined, controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(fixture.canvases[0]).toMatchObject({ width: 0, height: 0 })
    expect(fixture.bitmap.close).toHaveBeenCalledOnce()
  })

  it('does not start native decoding for an already canceled request', async () => {
    decoderFixture()
    const controller = new AbortController()
    controller.abort()
    await expect(ImageProcessor.decodeImageOriginal(file, controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(createImageBitmap).not.toHaveBeenCalled()
  })
})

describe('export canvas ownership', () => {
  const pixels = { width: 4_000, height: 2_000, data: new Uint8ClampedArray(4) } as ImageData

  it.each(['success', 'failure'] as const)('releases the JPEG backing canvas after encoding %s', async result => {
    const encoded = new Blob(['jpeg'], { type: 'image/jpeg' })
    const canvas = {
      width: 0, height: 0,
      getContext: () => ({ putImageData: vi.fn() }),
      toBlob: (callback: BlobCallback) => callback(result === 'success' ? encoded : null),
    }
    vi.stubGlobal('document', { createElement: () => canvas })
    const encoding = ImageProcessor.imageDataToBlob(pixels)
    if (result === 'success') await expect(encoding).resolves.toBe(encoded)
    else await expect(encoding).rejects.toThrow('Failed to create blob')
    expect(canvas).toMatchObject({ width: 0, height: 0 })
  })

  it('releases watermark canvases after rendering fails', () => {
    const canvas = {
      width: 0, height: 0,
      getContext: () => ({ putImageData: vi.fn(), fillText: () => { throw new Error('Watermark failed') } }),
    }
    vi.stubGlobal('document', { createElement: () => canvas })
    expect(() => ImageProcessor.addWatermark(pixels, 'Photochrome')).toThrow('Watermark failed')
    expect(canvas).toMatchObject({ width: 0, height: 0 })
  })
})
