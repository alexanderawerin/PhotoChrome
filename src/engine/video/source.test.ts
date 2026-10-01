import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { inspectSourceVideo } from './source'
import { ExportCancelledError } from './errors'

const mocks = vi.hoisted(() => ({ packets: vi.fn(), dispose: vi.fn(), decode: vi.fn() }))
vi.mock('mediabunny', () => ({ ALL_FORMATS: [], BlobSource: class {},
  Input: class {
    dispose = mocks.dispose
    async getPrimaryVideoTrack() { return { canDecode: mocks.decode, getDisplayWidth: async () => 180, getDisplayHeight: async () => 320 } }
  },
  EncodedPacketSink: class { packets = mocks.packets }, VideoSampleSink: class {},
}))
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob() }))
  mocks.decode.mockResolvedValue(true)
  mocks.packets.mockImplementation(async function* () { yield { timestamp: 0, duration: 1 / 24 }; yield { timestamp: 1 / 24, duration: 1 / 12 } })
})
afterEach(() => { vi.unstubAllGlobals(); vi.resetAllMocks() })

describe('source video metadata and cleanup', () => {
  it('uses rotated display axes and maximum source packet rate for variable timing', async () => {
    const source = await inspectSourceVideo('blob:test')
    expect(source).toMatchObject({ width: 180, height: 320, frameRate: 24, packetCount: 2, duration: .125 })
    source.dispose()
    expect(mocks.dispose).toHaveBeenCalledOnce()
  })
  it('retains the 30 second limit and disposes rejected inputs', async () => {
    mocks.packets.mockImplementation(async function* () { yield { timestamp: 30, duration: .1 } })
    await expect(inspectSourceVideo('blob:test')).rejects.toThrow('up to 30 seconds')
    expect(mocks.dispose).toHaveBeenCalledOnce()
  })
  it('cancels metadata inspection without leaking the input', async () => {
    await expect(inspectSourceVideo('blob:test', () => true)).rejects.toBeInstanceOf(ExportCancelledError)
    expect(mocks.dispose).toHaveBeenCalledOnce()
  })
})
