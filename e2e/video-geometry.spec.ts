import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { promisify } from 'node:util'
import { ALL_FORMATS, BufferSource, EncodedPacketSink, Input } from 'mediabunny'
import { test, expect } from './helpers/fixtures'
import { fixturePath, uploadVideo } from './helpers/upload'
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
    return { width: await track.getDisplayWidth(), height: await track.getDisplayHeight(), duration: await input.computeDuration(), packets }
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

test.describe('Video geometry and source timing', () => {
  test('Original, film and comparison retain rotation/reflection/crop; downloaded frames match composition', async ({ page, landingPage, browserName }, testInfo) => {
    test.skip(browserName !== 'chromium')
    test.setTimeout(90000)
    const source = await inspect(fixturePath('test-video-asymmetric-24.mp4'))
    expect(source.packets).toHaveLength(51)
    expect(source.duration).toBeCloseTo(2.125, 3)
    await uploadVideo(page, 'test-video-asymmetric-24.mp4')
    await page.getByRole('button', { name: 'Rotate clockwise', exact: true }).click()
    await page.getByRole('button', { name: 'Flip horizontal', exact: true }).click()
    await expect(preview(page)).toHaveAttribute('width', '180')
    await expect(preview(page)).toHaveAttribute('height', '320')
    await page.getByRole('button', { name: 'Crop', exact: true }).click()
    const crop = page.getByRole('region', { name: 'Crop settings', exact: true })
    await crop.getByRole('button', { name: 'Choose crop ratio', exact: true }).click()
    await page.getByRole('group', { name: 'Crop ratios', exact: true }).getByRole('button', { name: '1:1', exact: true }).click()
    await crop.getByRole('button', { name: 'Apply', exact: true }).click()
    await expect(preview(page)).toHaveAttribute('width', '180')
    await expect(preview(page)).toHaveAttribute('height', '180')
    const playback = page.getByRole('toolbar', { name: 'Video playback', exact: true })
    const pause = playback.getByRole('button', { name: 'Pause', exact: true })
    if (await pause.count()) await pause.click()
    const originalCorners = await canvasCorners(page)
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
    await page.getByRole('button', { name: 'Crop', exact: true }).click()
    const crop = page.getByRole('region', { name: 'Crop settings', exact: true })
    await crop.getByRole('button', { name: 'Choose crop ratio', exact: true }).click()
    await page.getByRole('group', { name: 'Crop ratios', exact: true }).getByRole('button', { name: '9:16', exact: true }).click()
    await crop.getByRole('slider', { name: 'Crop angle', exact: true }).press('PageUp')
    await crop.getByRole('slider', { name: 'Crop zoom', exact: true }).press('PageUp')
    await crop.getByRole('button', { name: 'Cancel', exact: true }).click()
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
    await page.getByRole('button', { name: 'Crop', exact: true }).click()
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
    await crop.getByRole('button', { name: 'Apply', exact: true }).click()
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
