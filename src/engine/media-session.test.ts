import { describe, expect, it, vi } from 'vitest'
import { MediaSession } from './media-session'
import { createDefaultTransformState } from './transform'
import type { ImageItem } from './types'
import type { VideoData } from './media-loading'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

function photo(id: string): ImageItem {
  const pixels = { width: 4, height: 3, data: new Uint8ClampedArray(48) } as ImageData
  return {
    id, file: new File(['image'], `${id}.jpg`, { type: 'image/jpeg' }), fileName: `${id}.jpg`,
    sourceSize: { width: 4, height: 3 }, thumbnail: pixels, transformedThumbnail: pixels,
    recipe: null, customSettings: {}, transform: createDefaultTransformState(),
  }
}

function video(id: string): VideoData {
  const pixels = photo(id).thumbnail
  return {
    video: { src: `blob:${id}` } as HTMLVideoElement,
    metadata: { width: 4, height: 3, aspectRatio: 4 / 3, duration: 3 },
    firstFrame: pixels, thumbnail: pixels,
  }
}

function setup() {
  type Loaders = ConstructorParameters<typeof MediaSession>[0]
  const loaders = {
    photos: vi.fn<Loaders['photos']>(async () => [photo('a')]),
    demo: vi.fn<Loaders['demo']>(async () => [photo('demo')]),
    video: vi.fn<Loaders['video']>(async () => video('a')),
    releaseVideo: vi.fn<Loaders['releaseVideo']>(),
  }
  return { session: new MediaSession(loaders), loaders }
}

it('validates appended photos against retained full source dimensions rather than preview dimensions', async () => {
  const { session, loaders } = setup()
  const retained = { ...photo('large'), sourceSize: { width: 8_000, height: 6_000 } }
  loaders.photos.mockResolvedValueOnce([retained])
  await session.load({ kind: 'photos', mode: 'replace', files: [retained.file] })
  const added = photo('added')
  loaders.photos.mockResolvedValueOnce([added])
  await session.load({ kind: 'photos', mode: 'append', files: [added.file] })
  expect(loaders.photos).toHaveBeenLastCalledWith(
    [added.file], [{ file: retained.file, width: 8_000, height: 6_000 }], expect.any(AbortSignal),
  )
})

const photos = (files = [photo('a').file]) => ({ kind: 'photos', files, mode: 'replace' } as const)
const videoRequest = { kind: 'video', file: new File(['video'], 'clip.mp4', { type: 'video/mp4' }) } as const

describe('media session transitions', () => {
  it('retains the active photo, edits, and index after a failed replacement and on return', async () => {
    const { session, loaders } = setup()
    loaders.photos.mockResolvedValueOnce([photo('a'), photo('b')])
    await session.load(photos())
    session.goToImage(1)
    session.updateImage('b', { customSettings: { highlight: 3 }, transform: { ...createDefaultTransformState(), fineAngle: 12 } })
    const previous = session.getSnapshot().media

    loaders.photos.mockRejectedValueOnce(new Error('Corrupt image'))
    await session.load(photos([photo('broken').file]))
    expect(session.getSnapshot()).toMatchObject({ status: 'error', message: 'Corrupt image' })
    expect(session.getSnapshot().media).toBe(previous)

    session.resume()
    expect(session.getSnapshot()).toEqual({ status: 'ready', media: previous })
  })

  it('retries only the failed append and preserves the existing batch', async () => {
    const { session, loaders } = setup()
    const original = photo('original')
    const added = photo('added')
    loaders.photos.mockResolvedValueOnce([original])
    await session.load(photos([original.file]))
    loaders.photos.mockRejectedValueOnce(new Error('Decode failed')).mockResolvedValueOnce([added])

    await session.load({ kind: 'photos', mode: 'append', files: [added.file] })
    expect(session.getSnapshot()).toMatchObject({ status: 'error', media: { images: [original] } })
    await session.retry()

    expect(loaders.photos.mock.calls[2]).toEqual([
      [added.file], [{ file: original.file, width: 4, height: 3 }], expect.any(AbortSignal),
    ])
    expect(session.getSnapshot()).toMatchObject({ status: 'ready', media: { kind: 'photos', images: [original, added] } })
  })

  it('does not publish a stale success when a decoder ignores cancellation', async () => {
    const { session, loaders } = setup()
    const first = deferred<ImageItem[]>()
    const second = deferred<ImageItem[]>()
    loaders.photos.mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise)
    const firstLoad = session.load(photos())
    const secondLoad = session.load(photos([photo('b').file]))
    second.resolve([photo('b')])
    await secondLoad
    const ready = session.getSnapshot()
    first.resolve([photo('a')])
    await firstLoad

    expect(session.getSnapshot()).toBe(ready)
    expect(loaders.photos.mock.calls[0][2].aborted).toBe(true)
  })

  it('does not hide a newer loading state when the earlier operation fails', async () => {
    const { session, loaders } = setup()
    const first = deferred<ImageItem[]>()
    const second = deferred<ImageItem[]>()
    loaders.photos.mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise)
    const firstLoad = session.load(photos())
    const secondLoad = session.load(photos([photo('b').file]))
    const loading = session.getSnapshot()
    first.reject(new Error('Old decoder failure'))
    await firstLoad
    expect(session.getSnapshot()).toBe(loading)
    expect(loading.status).toBe('loading')
    second.resolve([photo('b')])
    await secondLoad
    expect(session.getSnapshot().status).toBe('ready')
  })

  it('exposes demo failures for Retry instead of leaving an unhandled rejection', async () => {
    const { session, loaders } = setup()
    loaders.demo.mockRejectedValueOnce(new Error('Demo fetch failed'))
    await expect(session.load({ kind: 'demo' })).resolves.toBeUndefined()
    expect(session.getSnapshot()).toMatchObject({ status: 'error', request: { kind: 'demo' }, media: null })
    await session.retry()
    expect(session.getSnapshot()).toMatchObject({ status: 'ready', media: { kind: 'demo' } })
  })

  it('retries a video as the same file and clears its error after recovery', async () => {
    const { session, loaders } = setup()
    loaders.video.mockRejectedValueOnce(new Error('Unsupported format'))
    await session.load(videoRequest)
    await session.retry()
    expect(loaders.video.mock.calls[1][0]).toBe(videoRequest.file)
    expect(session.getSnapshot()).toMatchObject({ status: 'ready', media: { kind: 'video', fileName: 'clip.mp4' } })
  })

  it('keeps the previous video alive on failure and releases it only after successful replacement', async () => {
    const { session, loaders } = setup()
    const previous = video('previous')
    loaders.video.mockResolvedValueOnce(previous)
    await session.load(videoRequest)
    loaders.photos.mockRejectedValueOnce(new Error('Invalid photo'))
    await session.load(photos())
    expect(loaders.releaseVideo).not.toHaveBeenCalled()
    await session.retry()
    expect(loaders.releaseVideo).toHaveBeenCalledExactlyOnceWith(previous)
  })

  it('releases an obsolete video result without touching the newer photo', async () => {
    const { session, loaders } = setup()
    const pending = deferred<VideoData>()
    loaders.video.mockImplementationOnce(() => pending.promise)
    const loading = session.load(videoRequest)
    await session.load(photos())
    const ready = session.getSnapshot()
    const obsolete = video('obsolete')
    pending.resolve(obsolete)
    await loading
    expect(loaders.releaseVideo).toHaveBeenCalledExactlyOnceWith(obsolete)
    expect(session.getSnapshot()).toBe(ready)
  })

  it('disposes the current video and ignores a late replacement after unmount', async () => {
    const { session, loaders } = setup()
    const current = video('current')
    loaders.video.mockResolvedValueOnce(current)
    await session.load(videoRequest)
    const pending = deferred<VideoData>()
    loaders.video.mockImplementationOnce(() => pending.promise)
    const loading = session.load(videoRequest)
    session.dispose()
    const late = video('late')
    pending.resolve(late)
    await loading
    expect(loaders.releaseVideo.mock.calls).toEqual([[current], [late]])
    expect(session.getSnapshot()).toEqual({ status: 'empty', media: null })
    await session.load({ kind: 'demo' })
    expect(session.getSnapshot()).toMatchObject({ status: 'ready', media: { kind: 'demo' } })
  })
})
