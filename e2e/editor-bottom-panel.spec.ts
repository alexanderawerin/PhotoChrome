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
      const original = await previewPixels(page, 'photo')
      await selectBaseFilm(page)
      // Profile state updates before its asynchronous canvas paint completes.
      await expect.poll(() => previewPixels(page, 'photo')).not.toBe(original)
      const baseline = await previewPixels(page, 'photo')
      const actions = editorActions(page)
      const nav = editorModes(page)
      const checkTargets = async () => {
        const buttons = await page.locator('.editor-dock-footer').getByRole('button').all()
        for (const button of buttons) {
          const box = await button.boundingBox()
          expect(box).not.toBeNull()
          expect(box!.width).toBeGreaterThanOrEqual(48)
          expect(box!.height).toBeGreaterThanOrEqual(48)
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
        await expect(page.getByLabel('Current edit', { exact: true })).toHaveText('Adjust')
        await page.getByRole('tab', { name: 'Manual', exact: true }).click()
        const slider = page.getByRole('slider', { name: 'Highlight', exact: true })
        await slider.focus()
        await slider.press('ArrowRight')
        await expect.poll(() => previewPixels(page, 'photo')).not.toBe(baseline)
        await checkTargets()
        await actions.getByRole('button', { name: exit, exact: true }).click()
        await expect(nav).toBeVisible()
        await expect(nav.getByRole('button', { name: 'Open Adjust settings', exact: true })).toBeFocused()
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


test('one compact tool row exposes batch commands with keyboard dismissal and status feedback', async ({ page, multiImageEditorPage }) => {
  await page.setViewportSize({ width: 320, height: 740 })
  await selectBaseFilm(page)
  const footer = page.locator('.editor-dock-footer')
  expect((await footer.boundingBox())!.height).toBeLessThanOrEqual(80)
  await expect(footer.getByRole('button', { name: 'Films', exact: true })).toHaveCount(0)
  const more = page.getByRole('button', { name: 'More editor actions', exact: true })
  const batch = page.getByRole('button', { name: 'Apply current color to all 2 images', exact: true })
  await expect(batch).toBeHidden()
  for (let i = 0; i < 2; i++) {
    await more.focus()
    await more.press('Enter')
    await page.keyboard.press('Tab')
    await expect(batch).toBeFocused()
    const bounds = await page.getByRole('group', { name: 'More editor actions', exact: true }).boundingBox()
    expect(bounds!.x).toBeGreaterThanOrEqual(12)
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(308)
    await page.keyboard.press('Escape')
    await expect(batch).toBeHidden()
    await expect(more).toBeFocused()
    await more.click()
    await batch.click()
    await expect(batch).toBeHidden()
    await expect(more).toBeFocused()
    await expect(page.getByRole('status').filter({ hasText: 'Color applied to 2 photos' })).toBeVisible()
  }
  await more.click()
  await page.getByRole('button', { name: 'Export all photos', exact: true }).focus()
  await page.keyboard.press('Tab')
  await expect(batch).toBeHidden()
  await expect(editorActions(page).getByRole('button', { name: 'Export processed image (Ctrl+S)', exact: true })).toBeFocused()
})

test('Escape closes the ratio popup before cancelling its crop draft', async ({ page, editorPage }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await editorModes(page).getByRole('button', { name: 'Crop', exact: true }).click()
  await page.getByRole('button', { name: 'Rotate clockwise', exact: true }).click()
  const rotated = await previewPixels(page, 'photo')
  const chooser = page.getByRole('button', { name: 'Choose crop ratio', exact: true })
  await chooser.click()
  await expect(page.getByRole('group', { name: 'Crop ratios', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('group', { name: 'Crop ratios', exact: true })).toHaveCount(0)
  await expect(page.getByRole('region', { name: 'Crop settings', exact: true })).toBeVisible()
  await expect(chooser).toBeFocused()
  await expect.poll(() => previewPixels(page, 'photo')).toBe(rotated)
  await page.keyboard.press('Escape')
  await expect(page.getByRole('region', { name: 'Crop settings', exact: true })).toHaveCount(0)
  await expect(editorModes(page).getByRole('button', { name: 'Crop', exact: true })).toBeFocused()
})
