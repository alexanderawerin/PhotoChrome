import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import { ALL_FORMATS, BufferSource, EncodedPacketSink, Input } from 'mediabunny'
import { test, expect } from './helpers/fixtures'
import { fixturePath, uploadVideo } from './helpers/upload'
import { openCropSession, editorModes, editorActions } from './helpers/editor-controls'
import type { Page } from '@playwright/test'

const run = promisify(execFile)
const preview = (page: Page) => page.locator('canvas[aria-label="Video preview"]')
async function inspect(path: string) {
  const input = new Input({ source: new BufferSource(await readFile(path)), formats: ALL_FORMATS })
  try {
    const track = await input.getPrimaryVideoTrack()
    if (!track) throw new Error('No video track')
    const packets: { timestamp: number; duration: number }[] = []
    for await (const packet of new EncodedPacketSink(track).packets()) packets.push({ timestamp: packet.timestamp, duration: packet.duration })
    packets.sort((a, b) => a.timestamp - b.timestamp)
    const audio = await input.getPrimaryAudioTrack()
    let audioStart: number | null = null
    let audioEnd: number | null = null
    if (audio) for await (const packet of new EncodedPacketSink(audio).packets()) {
      audioStart = Math.min(audioStart ?? packet.timestamp, packet.timestamp)
      audioEnd = Math.max(audioEnd ?? 0, packet.timestamp + packet.duration)
    }
    return {
      width: await track.getDisplayWidth(), height: await track.getDisplayHeight(), duration: await input.computeDuration(), packets,
      audio: audio ? { codec: await audio.getCodec(), sampleRate: await audio.getSampleRate(), start: audioStart, end: audioEnd } : null,
    }
  } finally { input.dispose() }
}
async function exportMp4(page: Page, artifactPath?: string) {
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export video', exact: true }).click()
  const download = await pending
  if (artifactPath) { await download.saveAs(artifactPath); return artifactPath }
  const path = await download.path()
  if (!path) throw new Error('Missing downloaded MP4')
  return path
}
async function decodedFrame(path: string, frameIndex = 0) {
  const info = await inspect(path)
  const { stdout } = await run(process.env.FFMPEG_PATH || 'ffmpeg', ['-v', 'error', '-i', path, '-vf', `select=eq(n\\,${frameIndex})`, '-frames:v', '1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'], { encoding: 'buffer', maxBuffer: 16 * 1024 * 1024 })
  return { info, pixels: stdout }
}
function assertTiming(source: Awaited<ReturnType<typeof inspect>>, output: Awaited<ReturnType<typeof inspect>>) {
  expect(output.packets).toHaveLength(source.packets.length)
  expect(Math.abs(output.duration - source.duration)).toBeLessThan(.001)
  for (let index = 0; index < source.packets.length; index++) {
    expect(Math.abs(output.packets[index].timestamp - source.packets[index].timestamp)).toBeLessThan(.0001)
    expect(Math.abs(output.packets[index].duration - source.packets[index].duration)).toBeLessThan(.0001)
  }
}
async function canvasCorners(page: Page) {
  return preview(page).evaluate(canvas => {
    const image = (canvas as HTMLCanvasElement).getContext('2d')!.getImageData(0, 0, (canvas as HTMLCanvasElement).width, (canvas as HTMLCanvasElement).height)
    return [[.2, .2], [.8, .2], [.2, .8], [.8, .8]].map(([x, y]) => {
      const index = (Math.floor(image.height * y) * image.width + Math.floor(image.width * x)) * 4
      return [...image.data.slice(index, index + 3)]
    })
  })
}

/** Decode independently with FFmpeg; locate strong sound and full white frames on their actual PTS. */
async function avMarkers(path: string) {
  const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg'
  const ffprobe = process.env.FFPROBE_PATH || 'ffprobe'
  const results = await Promise.all([
    run(ffprobe, ['-v', 'error', '-show_frames', '-show_entries', 'frame=media_type,best_effort_timestamp_time,nb_samples', '-of', 'json', path]),
    run(ffmpeg, ['-v', 'error', '-i', path, '-map', '0:v:0', '-vf', 'scale=16:16', '-fps_mode', 'passthrough', '-pix_fmt', 'gray', '-f', 'rawvideo', 'pipe:1'], { encoding: 'buffer', maxBuffer: 16 * 1024 * 1024 }),
    run(ffmpeg, ['-v', 'error', '-i', path, '-map', '0:a:0', '-ac', '1', '-ar', '48000', '-f', 'f32le', 'pipe:1'], { encoding: 'buffer', maxBuffer: 16 * 1024 * 1024 }),
  ])
  const frames = (JSON.parse(results[0].stdout) as { frames: { media_type: string; best_effort_timestamp_time: string; nb_samples?: number }[] }).frames
  const video = frames.filter(frame => frame.media_type === 'video').map(frame => Number(frame.best_effort_timestamp_time))
  const audio = frames.filter(frame => frame.media_type === 'audio')
  if (!audio.length) throw new Error('Missing decoded audio frames')
  const audioStart = Number(audio[0].best_effort_timestamp_time)
  const pcm = results[2].stdout
  const sampleCount = pcm.length / 4
  expect(sampleCount).toBe(audio.reduce((total, frame) => total + (frame.nb_samples ?? 0), 0))
  // Concatenated PCM is meaningful only when the decoded audio timeline is contiguous.
  let elapsedSamples = 0
  for (const frame of audio) {
    expect(Math.abs(Number(frame.best_effort_timestamp_time) - (audioStart + elapsedSamples / 48000))).toBeLessThan(2 / 48000)
    elapsedSamples += frame.nb_samples ?? 0
  }
  expect(results[1].stdout.length).toBe(video.length * 256)
  const flashes: { start: number; end: number }[] = []
  let flashStart: number | null = null
  for (let index = 0; index <= video.length; index++) {
    const pixels = results[1].stdout.subarray(index * 256, (index + 1) * 256)
    const white = index < video.length && pixels.reduce((sum, pixel) => sum + pixel, 0) / 256 > 240
    if (white && flashStart === null) flashStart = video[index]
    if (!white && flashStart !== null) {
      flashes.push({ start: flashStart, end: video[index] ?? video.at(-1)! + 1 / 24 })
      flashStart = null
    }
  }
  const pulses: { start: number; end: number; frequency: number; rms: number }[] = []
  const binSize = 240 // 5 ms; less than one video frame or AAC packet.
  let pulseStart: number | null = null
  for (let start = 0; start <= sampleCount; start += binSize) {
    const end = Math.min(start + binSize, sampleCount)
    let power = 0
    for (let index = start; index < end; index++) power += pcm.readFloatLE(index * 4) ** 2
    const strong = end > start && Math.sqrt(power / (end - start)) > .15
    if (strong && pulseStart === null) pulseStart = start
    if (!strong && pulseStart !== null) {
      const innerStart = pulseStart + 960
      const innerEnd = start - 960
      expect(innerEnd).toBeGreaterThan(innerStart)
      let crossings = 0
      let signalPower = 0
      for (let index = innerStart + 1; index < innerEnd; index++) {
        const value = pcm.readFloatLE(index * 4)
        if (pcm.readFloatLE((index - 1) * 4) <= 0 && value > 0) crossings++
        signalPower += value ** 2
      }
      pulses.push({ start: audioStart + pulseStart / 48000, end: audioStart + start / 48000,
        frequency: crossings / ((innerEnd - innerStart) / 48000), rms: Math.sqrt(signalPower / (innerEnd - innerStart)) })
      pulseStart = null
    }
  }
  return { flashes, pulses, decodedAudioStart: audioStart, decodedAudioEnd: audioStart + sampleCount / 48000 }
}

function assertMarkers(markers: Awaited<ReturnType<typeof avMarkers>>) {
  expect(markers.flashes).toHaveLength(2)
  expect(markers.pulses).toHaveLength(2)
  for (const [index, start] of [.5, 44 / 24].entries()) {
    expect(Math.abs(markers.flashes[index].start - start)).toBeLessThan(.001)
    expect(Math.abs(markers.flashes[index].end - (start + 3 / 24))).toBeLessThan(.001)
    expect(Math.abs(markers.pulses[index].start - start)).toBeLessThan(.03)
    expect(Math.abs(markers.pulses[index].end - (start + 3 / 24))).toBeLessThan(.03)
    expect(Math.abs(markers.pulses[index].frequency - [880, 1320][index])).toBeLessThan(25)
    expect(markers.pulses[index].rms).toBeGreaterThan(.1)
  }
}

async function sourceAudioDecoderConfig(path: string) {
  const input = new Input({ source: new BufferSource(await readFile(path)), formats: ALL_FORMATS })
  try {
    const track = await input.getPrimaryAudioTrack()
    const config = await track?.getDecoderConfig()
    if (!config) throw new Error('Missing source audio decoder configuration')
    const description = config.description
    return { ...config, description: description ? Array.from(ArrayBuffer.isView(description)
      ? new Uint8Array(description.buffer, description.byteOffset, description.byteLength)
      : new Uint8Array(description)) : undefined }
  } finally { input.dispose() }
}

test.describe('Video geometry and source timing', () => {
  test('AV fixture contains two synchronized flashes and distinct delayed AAC pulses', async ({ browserName }, testInfo) => {
    test.skip(browserName !== 'chromium', 'The platform-independent fixture oracle runs once in the Chromium project')
    const path = fixturePath('test-video-asymmetric-audio.mp4')
    const metadata = await inspect(path)
    const markers = await avMarkers(path)
    await testInfo.attach('source-av-oracle', { body: JSON.stringify({ metadata, markers }, null, 2), contentType: 'application/json' })
    expect(metadata).toMatchObject({ width: 320, height: 180, audio: { codec: 'aac', sampleRate: 48000 } })
    expect(metadata.packets).toHaveLength(51)
    expect(metadata.duration).toBeCloseTo(2.125, 3)
    expect(metadata.audio!.start).toBeGreaterThan(.35)
    assertMarkers(markers)
  })

  test('supported AAC stays synchronized after rotation, reflection and square crop', async ({ page, landingPage, browserName }, testInfo) => {
    test.skip(browserName !== 'chromium', 'Real WebCodecs composition is verified in Chromium; Safari requires a device check')
    test.setTimeout(90000)
    const sourcePath = fixturePath('test-video-asymmetric-audio.mp4')
    const encoderConfig = { codec: 'mp4a.40.2', sampleRate: 48000, numberOfChannels: 1, bitrate: 128000 }
    const decoderConfig = await sourceAudioDecoderConfig(sourcePath)
    const probe = await page.evaluate(async ({ encoderConfig, decoderConfig }) => {
      try {
        return {
          encode: typeof AudioEncoder !== 'undefined' && typeof AudioData !== 'undefined'
            && (await AudioEncoder.isConfigSupported(encoderConfig)).supported === true,
          decode: typeof AudioDecoder !== 'undefined' && (await AudioDecoder.isConfigSupported({
            ...decoderConfig, description: decoderConfig.description ? new Uint8Array(decoderConfig.description) : undefined,
          })).supported === true,
          userAgent: navigator.userAgent,
        }
      } catch (error) { return { encode: false, decode: false, userAgent: navigator.userAgent, error: String(error) } }
    }, { encoderConfig, decoderConfig })
    await testInfo.attach('actual-source-aac-capability', {
      body: JSON.stringify({ browserVersion: page.context().browser()?.version(), encoderConfig, decoderConfig, ...probe }, null, 2),
      contentType: 'application/json',
    })
    test.skip(!probe.encode || !probe.decode, 'Actual source AAC encoder/decoder configuration is unsupported; no positive sound evidence')
    const source = await inspect(sourcePath)
    const sourceMarkers = await avMarkers(sourcePath)
    await uploadVideo(page, 'test-video-asymmetric-audio.mp4')
    await page.getByRole('button', { name: 'Rotate clockwise', exact: true }).click()
    await page.getByRole('button', { name: 'Flip horizontal', exact: true }).click()
    await page.getByRole('button', { name: 'Crop', exact: true }).click()
    const crop = page.getByRole('region', { name: 'Crop settings', exact: true })
    await crop.getByRole('button', { name: 'Choose crop ratio', exact: true }).click()
    await page.getByRole('group', { name: 'Crop ratios', exact: true }).getByRole('button', { name: '1:1', exact: true }).click()
    await crop.getByRole('button', { name: 'Apply', exact: true }).click()
    await expect(preview(page)).toHaveAttribute('width', '180')
    await expect(preview(page)).toHaveAttribute('height', '180')
    await page.getByRole('button', { name: 'Select Original', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Export video', exact: true })).toBeEnabled()
    const path = await exportMp4(page, testInfo.outputPath('composed-audio.mp4'))
    await testInfo.attach('composed-audio', { path, contentType: 'video/mp4' })
    const output = await decodedFrame(path)
    const outputMarkers = await avMarkers(path)
    await testInfo.attach('source-and-export-av', { body: JSON.stringify({ source, output: output.info, sourceMarkers, outputMarkers }, null, 2), contentType: 'application/json' })
    expect(output.info).toMatchObject({ width: 180, height: 180, audio: { codec: 'aac', sampleRate: 48000 } })
    assertTiming(source, output.info)
    expect(Math.abs(output.info.audio!.start! - source.audio!.start!)).toBeLessThan(.05)
    expect(Math.abs(output.info.audio!.end! - source.audio!.end!)).toBeLessThan(.05)
    assertMarkers(outputMarkers)
    const sourceFrame = await decodedFrame(sourcePath)
    for (const [index, [x, y]] of [[.2, .2], [.8, .2], [.2, .8], [.8, .8]].entries()) {
      const [sourceX, sourceY] = [[106, 36], [106, 144], [214, 36], [214, 144]][index]
      const expected = (sourceY * sourceFrame.info.width + sourceX) * 3
      const actual = (Math.floor(180 * y) * 180 + Math.floor(180 * x)) * 3
      for (let channel = 0; channel < 3; channel++) expect(Math.abs(output.pixels[actual + channel] - sourceFrame.pixels[expected + channel])).toBeLessThan(20)
    }
    // Full-frame stretching preserves quadrant colors but exposes the white source marker here.
    // Centered crop maps output (30,20) to source (90,30), which must remain red.
    for (let channel = 0; channel < 3; channel++) {
      expect(Math.abs(output.pixels[(20 * 180 + 30) * 3 + channel]
        - sourceFrame.pixels[(30 * 320 + 90) * 3 + channel])).toBeLessThan(20)
    }
    const offsets = outputMarkers.pulses.map((pulse, index) => pulse.start - outputMarkers.flashes[index].start)
    const sourceOffsets = sourceMarkers.pulses.map((pulse, index) => pulse.start - sourceMarkers.flashes[index].start)
    for (let index = 0; index < 2; index++) expect(Math.abs(offsets[index] - sourceOffsets[index])).toBeLessThan(.025)
    expect(Math.abs((offsets[1] - offsets[0]) - (sourceOffsets[1] - sourceOffsets[0]))).toBeLessThan(.015)
  })

  test('Original, film and comparison retain rotation/reflection/crop; downloaded frames match composition', async ({ page, landingPage, browserName }, testInfo) => {
    test.skip(browserName !== 'chromium')
    test.setTimeout(90000)
    const source = await inspect(fixturePath('test-video-asymmetric-24.mp4'))
    expect(source.packets).toHaveLength(51)
    expect(source.duration).toBeCloseTo(2.125, 3)
    await uploadVideo(page, 'test-video-asymmetric-24.mp4')
    await editorModes(page).getByRole('button', { name: 'Crop', exact: true }).click()
    await page.getByRole('button', { name: 'Rotate clockwise', exact: true }).click()
    await page.getByRole('button', { name: 'Flip horizontal', exact: true }).click()
    await expect(preview(page)).toHaveAttribute('width', '180')
    await expect(preview(page)).toHaveAttribute('height', '320')
    await openCropSession(page)
    const crop = page.getByRole('region', { name: 'Crop settings', exact: true })
    await crop.getByRole('button', { name: 'Choose crop ratio', exact: true }).click()
    await page.getByRole('group', { name: 'Crop ratios', exact: true }).getByRole('button', { name: '1:1', exact: true }).click()
    await editorActions(page).getByRole('button', { name: 'Done', exact: true }).click()
    await expect(preview(page)).toHaveAttribute('width', '180')
    await expect(preview(page)).toHaveAttribute('height', '180')
    const playback = page.getByRole('toolbar', { name: 'Video playback', exact: true })
    const pause = playback.getByRole('button', { name: 'Pause', exact: true })
    if (await pause.count()) await pause.click()
    const originalCorners = await canvasCorners(page)
    await editorModes(page).getByRole('button', { name: 'Films', exact: true }).click()
    await page.getByRole('button', { name: 'Select film Provia', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Export video', exact: true })).toBeEnabled()
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur())
    await page.keyboard.down('Space')
    await expect(preview(page)).toHaveAttribute('width', '180')
    await expect.poll(() => canvasCorners(page)).toEqual(originalCorners)
    await page.keyboard.up('Space')
    await page.getByRole('button', { name: 'Select Original', exact: true }).click()
    const path = await exportMp4(page, testInfo.outputPath('composed.mp4'))
    const output = await decodedFrame(path)
    expect(output.info).toMatchObject({ width: 180, height: 180 })
    assertTiming(source, output.info)
    console.log(JSON.stringify({ previewCorners: originalCorners, outputCorners: [[.2, .2], [.8, .2], [.2, .8], [.8, .8]].map(([x,y]) => { const offset = (Math.floor(output.info.height*y)*output.info.width+Math.floor(output.info.width*x))*3; return [...output.pixels.slice(offset,offset+3)] }) }))
    const decodedSource = await decodedFrame(fixturePath('test-video-asymmetric-24.mp4'))
    // Clockwise rotation then reflection transposes axes; the centered crop removes 70 rows.
    const expected = [[106, 36], [106, 144], [214, 36], [214, 144]].map(([x, y]) => {
      const offset = (y * decodedSource.info.width + x) * 3
      return [...decodedSource.pixels.slice(offset, offset + 3)]
    })
    console.log(JSON.stringify({ decodedSourceCorners: expected }))
    // A crop must remove the source marker; resizing the full frame would keep it here.
    for (let channel = 0; channel < 3; channel++) expect(Math.abs(output.pixels[(20 * 180 + 30) * 3 + channel]
      - decodedSource.pixels[(30 * 320 + 90) * 3 + channel])).toBeLessThan(20)
    for (const [index, [x, y]] of [[.2, .2], [.8, .2], [.2, .8], [.8, .8]].entries()) {
      const offset = (Math.floor(output.info.height * y) * output.info.width + Math.floor(output.info.width * x)) * 3
      for (let channel = 0; channel < 3; channel++) expect(Math.abs(output.pixels[offset + channel] - expected[index][channel])).toBeLessThan(20)
    }
  })

  test('mobile crop is reversible and VFR source keeps every packet duration', async ({ page, landingPage, browserName }, testInfo) => {
    test.skip(browserName !== 'chromium')
    test.setTimeout(90000)
    await page.setViewportSize({ width: 393, height: 852 })
    const source = await inspect(fixturePath('test-video-asymmetric-vfr.mp4'))
    expect(new Set(source.packets.map(packet => packet.duration.toFixed(4))).size).toBeGreaterThan(1)
    await uploadVideo(page, 'test-video-asymmetric-vfr.mp4')
    await openCropSession(page)
    const crop = page.getByRole('region', { name: 'Crop settings', exact: true })
    await crop.getByRole('button', { name: 'Choose crop ratio', exact: true }).click()
    await page.getByRole('group', { name: 'Crop ratios', exact: true }).getByRole('button', { name: '9:16', exact: true }).click()
    await crop.getByRole('slider', { name: 'Crop angle', exact: true }).press('PageUp')
    await crop.getByRole('slider', { name: 'Crop zoom', exact: true }).press('PageUp')
    await editorActions(page).getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(preview(page)).toHaveAttribute('width', '320')
    await expect(preview(page)).toHaveAttribute('height', '180')
    const path = await exportMp4(page, testInfo.outputPath('composed.mp4'))
    assertTiming(source, await inspect(path))
    const output = await decodedFrame(path)
    expect(output.info).toMatchObject({ width: 320, height: 180 })
    expect(output.pixels[3 * (40 * 320 + 80)]).toBeGreaterThan(230)
    const last = await decodedFrame(path, source.packets.length - 1)
    expect(output.pixels[3 * (30 * 320 + 36) + 1]).toBeGreaterThan(230)
    expect(last.pixels[3 * (30 * 320 + 36) + 1]).toBeLessThan(25)
    expect(last.pixels[3 * (30 * 320 + 96) + 1]).toBeGreaterThan(230)
  })

  test('source rotation metadata is baked into composed MP4 dimensions', async ({ page, landingPage, browserName }, testInfo) => {
    test.skip(browserName !== 'chromium')
    test.setTimeout(90000)
    const source = await inspect(fixturePath('test-video-rotated-24.mp4'))
    await uploadVideo(page, 'test-video-rotated-24.mp4')
    await expect(preview(page)).toHaveAttribute('width', '180')
    await expect(preview(page)).toHaveAttribute('height', '320')
    const path = await exportMp4(page, testInfo.outputPath('composed.mp4'))
    const output = await inspect(path)
    expect(output).toMatchObject({ width: 180, height: 320 })
    assertTiming(source, output)
  })
  test('free crop pads odd dimensions and keeps preview/output pixel geometry', async ({ page, landingPage, browserName }, testInfo) => {
    test.skip(browserName !== 'chromium')
    test.setTimeout(90000)
    await uploadVideo(page, 'test-video-asymmetric-24.mp4')
    await openCropSession(page)
    const crop = page.getByRole('region', { name: 'Crop settings', exact: true })
    await crop.getByRole('button', { name: 'Choose crop ratio', exact: true }).click()
    await page.getByRole('group', { name: 'Crop ratios', exact: true }).getByRole('button', { name: 'Free', exact: true }).click()
    const box = await preview(page).boundingBox()
    if (!box) throw new Error('Missing crop preview')
    const x = box.x + box.width - 3
    const y = box.y + box.height - 3
    await page.mouse.move(x, y)
    await page.mouse.down()
    await page.mouse.move(x - box.width * 159 / 320, y - box.height * 89 / 180, { steps: 5 })
    await page.mouse.up()
    await editorActions(page).getByRole('button', { name: 'Done', exact: true }).click()
    await expect(preview(page)).toHaveAttribute('width', '162')
    await expect(preview(page)).toHaveAttribute('height', '92')
    const edge = await preview(page).evaluate(canvas => [...(canvas as HTMLCanvasElement).getContext('2d')!.getImageData(161, 40, 1, 1).data])
    expect(edge).toEqual([0, 0, 0, 255])
    const output = await decodedFrame(await exportMp4(page, testInfo.outputPath('composed.mp4')))
    expect(output.info).toMatchObject({ width: 162, height: 92 })
    // White moving marker retains source location; padding does not scale content.
    expect(output.pixels[3 * (30 * 162 + 36) + 1]).toBeGreaterThan(230)
    expect(output.pixels[3 * (80 * 162 + 100)]).toBeGreaterThan(230)
  })

})
