import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearPreviewCaches, previewSize, resizePreviewImage } from './preview-image'
import { SMALL_IMAGE_CACHE_MAX_SIZE } from '../constants'

const source = (width = 1600, height = 1000) => ({ width, height, data: new Uint8ClampedArray(0) }) as ImageData

afterEach(() => { clearPreviewCaches(); vi.unstubAllGlobals() })

describe('small preview preparation', () => {
  it('preserves aspect ratio, bounds the longest dimension, and never upscales', () => {
    expect(previewSize(1600, 1000, 80)).toEqual({ width: 80, height: 50 })
    expect(previewSize(1000, 1600, 80)).toEqual({ width: 50, height: 80 })
    expect(previewSize(8, 4, 250)).toEqual({ width: 8, height: 4 })
    expect(previewSize(1600, 1, 80)).toEqual({ width: 80, height: 1 })
  })

  it('reuses a bounded resize cache and releases every temporary canvas backing', () => {
    const canvases: { width: number; height: number }[] = []
    const read = vi.fn((_x: number, _y: number, width: number, height: number) => source(width, height))
    vi.stubGlobal('document', { createElement: () => {
      const canvas = { width: 0, height: 0, getContext: () => ({ putImageData() {}, drawImage() {}, getImageData: read }) }
      canvases.push(canvas)
      return canvas
    } })
    const image = source()
    const small = resizePreviewImage(image, 80)
    expect(small).toMatchObject({ width: 80, height: 50 })
    expect(resizePreviewImage(image, 80)).toBe(small)
    expect(read).toHaveBeenCalledTimes(1)
    for (let i = 0; i < SMALL_IMAGE_CACHE_MAX_SIZE; i++) resizePreviewImage(source(), 80)
    expect(resizePreviewImage(image, 80)).not.toBe(small)
    for (const canvas of canvases) expect(canvas).toMatchObject({ width: 0, height: 0 })
    clearPreviewCaches()
    const count = read.mock.calls.length
    resizePreviewImage(image, 80)
    expect(read).toHaveBeenCalledTimes(count + 1)
  })

  it('releases backing stores when a canvas context fails', () => {
    const canvases: { width: number; height: number }[] = []
    vi.stubGlobal('document', { createElement: () => {
      const canvas = { width: 0, height: 0, getContext: () => null }
      canvases.push(canvas)
      return canvas
    } })
    expect(() => resizePreviewImage(source(), 80)).toThrow('Preview canvas unavailable')
    for (const canvas of canvases) expect(canvas).toMatchObject({ width: 0, height: 0 })
  })
})
