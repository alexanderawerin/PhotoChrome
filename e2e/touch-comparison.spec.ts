import type { CDPSession, Page } from '@playwright/test'
import { test, expect } from './helpers/fixtures'
import { uploadMultipleImages, waitForEditor, selectBaseFilm } from './helpers/upload'
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
    const total = mode === 'demo' ? 3 : 2

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
      await expect(page.locator('header:visible').getByText(`2 of ${total}`, { exact: true })).toBeVisible()
      await selectBaseFilm(page)
      secondProcessed = await previewPixels(page, 'photo')
      await page.keyboard.press('ArrowLeft')
      await expect(page.locator('header:visible').getByText(`1 of ${total}`, { exact: true })).toBeVisible()
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
      await expect(page.locator('header:visible').getByText(`1 of ${total}`, { exact: true })).toBeVisible()
      await touch(cdp, 'touchEnd')
      await expect.poll(() => previewPixels(page, 'photo')).toBe(processed)
      await expect(page.locator('header:visible').getByText(`1 of ${total}`, { exact: true })).toBeVisible()
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
        await expect(page.locator('header:visible').getByText(`1 of ${total}`, { exact: true })).toBeVisible()
      }
    })

    test('crossing the swipe threshold releases comparison and navigates exactly once on release', async ({ page }) => {
      const point = await previewPoint(page)
      await touch(cdp, 'touchStart', point)
      await expect.poll(() => previewPixels(page, 'photo')).toBe(original)
      await touch(cdp, 'touchMove', { x: point.moveX, y: point.y })
      await expect.poll(() => previewPixels(page, 'photo')).toBe(processed)
      await expect(page.locator('header:visible').getByText(`1 of ${total}`, { exact: true })).toBeVisible()
      await touch(cdp, 'touchEnd')
      await expect(page.locator('header:visible').getByText(`2 of ${total}`, { exact: true })).toBeVisible()
      await expect.poll(() => previewPixels(page, 'photo')).toBe(secondProcessed)
    })

    test('photo navigation during a hold invalidates the old gesture', async ({ page }) => {
      const point = await previewPoint(page)
      await touch(cdp, 'touchStart', point)
      await expect.poll(() => previewPixels(page, 'photo')).toBe(original)
      await page.keyboard.press('ArrowRight')
      await expect(page.locator('header:visible').getByText(`2 of ${total}`, { exact: true })).toBeVisible()
      await expect.poll(() => previewPixels(page, 'photo')).toBe(secondProcessed)
      await touch(cdp, 'touchMove', { x: point.moveX, y: point.y })
      await touch(cdp, 'touchEnd')
      await expect(page.locator('header:visible').getByText(`2 of ${total}`, { exact: true })).toBeVisible()
      await expect.poll(() => previewPixels(page, 'photo')).toBe(secondProcessed)
    })
  })
}
