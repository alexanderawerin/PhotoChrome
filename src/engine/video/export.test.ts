import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { exportVideo } from './export'
import { createDefaultTransformState } from '../transform'
import { AudioPreservationError, ExportCancelledError } from './errors'

const mocks = vi.hoisted(() => ({
  source: vi.fn(), audioSupport: vi.fn(), disposeAudio: vi.fn(), encodeAudio: vi.fn(),
  disposeProcessor: vi.fn(), muxer: vi.fn(), cancelMuxer: vi.fn(), finalize: vi.fn(),
  closeEncoder: vi.fn(), configureEncoder: vi.fn(), disposeVideo: vi.fn(), samples: vi.fn(),
  encodeFrame: vi.fn(), processFrame: vi.fn(), addVideoChunk: vi.fn(), closeFrame: vi.fn(),
}))
vi.mock('./audio', () => ({ inspectSourceAudio: mocks.source, supportsAudioEncoding: mocks.audioSupport, encodeAudio: mocks.encodeAudio }))
vi.mock('./color', () => ({ readPlaybackColorSpace: () => undefined, drawSourceSample: async (sample: { draw: () => void }) => sample.draw() }))
vi.mock('./source', () => ({ inspectSourceVideo: async () => ({ width: 16, height: 16, frameRate: 24, packetCount: 0, duration: 1, samples: mocks.samples, dispose: mocks.disposeVideo }) }))
vi.mock('./geometry', async importOriginal => ({ ...await importOriginal<typeof import('./geometry')>(), renderVideoTransform: (source: unknown) => source }))
vi.mock('./capabilities', () => ({ getExportCapabilities: async () => ({ videoSupported: true, recommendedCodec: 'avc1.42001e' }), isSafari: () => false }))
vi.mock('../webgl/processor', () => ({
  WebGLContextLostError: class extends Error {},
  WebGLProcessor: class { init() {} processFrame = mocks.processFrame; dispose = mocks.disposeProcessor },
}))
vi.mock('./muxing', () => ({ createVideoMuxer: mocks.muxer }))
const video = { videoWidth: 16, videoHeight: 16, duration: 0, src: 'blob:test' } as HTMLVideoElement
const plan = {} as Parameters<typeof exportVideo>[1]
beforeEach(() => {
  vi.stubGlobal('VideoEncoder', class {
    state = 'configured'; encodeQueueSize = 0
    constructor(private callbacks: VideoEncoderInit) {}
    encode(frame: VideoFrame) { mocks.encodeFrame(frame); this.callbacks.output({ timestamp: frame.timestamp } as EncodedVideoChunk, {}) }
    configure = mocks.configureEncoder
    close = mocks.closeEncoder
    async flush() {}
  })
  vi.stubGlobal('VideoFrame', class { timestamp: number; duration: number; close = mocks.closeFrame; constructor(_source: unknown, init: VideoFrameInit) { this.timestamp = init.timestamp ?? 0; this.duration = init.duration ?? 0 } })
  mocks.samples.mockImplementation(async function* () {})
  mocks.processFrame.mockImplementation(source => source)
  vi.stubGlobal('document', { createElement: () => ({ getContext: () => ({}) }) })
  mocks.source.mockResolvedValue({ track: null, config: null, dispose: mocks.disposeAudio })
  mocks.audioSupport.mockResolvedValue(false)
  mocks.muxer.mockResolvedValue({ cancel: mocks.cancelMuxer, finalize: mocks.finalize, addVideoChunk: mocks.addVideoChunk })
  mocks.cancelMuxer.mockResolvedValue(undefined)
  mocks.finalize.mockResolvedValue(new Blob())
})
afterEach(() => { vi.unstubAllGlobals(); vi.resetAllMocks() })

describe('MP4 consent and partial initialization', () => {
  it('requires consent before creating output when an actual source audio track is unsupported', async () => {
    mocks.source.mockResolvedValue({ track: {}, config: { sampleRate: 48000, numberOfChannels: 1 }, dispose: mocks.disposeAudio })
    await expect(exportVideo(video, plan, () => {})).rejects.toBeInstanceOf(AudioPreservationError)
    expect(mocks.muxer).not.toHaveBeenCalled()
    expect(mocks.disposeAudio).toHaveBeenCalledOnce()
  })

  it('exports a silent source without encoder support or consent', async () => {
    await expect(exportVideo(video, plan, () => {})).resolves.toBeInstanceOf(Blob)
    expect(mocks.audioSupport).not.toHaveBeenCalled()
    expect(mocks.muxer).toHaveBeenCalledWith(16, 16, undefined)
  })

  it('exports unsupported sound only after explicit consent', async () => {
    mocks.source.mockResolvedValue({ track: {}, config: { sampleRate: 48000, numberOfChannels: 1 }, dispose: mocks.disposeAudio })
    await expect(exportVideo(video, plan, () => {}, undefined, { allowSilentAudio: true })).resolves.toBeInstanceOf(Blob)
    expect(mocks.muxer).toHaveBeenCalledWith(16, 16, undefined)
  })

  it.each(['configure', 'encode', 'flush', 'decoder'])('offers explicit silent export after an actual %s audio failure', async phase => {
    mocks.source.mockResolvedValue({ track: { canDecode: async () => true }, config: { sampleRate: 48000, numberOfChannels: 1 }, dispose: mocks.disposeAudio })
    mocks.audioSupport.mockResolvedValue(true)
    mocks.encodeAudio.mockRejectedValue(new Error(`${phase} failed`))
    await expect(exportVideo(video, plan, () => {})).rejects.toBeInstanceOf(AudioPreservationError)
    expect(mocks.encodeAudio).toHaveBeenCalledOnce()
    expect(mocks.closeEncoder).toHaveBeenCalled()
    expect(mocks.cancelMuxer).toHaveBeenCalledOnce()
    expect(mocks.finalize).not.toHaveBeenCalled()
    expect(mocks.disposeAudio).toHaveBeenCalledOnce()
    expect(mocks.disposeVideo).toHaveBeenCalledOnce()
    expect(mocks.disposeProcessor).toHaveBeenCalledOnce()
    // Explicit consent must omit audio even when the probe still says it is supported.
    await expect(exportVideo(video, plan, () => {}, undefined, { allowSilentAudio: true })).resolves.toBeInstanceOf(Blob)
    expect(mocks.encodeAudio).toHaveBeenCalledOnce()
    expect(mocks.muxer).toHaveBeenLastCalledWith(16, 16, undefined)
    expect(mocks.source).toHaveBeenCalledOnce()
  })

  it('keeps cancellation during audio encoding separate from silent-export consent', async () => {
    mocks.source.mockResolvedValue({ track: { canDecode: async () => true }, config: { sampleRate: 48000, numberOfChannels: 1 }, dispose: mocks.disposeAudio })
    mocks.audioSupport.mockResolvedValue(true)
    const cancelled = new ExportCancelledError()
    mocks.encodeAudio.mockRejectedValue(cancelled)
    await expect(exportVideo(video, plan, () => {})).rejects.toBe(cancelled)
    expect(mocks.cancelMuxer).toHaveBeenCalledOnce()
    expect(mocks.disposeAudio).toHaveBeenCalledOnce()
    expect(mocks.disposeVideo).toHaveBeenCalledOnce()
  })

  it('treats an abort concurrent with an audio failure as cancellation', async () => {
    let cancelled = false
    mocks.source.mockResolvedValue({ track: { canDecode: async () => true }, config: { sampleRate: 48000, numberOfChannels: 1 }, dispose: mocks.disposeAudio })
    mocks.audioSupport.mockResolvedValue(true)
    mocks.encodeAudio.mockImplementation(async () => { cancelled = true; throw new Error('decoder was closed') })
    await expect(exportVideo(video, plan, () => {}, () => cancelled)).rejects.toBeInstanceOf(ExportCancelledError)
    expect(mocks.cancelMuxer).toHaveBeenCalledOnce()
    expect(mocks.finalize).not.toHaveBeenCalled()
  })

  it('disposes processor and source if muxer initialization fails', async () => {
    mocks.muxer.mockRejectedValue(new Error('start failed'))
    await expect(exportVideo(video, plan, () => {})).rejects.toThrow('start failed')
    expect(mocks.disposeProcessor).toHaveBeenCalledOnce()
    expect(mocks.disposeAudio).toHaveBeenCalledOnce()
  })

  it('closes encoder and cancels muxer if encoder configuration fails', async () => {
    mocks.configureEncoder.mockImplementation(() => { throw new Error('configure failed') })
    await expect(exportVideo(video, plan, () => {})).rejects.toThrow('configure failed')
    expect(mocks.closeEncoder).toHaveBeenCalled()
    expect(mocks.cancelMuxer).toHaveBeenCalledOnce()
    expect(mocks.disposeProcessor).toHaveBeenCalledOnce()
  })

  it('does not deliver output when cancellation occurs during finalization', async () => {
    let cancelled = false
    mocks.finalize.mockImplementation(async () => { cancelled = true; return new Blob() })
    await expect(exportVideo(video, plan, () => {}, () => cancelled)).rejects.toBeInstanceOf(ExportCancelledError)
    expect(mocks.cancelMuxer).toHaveBeenCalledOnce()
    expect(mocks.disposeAudio).toHaveBeenCalledOnce()
    expect(mocks.disposeProcessor).toHaveBeenCalledOnce()
  })
  it('encodes every source sample with its own presentation timestamp and duration', async () => {
    const closes = [vi.fn(), vi.fn(), vi.fn()]
    const timestamps = [125000, 166667, 250000]
    const durations = [41667, 83333, 20833]
    mocks.samples.mockImplementation(async function* () {
      for (let index = 0; index < 3; index++) yield {
        timestamp: timestamps[index] / 1e6, microsecondTimestamp: timestamps[index], microsecondDuration: durations[index],
        draw() {}, close: closes[index],
      }
    })
    const geometry = { ...createDefaultTransformState(), quarterTurns: 90 as const, cropRatio: 'free' as const,
      cropRect: { x: 0, y: 0, width: .7, height: .9 } }
    await exportVideo(video, { ...plan, geometry }, () => {})
    expect(mocks.encodeFrame.mock.calls.map(([frame]) => [frame.timestamp, frame.duration])).toEqual(timestamps.map((time, index) => [time, durations[index]]))
    expect(mocks.addVideoChunk.mock.calls.map(([, , duration]) => duration)).toEqual(durations)
    expect(mocks.configureEncoder).toHaveBeenCalledWith(expect.objectContaining({ width: 12, height: 14, framerate: 24 }))
    expect(mocks.closeFrame).toHaveBeenCalledTimes(3)
    closes.forEach(close => expect(close).toHaveBeenCalledOnce())
    expect(mocks.disposeVideo).toHaveBeenCalledOnce()
  })

})
