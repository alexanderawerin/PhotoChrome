import { afterEach, describe, expect, it, vi } from 'vitest'
import { materializePhotoPixels } from './photo-source'
import { ImageProcessor } from './processor'
import * as transforms from './transform'
import type { ImageItem } from './types'

const pixels = { width: 3, height: 2, data: new Uint8ClampedArray(24) } as ImageData
const snapshot = (): Pick<ImageItem, 'file' | 'sourceSize' | 'transform'> => ({
  file: new File(['source'], 'source.jpg', { type: 'image/jpeg' }),
  sourceSize: { width: 3, height: 2 },
  transform: transforms.createDefaultTransformState(),
})

afterEach(() => vi.restoreAllMocks())

describe('on-demand committed photo source', () => {
  it('decodes the original File for each export without retaining a full-resolution cache', async () => {
    const image = snapshot()
    const decode = vi.spyOn(ImageProcessor, 'decodeImageOriginal').mockResolvedValue(pixels)
    await expect(materializePhotoPixels(image)).resolves.toBe(pixels)
    await expect(materializePhotoPixels(image)).resolves.toBe(pixels)
    expect(decode).toHaveBeenCalledTimes(2)
    expect(decode.mock.calls.every(([file]) => file === image.file)).toBe(true)
  })

  it('snapshots nested geometry before an asynchronous decode and renders that applied snapshot', async () => {
    const image = snapshot()
    image.transform.cropRect.x = 0.25
    let release!: (value: ImageData) => void
    vi.spyOn(ImageProcessor, 'decodeImageOriginal').mockReturnValue(new Promise(resolve => { release = resolve }))
    const render = vi.spyOn(transforms, 'renderImageTransform').mockReturnValue(pixels)
    const pending = materializePhotoPixels(image)
    image.transform.cropRect.x = 0.75
    image.transform.cropOffset.x = 0.9
    image.transform.quarterTurns = 90
    release(pixels)
    await pending
    expect(render.mock.calls[0][1]).toMatchObject({ quarterTurns: 0, cropRect: { x: 0.25 }, cropOffset: { x: 0.5 } })
  })

  it('rejects changed decoded dimensions instead of transforming the wrong source', async () => {
    vi.spyOn(ImageProcessor, 'decodeImageOriginal').mockResolvedValue({ ...pixels, width: 2, height: 3 })
    const render = vi.spyOn(transforms, 'renderImageTransform')
    await expect(materializePhotoPixels(snapshot())).rejects.toThrow('expected 3×2, decoded 2×3')
    expect(render).not.toHaveBeenCalled()
  })

  it('passes source validation into the decoder so it can reject before copying full-resolution pixels', async () => {
    vi.spyOn(ImageProcessor, 'decodeImageOriginal').mockImplementation(async (_file, _signal, validate) => {
      validate?.(4, 2)
      return pixels
    })
    await expect(materializePhotoPixels(snapshot())).rejects.toThrow('decoded 4×2')
  })

  it('does not start a decode for an already canceled export', async () => {
    const controller = new AbortController()
    controller.abort()
    const decode = vi.spyOn(ImageProcessor, 'decodeImageOriginal')
    await expect(materializePhotoPixels(snapshot(), controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(decode).not.toHaveBeenCalled()
  })

  it('rejects a late decode after cancellation before rendering or returning pixels', async () => {
    const controller = new AbortController()
    let release!: (value: ImageData) => void
    vi.spyOn(ImageProcessor, 'decodeImageOriginal').mockReturnValue(new Promise(resolve => { release = resolve }))
    const render = vi.spyOn(transforms, 'renderImageTransform')
    const pending = materializePhotoPixels(snapshot(), controller.signal)
    controller.abort()
    release(pixels)
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    expect(render).not.toHaveBeenCalled()
  })
})
