import { afterEach, describe, expect, it, vi } from 'vitest'
import { decodeImages, decodeVideo, loadDemoImages } from './media-loading'
import { ImageProcessor } from './processor'
import * as exif from './exif'
import * as frames from './video/frames'

const pixels = { width: 4, height: 3, data: new Uint8ClampedArray(48) } as ImageData
const imageFile = new File(['image'], 'photo.jpg', { type: 'image/jpeg' })

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('atomic photo decoding', () => {
  it('rejects a canceled decode even if the native bitmap operation completes', async () => {
    const controller = new AbortController()
    vi.spyOn(exif, 'extractExif').mockResolvedValue({})
    vi.spyOn(ImageProcessor, 'decodeImagePair').mockImplementation(async () => {
      controller.abort()
      return { original: pixels, thumbnail: pixels, width: pixels.width, height: pixels.height }
    })

    await expect(decodeImages([imageFile], [], controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('validates added dimensions against the retained batch before accepting any new photo', async () => {
    vi.spyOn(exif, 'extractExif').mockResolvedValue({})
    vi.spyOn(ImageProcessor, 'decodeImagePair').mockImplementation(async (_file, _size, validate) => {
      validate?.(8_000, 8_000)
      return { original: pixels, thumbnail: pixels, width: pixels.width, height: pixels.height }
    })
    const existing = Array.from({ length: 3 }, () => ({ file: imageFile, width: 8_000, height: 8_000 }))

    await expect(decodeImages([imageFile], existing)).rejects.toThrow('total')
  })

  it('does not accept a partial result when one file in a selection fails', async () => {
    vi.spyOn(exif, 'extractExif').mockResolvedValue({})
    const decode = vi.spyOn(ImageProcessor, 'decodeImagePair')
      .mockResolvedValueOnce({ original: pixels, thumbnail: pixels, width: pixels.width, height: pixels.height })
      .mockRejectedValueOnce(new Error('Corrupt second file'))

    await expect(decodeImages([imageFile, imageFile])).rejects.toThrow('Corrupt second file')
    expect(decode).toHaveBeenCalledTimes(2)
  })
})

describe('demo loading', () => {
  it('propagates HTTP failures and passes the operation signal to every fetch', async () => {
    const signal = new AbortController().signal
    const fetch = vi.fn().mockResolvedValue({ ok: false })
    vi.stubGlobal('fetch', fetch)
    await expect(loadDemoImages(['/one.webp', '/two.webp'], signal)).rejects.toThrow('Failed to load demo photo')
    expect(fetch.mock.calls).toEqual([
      ['/one.webp', { signal }], ['/two.webp', { signal }],
    ])
  })
})

describe('video resource ownership', () => {
  const file = new File(['video'], 'clip.mp4', { type: 'video/mp4' })

  it('releases a loaded video when first-frame extraction fails', async () => {
    const video = { src: 'blob:video' } as HTMLVideoElement
    vi.spyOn(frames, 'loadVideo').mockResolvedValue({ video, metadata: { width: 4, height: 3, duration: 3, aspectRatio: 4 / 3 } })
    vi.spyOn(frames, 'extractFirstFrame').mockRejectedValue(new Error('Frame unavailable'))
    const release = vi.spyOn(frames, 'releaseVideo').mockImplementation(() => {})

    await expect(decodeVideo(file)).rejects.toThrow('Frame unavailable')
    expect(release).toHaveBeenCalledExactlyOnceWith(video)
  })

  it('releases the video instead of publishing it if cancellation arrives during thumbnail decoding', async () => {
    const video = { src: 'blob:video' } as HTMLVideoElement
    const controller = new AbortController()
    vi.spyOn(frames, 'loadVideo').mockResolvedValue({ video, metadata: { width: 4, height: 3, duration: 3, aspectRatio: 4 / 3 } })
    vi.spyOn(frames, 'extractFirstFrame').mockResolvedValue(pixels)
    vi.spyOn(frames, 'createVideoThumbnail').mockImplementation(async () => {
      controller.abort()
      return pixels
    })
    const release = vi.spyOn(frames, 'releaseVideo').mockImplementation(() => {})

    await expect(decodeVideo(file, controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(release).toHaveBeenCalledExactlyOnceWith(video)
  })

  it('stops a native video load and releases its URL on abort', async () => {
    const video = {
      src: '', pause: vi.fn(), load: vi.fn(),
      removeAttribute: vi.fn(() => { video.src = '' }),
      onloadedmetadata: null, oncanplay: null, onerror: null,
    }
    vi.stubGlobal('navigator', { userAgent: 'Chrome' })
    vi.stubGlobal('document', { createElement: () => video })
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test-video')
    const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const controller = new AbortController()
    const loading = frames.loadVideo(file, controller.signal)
    controller.abort()

    await expect(loading).rejects.toMatchObject({ name: 'AbortError' })
    expect(revoke).toHaveBeenCalledExactlyOnceWith('blob:test-video')
    expect(video.pause).toHaveBeenCalledOnce()
    expect(video.src).toBe('')
    expect(video.onerror).toBeNull()
    expect(video.onloadedmetadata).toBeNull()
  })
})
