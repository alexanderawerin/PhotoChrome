import { afterEach, describe, expect, it, vi } from 'vitest'
import { encodeAudio, inspectSourceAudio, supportsAudioEncoding } from './audio'

const mocks = vi.hoisted(() => ({ dispose: vi.fn(), track: vi.fn(), samples: vi.fn() }))
vi.mock('mediabunny', () => ({
  ALL_FORMATS: [], BlobSource: class {},
  Input: class { getPrimaryAudioTrack = mocks.track; dispose = mocks.dispose },
  AudioSampleSink: class { samples = mocks.samples },
}))
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks() })

describe('source audio policy and resource ownership', () => {
  it('identifies silent sources without asking an audio encoder', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob() }))
    mocks.track.mockResolvedValue(null)
    const source = await inspectSourceAudio('blob:source')
    expect(source.track).toBeNull()
    expect(source.config).toBeNull()
    source.dispose()
    expect(mocks.dispose).toHaveBeenCalledOnce()
  })

  it('queries the actual source channel count and sample rate', async () => {
    const supported = vi.fn().mockResolvedValue({ supported: true })
    vi.stubGlobal('AudioEncoder', { isConfigSupported: supported })
    vi.stubGlobal('AudioData', class {})
    const config = { codec: 'mp4a.40.2', numberOfChannels: 1, sampleRate: 44100, bitrate: 128000 }
    expect(await supportsAudioEncoding(config)).toBe(true)
    expect(supported).toHaveBeenCalledWith(config)
  })

  it('closes an encoder when configure fails', async () => {
    const close = vi.fn()
    vi.stubGlobal('AudioEncoder', class {
      state = 'unconfigured'
      close = close
      configure() { throw new Error('cannot configure') }
    })
    await expect(encodeAudio({ track: {} as never, config: {} as never, dispose() {} }, () => {})).rejects.toThrow('cannot configure')
    expect(close).toHaveBeenCalledOnce()
  })

  it('preserves decoded source timestamps and closes every sample/data', async () => {
    const close = vi.fn()
    const data = { timestamp: 250000, close: vi.fn() }
    const sample = { toAudioData: () => data, close: vi.fn() }
    const encode = vi.fn()
    mocks.samples.mockImplementation(async function* () { yield sample })
    vi.stubGlobal('AudioEncoder', class {
      state = 'configured'; encodeQueueSize = 0
      configure() {}
      encode = encode
      async flush() {}
      close = close
    })
    await encodeAudio({ track: {} as never, config: {} as never, dispose() {} }, () => {})
    expect(encode).toHaveBeenCalledWith(data)
    expect(data.timestamp).toBe(250000)
    expect(sample.close).toHaveBeenCalledOnce()
    expect(data.close).toHaveBeenCalledOnce()
    expect(close).toHaveBeenCalledOnce()
  })
})
