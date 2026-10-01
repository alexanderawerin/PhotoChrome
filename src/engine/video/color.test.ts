import { afterEach, describe, expect, it, vi } from 'vitest'
import type { VideoSample } from 'mediabunny'
import { drawSourceSample, readPlaybackColorSpace } from './color'

const mocks = vi.hoisted(() => ({ constructSample: vi.fn(), draw: vi.fn(), closeSample: vi.fn() }))
vi.mock('mediabunny', () => ({ VideoSample: class {
  constructor(frame: VideoFrame, options: unknown) { mocks.constructSample(frame, options) }
  draw = mocks.draw
  close = mocks.closeSample
} }))
afterEach(() => { vi.unstubAllGlobals(); vi.resetAllMocks() })
const playbackColor: VideoColorSpaceInit = { primaries: 'smpte170m', transfer: 'smpte170m', matrix: 'smpte170m', fullRange: false }

function sample() {
  const frame = { format: 'I420', visibleRect: { width: 320, height: 180 }, displayWidth: 320, displayHeight: 180,
    allocationSize: () => 86400, copyTo: vi.fn().mockResolvedValue([{ offset: 0, stride: 320 }]), close: vi.fn() }
  return { frame, value: {
    colorSpace: { primaries: 'bt709', transfer: 'bt709', matrix: 'bt709', fullRange: false },
    rotation: 270, microsecondTimestamp: 125000, microsecondDuration: 41667,
    toVideoFrame: () => frame, draw: vi.fn(),
  } as unknown as VideoSample }
}

describe('preview and timed decoder color consistency', () => {
  it('reads and closes the native HTML playback frame without guessing a browser matrix', () => {
    const close = vi.fn()
    vi.stubGlobal('VideoFrame', class { colorSpace = { toJSON: () => playbackColor }; close = close })
    expect(readPlaybackColorSpace({} as HTMLVideoElement)).toEqual(playbackColor)
    expect(close).toHaveBeenCalledOnce()
  })
  it('re-tags raw planes when decoder and native playback matrices differ, preserving rotation and timing', async () => {
    const options = vi.fn()
    vi.stubGlobal('VideoFrame', class { constructor(_data: unknown, init: unknown) { options(init) } })
    const source = sample()
    await drawSourceSample(source.value, {} as CanvasRenderingContext2D, 180, 320, playbackColor)
    expect(options).toHaveBeenCalledWith(expect.objectContaining({ colorSpace: playbackColor, timestamp: 125000, duration: 41667, codedWidth: 320, codedHeight: 180 }))
    expect(mocks.constructSample).toHaveBeenCalledWith(expect.anything(), { rotation: 270 })
    expect(mocks.draw).toHaveBeenCalledWith(expect.anything(), 0, 0, 180, 320)
    expect(source.frame.close).toHaveBeenCalledOnce()
    expect(mocks.closeSample).toHaveBeenCalledOnce()
  })
  it('avoids copying samples whose color interpretation already matches playback', async () => {
    const source = sample()
    await drawSourceSample(source.value, {} as CanvasRenderingContext2D, 320, 180, source.value.colorSpace)
    expect(source.value.draw).toHaveBeenCalledOnce()
    expect(source.frame.copyTo).not.toHaveBeenCalled()
  })
  it('closes the temporary frame if raw plane copying fails', async () => {
    const source = sample()
    source.frame.copyTo.mockRejectedValue(new Error('copy failed'))
    await expect(drawSourceSample(source.value, {} as CanvasRenderingContext2D, 180, 320, playbackColor)).rejects.toThrow('copy failed')
    expect(source.frame.close).toHaveBeenCalledOnce()
    expect(mocks.constructSample).not.toHaveBeenCalled()
  })
})
