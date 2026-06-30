import { afterEach, describe, expect, it, vi } from 'vitest'
import { ImageProcessor } from './processor'

describe('ImageProcessor.decodeImagePair', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('creates full-size and preview data from one ImageBitmap and closes it', async () => {
    const events: string[] = []
    const bitmap = {
      width: 4_000,
      height: 2_000,
      close: vi.fn(() => events.push('close')),
    }
    const drawImage = vi.fn(() => events.push('draw'))
    const getImageData = vi.fn((_x: number, _y: number, width: number, height: number) => ({ width, height }))

    vi.stubGlobal('createImageBitmap', vi.fn(async () => bitmap))
    vi.stubGlobal('document', {
      createElement: () => ({
        width: 0,
        height: 0,
        getContext: () => ({ drawImage, getImageData }),
      }),
    })

    const result = await ImageProcessor.decodeImagePair(
      new File(['image'], 'photo.jpg', { type: 'image/jpeg' }),
      1_000,
      () => events.push('validate')
    )

    expect(createImageBitmap).toHaveBeenCalledOnce()
    expect(drawImage).toHaveBeenCalledTimes(2)
    expect(result.original).toMatchObject({ width: 4_000, height: 2_000 })
    expect(result.thumbnail).toMatchObject({ width: 1_000, height: 500 })
    expect(events).toEqual(['validate', 'draw', 'draw', 'close'])
  })

  it('closes the bitmap when dimension validation rejects the file', async () => {
    const bitmap = { width: 10_000, height: 10_000, close: vi.fn() }
    vi.stubGlobal('createImageBitmap', vi.fn(async () => bitmap))

    await expect(ImageProcessor.decodeImagePair(
      new File(['image'], 'huge.jpg', { type: 'image/jpeg' }),
      1_000,
      () => { throw new Error('64 MP limit') }
    )).rejects.toThrow('64 MP limit')

    expect(bitmap.close).toHaveBeenCalledOnce()
  })
})
