import { test, expect } from './helpers/fixtures'
import { selectBaseFilm } from './helpers/upload'
import { openAdvanced, previewPixels } from './helpers/advanced'
import { editorActions, editorModes } from './helpers/editor-controls'

for (const width of [320, 393]) {
  for (const safeBottom of [0, 34]) {
    test(`explicit draft actions remain reachable at ${width}px with ${safeBottom}px safe area`, async ({ page, editorPage, browserName }) => {
      test.skip(browserName !== 'chromium', 'Safe-area override requires Chromium CDP')
      await page.setViewportSize({ width, height: 852 })
      const cdp = await page.context().newCDPSession(page)
      await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { bottom: safeBottom, left: 12, right: 12 } })
      await selectBaseFilm(page)
      const baseline = await previewPixels(page, 'photo')
      const actions = editorActions(page)
      const nav = editorModes(page)
      const checkTargets = async () => {
        const buttons = await actions.getByRole('button').all()
        for (const button of buttons) {
          const box = await button.boundingBox()
          expect(box).not.toBeNull()
          expect(box!.width).toBeGreaterThanOrEqual(44)
          expect(box!.height).toBeGreaterThanOrEqual(44)
          expect(box!.x).toBeGreaterThanOrEqual(12)
          expect(box!.x + box!.width).toBeLessThanOrEqual(width - 12)
          expect(box!.y + box!.height).toBeLessThanOrEqual(852 - safeBottom)
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
      }
      await checkTargets()
      for (const exit of ['Cancel', 'Apply'] as const) {
        await openAdvanced(page)
        await expect(nav).toBeHidden()
        await expect(page.getByRole('tab', { name: 'Recipes', exact: true })).toBeFocused()
        await expect(page.getByLabel('Current edit', { exact: true })).toHaveText('Advanced')
        await page.getByRole('tab', { name: 'Manual', exact: true }).click()
        const slider = page.getByRole('slider', { name: 'Highlight', exact: true })
        await slider.focus()
        await slider.press('ArrowRight')
        await expect.poll(() => previewPixels(page, 'photo')).not.toBe(baseline)
        await checkTargets()
        await actions.getByRole('button', { name: exit, exact: true }).click()
        await expect(nav).toBeVisible()
        await expect(nav.getByRole('button', { name: 'Open Advanced settings', exact: true })).toBeFocused()
        if (exit === 'Cancel') await expect.poll(() => previewPixels(page, 'photo')).toBe(baseline)
      }
      const applied = await previewPixels(page, 'photo')
      await nav.getByRole('button', { name: 'Crop', exact: true }).click()
      await expect(nav).toBeHidden()
      await expect(page.getByLabel('Current edit', { exact: true })).toHaveText('Crop')
      await page.getByRole('button', { name: 'Rotate clockwise', exact: true }).click()
      await checkTargets()
      await actions.getByRole('button', { name: 'Cancel', exact: true }).click()
      await expect.poll(() => previewPixels(page, 'photo')).toBe(applied)
      const downloadPromise = page.waitForEvent('download')
      await actions.getByRole('button', { name: 'Export processed image (Ctrl+S)', exact: true }).click()
      const download = await downloadPromise
      expect(await download.failure()).toBeNull()
      await expect(page.getByRole('dialog', { name: 'Export complete', exact: true })).toBeVisible()
      await page.getByRole('button', { name: 'Back to editor', exact: true }).click()
      await expect(nav).toBeVisible()
      await checkTargets()
    })
  }
}
