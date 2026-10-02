import { readFile } from 'node:fs/promises'
import {
  ALL_FORMATS,
  BufferSource,
  EncodedPacketSink,
  Input,
} from 'mediabunny'
import { test, expect } from './helpers/fixtures'
import { fixturePath, selectBaseFilm, uploadVideo } from './helpers/upload'

async function inspectMp4(buffer: Uint8Array) {
  const input = new Input({ source: new BufferSource(buffer), formats: ALL_FORMATS })
  try {
    const video = await input.getPrimaryVideoTrack()
    const audio = await input.getPrimaryAudioTrack()
    if (!video) throw new Error('Missing video track')
    let audioPackets = 0
    let audioStart: number | null = null
    let audioEnd: number | null = null
    if (audio) for await (const packet of new EncodedPacketSink(audio).packets()) {
      audioPackets++
      audioStart = Math.min(audioStart ?? packet.timestamp, packet.timestamp)
      audioEnd = Math.max(audioEnd ?? 0, packet.timestamp + packet.duration)
    }
    let videoPackets = 0
    for await (const _packet of new EncodedPacketSink(video).packets()) videoPackets++
    return {
      duration: await input.computeDuration(),
      videoCodec: await video.getCodec(),
      width: await video.getCodedWidth(),
      height: await video.getCodedHeight(),
      videoPackets,
      audioPackets, audioStart, audioEnd,
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

  test('imports, applies a recipe, recovers from unsupported WebCodecs, and exports video', async ({ page, landingPage, browserName }, testInfo) => {
    test.skip(browserName !== 'chromium', 'WebCodecs export is verified in Chromium')
    test.setTimeout(90_000)
    await uploadVideo(page)
    await expect(page.getByText('test-video.mp4')).toBeVisible()
    await selectBaseFilm(page)
    await expect(page.getByRole('button', { name: 'Export video' })).toBeEnabled()

    const audioEncodingSupported = await page.evaluate(async () => {
      if (typeof AudioEncoder === 'undefined') return false
      try {
        const support = await AudioEncoder.isConfigSupported({
          codec: 'mp4a.40.2',
          sampleRate: 48_000,
          numberOfChannels: 1,
          bitrate: 128_000,
        })
        return support.supported === true
      } catch {
        return false
      }
    })
    await testInfo.attach('aac-capability', {
      body: JSON.stringify({
        browserVersion: page.context().browser()?.version(),
        userAgent: await page.evaluate(() => navigator.userAgent),
        config: { codec: 'mp4a.40.2', sampleRate: 48_000, numberOfChannels: 1, bitrate: 128_000 },
        supported: audioEncodingSupported,
      }, null, 2),
      contentType: 'application/json',
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
    if (!audioEncodingSupported) await page.getByRole('button', { name: 'Export without sound', exact: true }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/^photochrome_.+_test-video\.mp4$/)

    const downloadPath = testInfo.outputPath('recipe-audio.mp4')
    await download.saveAs(downloadPath)
    await testInfo.attach('recipe-audio', { path: downloadPath, contentType: 'video/mp4' })
    const outputBuffer = await readFile(downloadPath)
    const output = await inspectMp4(outputBuffer)
    await testInfo.attach('export-metadata', { body: JSON.stringify(output, null, 2), contentType: 'application/json' })
    expect(output.videoCodec).toBe('avc')
    expect(output.width).toBe(640)
    expect(output.height).toBe(360)
    expect(output.videoPackets).toBe(90)
    expect(output.audioCodec).toBe(audioEncodingSupported ? 'aac' : null)
    expect(output.duration).toBeGreaterThanOrEqual(2.9)
    expect(output.duration).toBeLessThanOrEqual(3.1)
    if (audioEncodingSupported) {
      expect(output.audioPackets).toBeGreaterThan(100)
      expect(output.audioStart).toBeGreaterThanOrEqual(-0.05)
      expect(output.audioStart).toBeLessThanOrEqual(0.05)
      expect(output.audioEnd).toBeGreaterThan(2.95)
      expect(output.audioEnd).toBeLessThan(3.1)
      const signal = await page.evaluate(async bytes => {
        const context = new AudioContext()
        try {
          const decoded = await context.decodeAudioData(new Uint8Array(bytes).buffer)
          const data = decoded.getChannelData(0)
          const start = Math.floor(decoded.sampleRate * .25)
          const end = Math.floor(decoded.sampleRate * 2.75)
          let crossings = 0
          let power = 0
          for (let index = start + 1; index < end; index++) {
            if (data[index - 1] <= 0 && data[index] > 0) crossings++
            power += data[index] ** 2
          }
          return { frequency: crossings / ((end - start) / decoded.sampleRate), rms: Math.sqrt(power / (end - start)) }
        } finally { await context.close() }
      }, [...outputBuffer])
      expect(signal.frequency).toBeGreaterThan(438)
      expect(signal.frequency).toBeLessThan(442)
      expect(signal.rms).toBeGreaterThan(.01)
    }
    await expect(alert).toHaveCount(0)
  })
  test('unsupported source sound waits for explicit consent and can be dismissed', async ({ page, landingPage, browserName }) => {
    test.skip(browserName !== 'chromium')
    test.setTimeout(90000)
    await page.evaluate(() => { Object.defineProperty(window, 'AudioEncoder', { configurable: true, value: undefined }) })
    await uploadVideo(page)
    await selectBaseFilm(page)
    const downloads: unknown[] = []
    page.on('download', download => downloads.push(download))
    await page.getByRole('button', { name: 'Export video', exact: true }).click()
    const consent = page.getByRole('button', { name: 'Export without sound', exact: true })
    await expect(consent).toBeVisible()
    expect(downloads).toHaveLength(0)
    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(consent).toHaveCount(0)
    expect(downloads).toHaveLength(0)
    await page.getByRole('button', { name: 'Export video', exact: true }).click()
    await expect(consent).toBeVisible()
    const pending = page.waitForEvent('download')
    await consent.click()
    const path = await (await pending).path()
    if (!path) throw new Error('Missing download')
    const output = await inspectMp4(await readFile(path))
    expect(output.audioCodec).toBeNull()
    expect(output.videoPackets).toBe(90)
  })

  test('a silent source exports without a consent prompt when AAC is unsupported', async ({ page, landingPage, browserName }) => {
    test.skip(browserName !== 'chromium')
    test.setTimeout(90000)
    await page.evaluate(() => { Object.defineProperty(window, 'AudioEncoder', { configurable: true, value: undefined }) })
    await uploadVideo(page, 'test-video-silent.mp4')
    await selectBaseFilm(page)
    const pending = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export video', exact: true }).click()
    const path = await (await pending).path()
    if (!path) throw new Error('Missing download')
    expect((await inspectMp4(await readFile(path))).audioCodec).toBeNull()
    await expect(page.getByRole('button', { name: 'Export without sound', exact: true })).toHaveCount(0)
  })

  test('supported AAC retains the source audio offset and end time', async ({ page, landingPage, browserName }, testInfo) => {
    test.skip(browserName !== 'chromium')
    test.setTimeout(90000)
    const config = { codec: 'mp4a.40.2', sampleRate: 48_000, numberOfChannels: 1, bitrate: 128_000 }
    const supported = await page.evaluate(async config => {
      if (typeof AudioEncoder === 'undefined') return false
      try { return (await AudioEncoder.isConfigSupported(config)).supported === true } catch { return false }
    }, config)
    await testInfo.attach('aac-capability', {
      body: JSON.stringify({
        browserVersion: page.context().browser()?.version(),
        userAgent: await page.evaluate(() => navigator.userAgent),
        config, supported,
      }, null, 2),
      contentType: 'application/json',
    })
    test.skip(!supported, 'This browser does not support the actual source AAC configuration')
    const source = await inspectMp4(await readFile(fixturePath('test-video-offset-audio.mp4')))
    expect(source.audioStart).toBeGreaterThan(.35)
    await uploadVideo(page, 'test-video-offset-audio.mp4')
    await selectBaseFilm(page)
    const pending = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export video', exact: true }).click()
    const path = testInfo.outputPath('offset-audio.mp4')
    await (await pending).saveAs(path)
    await testInfo.attach('offset-audio', { path, contentType: 'video/mp4' })
    const output = await inspectMp4(await readFile(path))
    await testInfo.attach('source-and-export-metadata', {
      body: JSON.stringify({ source, output }, null, 2), contentType: 'application/json',
    })
    expect(output.audioCodec).toBe('aac')
    expect(Math.abs(output.audioStart! - source.audioStart!)).toBeLessThan(.05)
    expect(Math.abs(output.audioEnd! - source.audioEnd!)).toBeLessThan(.05)
    expect(output.duration).toBeCloseTo(3, 1)
  })

  test('actual AAC initialization failure offers consent and explicit choice bypasses the failing encoder', async ({ page, landingPage, browserName }) => {
    test.skip(browserName !== 'chromium')
    test.setTimeout(90000)
    const decoderSupported = await page.evaluate(async () => typeof AudioDecoder !== 'undefined'
      && (await AudioDecoder.isConfigSupported({ codec: 'mp4a.40.2', sampleRate: 48000, numberOfChannels: 1 })).supported === true)
    test.skip(!decoderSupported, 'Actual AAC decoder is required to reach the encoder failure boundary')
    await page.evaluate(() => {
      const counters = window as unknown as { __audioConfigureFailures: number }
      counters.__audioConfigureFailures = 0
      Object.defineProperty(window, 'AudioEncoder', { configurable: true, value: class {
        state = 'unconfigured'
        static async isConfigSupported(config: AudioEncoderConfig) { return { supported: true, config } }
        configure() { counters.__audioConfigureFailures++; throw new Error('Injected AAC initialization failure') }
        close() { this.state = 'closed' }
      } })
    })
    await uploadVideo(page)
    const downloads: unknown[] = []
    page.on('download', download => downloads.push(download))
    await page.getByRole('button', { name: 'Export video', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Export without sound', exact: true })).toBeVisible()
    expect(downloads).toHaveLength(0)
    expect(await page.evaluate(() => (window as unknown as { __audioConfigureFailures: number }).__audioConfigureFailures)).toBe(1)
    const pending = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export without sound', exact: true }).click()
    const path = await (await pending).path()
    if (!path) throw new Error('Missing download')
    const output = await inspectMp4(await readFile(path))
    expect(output.audioCodec).toBeNull()
    expect(output.videoPackets).toBe(90)
    expect(output.duration).toBeCloseTo(3, 1)
    expect(await page.evaluate(() => (window as unknown as { __audioConfigureFailures: number }).__audioConfigureFailures)).toBe(1)
  })

})
