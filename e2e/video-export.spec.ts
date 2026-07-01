import { readFile } from 'node:fs/promises'
import {
  ALL_FORMATS,
  BufferSource,
  EncodedPacketSink,
  Input,
} from 'mediabunny'
import { test, expect } from './helpers/fixtures'
import { fixturePath, selectFirstRecipe, uploadVideo } from './helpers/upload'

async function inspectMp4(buffer: Uint8Array) {
  const input = new Input({ source: new BufferSource(buffer), formats: ALL_FORMATS })
  try {
    const video = await input.getPrimaryVideoTrack()
    const audio = await input.getPrimaryAudioTrack()
    if (!video) throw new Error('Missing video track')
    let videoPackets = 0
    for await (const _packet of new EncodedPacketSink(video).packets()) videoPackets++
    return {
      duration: await input.computeDuration(),
      videoCodec: await video.getCodec(),
      width: await video.getCodedWidth(),
      height: await video.getCodedHeight(),
      videoPackets,
      audioCodec: audio ? await audio.getCodec() : null,
      sampleRate: audio ? await audio.getSampleRate() : null,
    }
  } finally {
    input.dispose()
  }
}

test.describe('Video import and export', () => {
  test('fixture is 3s 640×360 H.264 at 30 FPS with AAC 440 Hz audio', async ({ page, landingPage }) => {
    const fixture = await inspectMp4(await readFile(fixturePath('test-video.mp4')))
    expect(fixture).toMatchObject({
      duration: 3,
      videoCodec: 'avc',
      width: 640,
      height: 360,
      videoPackets: 90,
      audioCodec: 'aac',
      sampleRate: 48_000,
    })

    const frequency = await page.evaluate(async () => {
      const response = await fetch('/e2e/fixtures/test-video.mp4')
      const context = new AudioContext()
      try {
        const audio = await context.decodeAudioData(await response.arrayBuffer())
        const samples = audio.getChannelData(0)
        const start = Math.floor(audio.sampleRate * 0.25)
        const end = Math.floor(audio.sampleRate * 2.75)
        let positiveCrossings = 0
        for (let index = start + 1; index < end; index++) {
          if (samples[index - 1] <= 0 && samples[index] > 0) positiveCrossings++
        }
        return positiveCrossings / ((end - start) / audio.sampleRate)
      } finally {
        await context.close()
      }
    })
    expect(frequency).toBeGreaterThan(438)
    expect(frequency).toBeLessThan(442)
  })

  test('imports, applies a recipe, recovers from unsupported WebCodecs, and exports video', async ({ page, landingPage, browserName }) => {
    test.skip(browserName !== 'chromium', 'WebCodecs export is verified in Chromium')
    test.setTimeout(90_000)
    await uploadVideo(page)
    await expect(page.getByText('test-video.mp4')).toBeVisible()
    await selectFirstRecipe(page)
    await expect(page.getByRole('button', { name: 'Export video' })).toBeEnabled()

    const audioEncodingSupported = await page.evaluate(async () => {
      if (typeof AudioEncoder === 'undefined') return false
      try {
        const support = await AudioEncoder.isConfigSupported({
          codec: 'mp4a.40.2',
          sampleRate: 48_000,
          numberOfChannels: 2,
          bitrate: 128_000,
        })
        return support.supported === true
      } catch {
        return false
      }
    })

    await page.evaluate(() => {
      // @ts-expect-error Test-only capability toggle.
      window.__originalVideoEncoder = window.VideoEncoder
      Object.defineProperty(window, 'VideoEncoder', { configurable: true, value: undefined })
    })
    await page.getByRole('button', { name: 'Export video' }).click()
    const alert = page.getByRole('alert')
    await expect(alert).toContainText('not supported in this browser')

    await page.evaluate(() => {
      Object.defineProperty(window, 'VideoEncoder', {
        configurable: true,
        // @ts-expect-error Test-only capability toggle.
        value: window.__originalVideoEncoder,
      })
    })
    const downloadPromise = page.waitForEvent('download')
    await alert.getByRole('button', { name: 'Retry' }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/^photochrome_.+_test-video\.mp4$/)

    const downloadPath = await download.path()
    if (!downloadPath) throw new Error('Downloaded video path unavailable')
    const output = await inspectMp4(await readFile(downloadPath))
    expect(output.videoCodec).toBe('avc')
    expect(output.width).toBe(640)
    expect(output.height).toBe(360)
    expect(output.videoPackets).toBe(90)
    expect(output.audioCodec).toBe(audioEncodingSupported ? 'aac' : null)
    expect(output.duration).toBeGreaterThanOrEqual(2.9)
    expect(output.duration).toBeLessThanOrEqual(3.1)
    await expect(alert).toHaveCount(0)
  })
})
