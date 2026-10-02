import { clickEditorAction } from './helpers/editor-controls'
import { test, expect } from './helpers/fixtures'
import { fixturePath, selectBaseFilm, uploadVideo, waitForEditor } from './helpers/upload'
import { readFile } from 'node:fs/promises'
import { unzipSync } from 'fflate'

const BUDGETS_MS = {
  twoPhotoEditor: 5_000,
  filmPreview: 2_500,
  tenFilmChoices: 5_000,
  photoExport: 10_000,
  videoExport: 45_000,
  twentyPhotoBatch: 120_000,
} as const

async function mainPreviewSignature(page: import('@playwright/test').Page): Promise<number> {
  return page.locator('canvas[aria-label="Preview"]').evaluate((canvas: HTMLCanvasElement) => {
    const context = canvas.getContext('2d')
    if (!context || canvas.width === 0 || canvas.height === 0) return 0
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data
    const stride = Math.max(4, Math.floor(data.length / 256 / 4) * 4)
    let signature = 0
    for (let index = 0; index < data.length; index += stride) {
      signature = (signature + data[index] * 3 + data[index + 1] * 5 + data[index + 2] * 7) >>> 0
    }
    return signature
  })
}

test.describe('Chromium performance budgets', () => {
  test.describe.configure({ mode: 'serial' })
  test.beforeEach(({ browserName }) => {
    test.skip(browserName !== 'chromium', 'Performance budgets are defined for Chromium')
  })

  test('two-photo editor and ten film choices meet readiness budgets', async ({ page, landingPage }) => {
    const startedAt = performance.now()
    const input = page.locator('input[aria-label="Choose photos or video to edit"]')
    await input.waitFor({ state: 'attached', timeout: 15_000 })
    await input.setInputFiles([
      fixturePath('test-image.jpg'),
      fixturePath('test-image-2.jpg'),
    ])
    await waitForEditor(page)
    await expect(page.locator('[role="tablist"][aria-label="Image thumbnails"] [role="tab"]')).toHaveCount(2)
    const editorReadyMs = performance.now() - startedAt

    await expect(page.getByRole('group', { name: 'Film selection', exact: true }).getByRole('button', { name: /^Select film / })).toHaveCount(10, { timeout: BUDGETS_MS.tenFilmChoices })
    const tenFilmChoicesMs = performance.now() - startedAt

    expect(editorReadyMs).toBeLessThanOrEqual(BUDGETS_MS.twoPhotoEditor)
    expect(tenFilmChoicesMs).toBeLessThanOrEqual(BUDGETS_MS.tenFilmChoices)
  })

  test('film preview meets its budget', async ({ page, editorPage }) => {
    const before = await mainPreviewSignature(page)
    const card = page.getByRole('button', { name: 'Select film Provia', exact: true })
    const startedAt = performance.now()
    await card.click()
    await expect.poll(() => mainPreviewSignature(page), { timeout: BUDGETS_MS.filmPreview }).not.toBe(before)
    expect(performance.now() - startedAt).toBeLessThanOrEqual(BUDGETS_MS.filmPreview)
  })

  test('photo export meets its budget', async ({ page, editorPage }) => {
    await selectBaseFilm(page)
    const downloadPromise = page.waitForEvent('download')
    const startedAt = performance.now()
    await page.getByRole('button', { name: 'Export processed image (Ctrl+S)', exact: true }).click()
    await downloadPromise
    expect(performance.now() - startedAt).toBeLessThanOrEqual(BUDGETS_MS.photoExport)
  })

  test('three-second video export meets its budget', async ({ page, landingPage }) => {
    test.setTimeout(60_000)
    await uploadVideo(page)
    await selectBaseFilm(page)
    const supportsAudio = await page.evaluate(async () => typeof AudioEncoder !== 'undefined' && (await AudioEncoder.isConfigSupported({ codec: 'mp4a.40.2', sampleRate: 48000, numberOfChannels: 1, bitrate: 128000 })).supported === true)
    const downloadPromise = page.waitForEvent('download')
    const startedAt = performance.now()
    await page.getByRole('button', { name: 'Export video' }).click()
    if (!supportsAudio) await page.getByRole('button', { name: 'Export without sound', exact: true }).click()
    await downloadPromise
    expect(performance.now() - startedAt).toBeLessThanOrEqual(BUDGETS_MS.videoExport)
  })

  test('twenty-photo batch export meets its budget', async ({ page, landingPage }) => {
    test.setTimeout(140_000)
    const photos = Array.from(
      { length: 20 },
      (_, index) => fixturePath(index % 2 === 0 ? 'test-image.jpg' : 'test-image-2.jpg')
    )
    const input = page.locator('input[aria-label="Choose photos or video to edit"]')
    await input.waitFor({ state: 'attached', timeout: 15_000 })
    await input.setInputFiles(photos)
    await waitForEditor(page)
    await expect(page.locator('[role="tablist"][aria-label="Image thumbnails"] [role="tab"]')).toHaveCount(20)
    await selectBaseFilm(page)
    await clickEditorAction(page, 'Apply current color to all 20 images')
    await expect(page.getByRole('status', { name: 'Applying preset to all images', exact: true })).toBeHidden()

    const downloadPromise = page.waitForEvent('download')
    const startedAt = performance.now()
    await clickEditorAction(page, 'Export all photos')
    const download = await downloadPromise
    const elapsed = performance.now() - startedAt
    expect(elapsed).toBeLessThanOrEqual(BUDGETS_MS.twentyPhotoBatch)

    const path = await download.path()
    if (!path) throw new Error('Batch download path unavailable')
    const entries = unzipSync(new Uint8Array(await readFile(path)))
    expect(Object.keys(entries).filter(name => name.endsWith('.jpg'))).toHaveLength(20)
    expect(entries['export-report.txt']).toBeUndefined()
  })
})
