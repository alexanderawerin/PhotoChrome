import type { CDPSession, Page } from '@playwright/test'
import { test, expect } from './helpers/fixtures'
import { uploadMultipleImages, waitForEditor, selectBaseFilm } from './helpers/upload'
import { openCropSession } from './helpers/editor-controls'
import { editorCanvas, previewPixels } from './helpers/advanced'

test.use({ viewport: { width: 393, height: 852 }, hasTouch: true })

async function previewPoint(page: Page) {
  return editorCanvas(page, 'photo').evaluate(canvas => {
    const rect = canvas.getBoundingClientRect()
    const header = document.querySelector('header')!.getBoundingClientRect()
    const dock = document.querySelector('.mobile-editor-dock')!.getBoundingClientRect()
    const left = Math.max(0, rect.left)
    const right = Math.min(window.innerWidth, rect.right)
    const top = Math.max(header.bottom, rect.top)
    const bottom = Math.min(dock.top, rect.bottom)
    if (bottom <= top || right - left < 160) throw new Error('Preview lacks a visible touch workspace')
    return { x: left + (right - left) * 0.75, y: (top + bottom) / 2, moveX: left + (right - left) * 0.25 }
  })
}

async function touch(cdp: CDPSession, type: 'touchStart' | 'touchMove' | 'touchEnd' | 'touchCancel', point?: { x: number; y: number }) {
  await cdp.send('Input.dispatchTouchEvent', {
    type,
    touchPoints: point ? [{ x: point.x, y: point.y, id: 0, radiusX: 1, radiusY: 1, force: 1 }] : [],
  })
}

for (const mode of ['demo', 'batch'] as const) {
  test.describe(`real touch comparison in the ${mode} multi-photo editor`, () => {
    let cdp: CDPSession
    let original: string
    let processed: string
    let secondProcessed: string

    test.beforeEach(async ({ page, browserName }) => {
      test.skip(browserName !== 'chromium', 'Trusted touch input uses Chromium CDP; other browser/device verification remains separate.')
      await page.goto('/', { waitUntil: 'domcontentloaded' })
      if (mode === 'batch') await uploadMultipleImages(page)
      await waitForEditor(page)
      cdp = await page.context().newCDPSession(page)
      await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 })
      await page.getByRole('button', { name: 'Select Original', exact: true }).click()
      original = await previewPixels(page, 'photo')
      await selectBaseFilm(page)
      await expect.poll(() => previewPixels(page, 'photo')).not.toBe(original)
      processed = await previewPixels(page, 'photo')
      await page.keyboard.press('ArrowRight')
      await expect.poll(() => previewPixels(page, 'photo')).not.toBe(processed)
      await selectBaseFilm(page)
      secondProcessed = await previewPixels(page, 'photo')
      await page.keyboard.press('ArrowLeft')
      await expect.poll(() => previewPixels(page, 'photo')).toBe(processed)
    })

    test.afterEach(async () => {
      if (cdp) {
        await touch(cdp, 'touchCancel').catch(() => {})
        await cdp.detach()
      }
    })

    test('stationary hold shows Original and release restores color without navigating', async ({ page }) => {
      const point = await previewPoint(page)
      await touch(cdp, 'touchStart', point)
      await expect.poll(() => previewPixels(page, 'photo')).toBe(original)
      await touch(cdp, 'touchEnd')
      await expect.poll(() => previewPixels(page, 'photo')).toBe(processed)
    })

    test('touch cancellation and window blur release comparison without changing photos', async ({ page }) => {
      const point = await previewPoint(page)
      for (const release of ['cancel', 'cancel-after-move', 'blur'] as const) {
        await touch(cdp, 'touchStart', point)
        await expect.poll(() => previewPixels(page, 'photo')).toBe(original)
        if (release === 'cancel-after-move') {
          await touch(cdp, 'touchMove', { x: point.moveX, y: point.y })
          await expect.poll(() => previewPixels(page, 'photo')).toBe(processed)
          await touch(cdp, 'touchCancel')
        } else if (release === 'cancel') await touch(cdp, 'touchCancel')
        else {
          await page.evaluate(() => window.dispatchEvent(new Event('blur')))
          await touch(cdp, 'touchEnd')
        }
        await expect.poll(() => previewPixels(page, 'photo')).toBe(processed)
      }
    })

    test('crossing the swipe threshold releases comparison and navigates exactly once on release', async ({ page }) => {
      const point = await previewPoint(page)
      await touch(cdp, 'touchStart', point)
      await expect.poll(() => previewPixels(page, 'photo')).toBe(original)
      await touch(cdp, 'touchMove', { x: point.moveX, y: point.y })
      await expect.poll(() => previewPixels(page, 'photo')).toBe(processed)
      await touch(cdp, 'touchEnd')
      await expect.poll(() => previewPixels(page, 'photo')).toBe(secondProcessed)
    })

    test('wide touch layouts keep arrows hidden and navigate by swiping the preview', async ({ page }) => {
      await page.setViewportSize({ width: 1200, height: 900 })
      await expect(page.getByRole('button', { name: 'Previous image', exact: true })).toBeHidden()
      await expect(page.getByRole('button', { name: 'Next image', exact: true })).toBeHidden()
      const point = await previewPoint(page)
      await touch(cdp, 'touchStart', point)
      await touch(cdp, 'touchMove', { x: point.moveX, y: point.y })
      await touch(cdp, 'touchEnd')
      await expect.poll(() => previewPixels(page, 'photo')).toBe(secondProcessed)
    })

    test('a swipe starting on the Original button compares without changing photos', async ({ page }) => {
      const compare = page.getByRole('button', { name: 'Hold to compare original', exact: true })
      const box = await compare.boundingBox()
      if (!box) throw new Error('Original comparison button unavailable')
      const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
      await touch(cdp, 'touchStart', point)
      await expect.poll(() => previewPixels(page, 'photo')).toBe(original)
      await touch(cdp, 'touchMove', { x: Math.max(10, point.x - 160), y: point.y })
      await touch(cdp, 'touchEnd')
      await expect.poll(() => previewPixels(page, 'photo')).toBe(processed)
      await expect(page.getByRole('button', { name: 'Previous image', exact: true })).toBeHidden()
      await expect(page.getByRole('button', { name: 'Next image', exact: true })).toBeHidden()
    })

    test('a Crop drag does not navigate and cancel restores the same photo', async ({ page }) => {
      test.skip(mode === 'demo', 'The playable demo does not expose Crop')
      await openCropSession(page)
      const point = await previewPoint(page)
      await touch(cdp, 'touchStart', point)
      await touch(cdp, 'touchMove', { x: point.moveX, y: point.y })
      await touch(cdp, 'touchEnd')
      await expect(page.getByRole('region', { name: 'Crop settings', exact: true })).toBeVisible()
      await page.getByRole('button', { name: 'Cancel', exact: true }).click()
      await expect.poll(() => previewPixels(page, 'photo')).toBe(processed)
    })

    test('photo navigation during a hold invalidates the old gesture', async ({ page }) => {
      const point = await previewPoint(page)
      await touch(cdp, 'touchStart', point)
      await expect.poll(() => previewPixels(page, 'photo')).toBe(original)
      await page.keyboard.press('ArrowRight')
      await expect.poll(() => previewPixels(page, 'photo')).toBe(secondProcessed)
      await touch(cdp, 'touchMove', { x: point.moveX, y: point.y })
      await touch(cdp, 'touchEnd')
      await expect.poll(() => previewPixels(page, 'photo')).toBe(secondProcessed)
    })
  })
}
