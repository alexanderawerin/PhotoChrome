import { test, expect } from './helpers/fixtures'
import { uploadMultipleImages, waitForEditor } from './helpers/upload'
import { advancedPanel, advancedTrigger, appliedColor, changeHighlight, editorCanvas, openAdvanced, previewPixels, selectPortraitDraft, startAdvancedMedia, type AdvancedMedia } from './helpers/advanced'

for (const width of [393, 1600]) {
  for (const failure of [false, true]) {
    test(`photo Escape cancels a ${failure ? 'failed' : 'pending'} preview and restores focus at ${width}px`, async ({ page }) => {
      await startAdvancedMedia(page, 'photo', width)
      const base = await previewPixels(page, 'photo')
      await openAdvanced(page)
      const panel = advancedPanel(page)
      await panel.getByRole('tab', { name: 'Manual', exact: true }).click()
      await expect(panel.getByRole('button', { name: 'Apply', exact: true })).toBeEnabled()
      await page.evaluate(fail => {
        const original = Worker.prototype.postMessage
        const state = { seen: false, restore: () => { Worker.prototype.postMessage = original } }
        ;(window as unknown as { draftWorker: typeof state }).draftWorker = state
        Worker.prototype.postMessage = function (message: unknown, transfer: Transferable[] | StructuredSerializeOptions = []) {
          const request = message as { type?: string; requestId?: string }
          if (request.type === 'process') {
            state.seen = true
            if (fail) queueMicrotask(() => this.dispatchEvent(new MessageEvent('message', { data: {
              type: 'error', requestId: request.requestId, message: 'Preview worker failure',
            } })))
            return
          }
          return original.call(this, message, Array.isArray(transfer) ? { transfer } : transfer)
        }
      }, failure)
      try {
        const slider = panel.getByRole('slider', { name: 'Highlight', exact: true })
        await slider.focus()
        await slider.press('ArrowRight')
        await expect.poll(() => page.evaluate(() => (window as unknown as { draftWorker: { seen: boolean } }).draftWorker.seen)).toBe(true)
        if (failure) await expect(page.getByRole('alert')).toContainText('Preview worker failure')
        await expect(panel.getByRole('button', { name: 'Apply', exact: true })).toBeDisabled()
        // Restoring transport leaves the old request held/failed; Escape must
        // cancel its owner before the restored applied preview can complete.
        await page.evaluate(() => (window as unknown as { draftWorker: { restore: () => void } }).draftWorker.restore())
        await slider.press('Escape')
        await expect(panel).toHaveCount(0)
        await expect(appliedColor(page)).not.toContainText('Modified')
        await expect.poll(() => previewPixels(page, 'photo')).toBe(base)
        await expect(advancedTrigger(page)).toBeFocused()
      } finally {
        await page.evaluate(() => (window as unknown as { draftWorker: { restore: () => void } }).draftWorker.restore())
      }
    })
  }
  for (const media of ['photo', 'video'] as const satisfies readonly AdvancedMedia[]) {
    test.describe(`${media} Advanced at ${width}px`, () => {
      test('Recipes and Manual preview one draft and Apply commits both together', async ({ page }) => {
        await startAdvancedMedia(page, media, width)
        const base = await previewPixels(page, media)
        await openAdvanced(page)
        const panel = advancedPanel(page)
        await expect(panel.getByRole('button', { name: /^Apply preset/ })).toHaveCount(8)
        await expect(panel.getByRole('button', { name: /Velvia/ })).toHaveCount(0)
        await expect(panel.getByRole('button', { name: /Randomize/ })).toHaveCount(0)
        await selectPortraitDraft(page)
        await expect(appliedColor(page)).not.toContainText('Provia Portrait')
        const highlight = await changeHighlight(page)
        await expect.poll(() => previewPixels(page, media)).not.toBe(base)
        const draft = await previewPixels(page, media)
        await panel.getByRole('tab', { name: 'Recipes', exact: true }).click()
        await expect(panel.getByRole('slider')).toHaveCount(0)
        await expect(panel.getByRole('button', { name: 'Apply preset Provia Portrait, selected', exact: true })).toHaveAttribute('aria-pressed', 'true')
        await panel.getByRole('tab', { name: 'Manual', exact: true }).click()
        await expect(panel.getByRole('slider', { name: 'Highlight', exact: true })).toHaveAttribute('aria-valuenow', highlight!)
        await expect(panel.getByRole('button', { name: /^Apply preset/ })).toHaveCount(0)
        await panel.getByRole('button', { name: 'Apply', exact: true }).click()
        await expect(panel).toHaveCount(0)
        await expect(appliedColor(page)).toContainText('Provia Portrait')
        await expect(appliedColor(page)).toContainText('Modified')
        await expect.poll(() => previewPixels(page, media)).toBe(draft)
        await openAdvanced(page)
        await panel.getByRole('tab', { name: 'Manual', exact: true }).click()
        await expect(panel.getByRole('slider', { name: 'Highlight', exact: true })).toHaveAttribute('aria-valuenow', highlight!)
        await panel.getByRole('button', { name: 'Reset Highlight to profile', exact: true }).click()
        await expect(panel.getByRole('slider', { name: 'Highlight', exact: true })).toHaveAttribute('aria-valuenow', '-1')
        await panel.getByRole('button', { name: 'Apply', exact: true }).click()
        await expect(appliedColor(page)).not.toContainText('Modified')
        await expect(appliedColor(page)).toContainText('Provia Portrait')
      })

      test('Cancel and Escape restore pixels and focus without applying a recipe', async ({ page }) => {
        await startAdvancedMedia(page, media, width)
        const base = await previewPixels(page, media)
        for (const dismiss of ['Cancel', 'Escape'] as const) {
          await openAdvanced(page)
          await selectPortraitDraft(page)
          await changeHighlight(page)
          await expect.poll(() => previewPixels(page, media)).not.toBe(base)
          if (dismiss === 'Cancel') await advancedPanel(page).getByRole('button', { name: 'Cancel', exact: true }).click()
          else await page.keyboard.press('Escape')
          await expect(advancedPanel(page)).toHaveCount(0)
          await expect(appliedColor(page)).not.toContainText('Provia Portrait')
          await expect(appliedColor(page)).not.toContainText('Modified')
          await expect.poll(() => previewPixels(page, media)).toBe(base)
          await expect(advancedTrigger(page)).toBeFocused()
        }
      })

      test('choosing another draft recipe clears manual overrides and Restore base clears recipe', async ({ page }) => {
        await startAdvancedMedia(page, media, width)
        await openAdvanced(page)
        await selectPortraitDraft(page)
        await changeHighlight(page)
        const panel = advancedPanel(page)
        await panel.getByRole('tab', { name: 'Recipes', exact: true }).click()
        await panel.getByRole('button', { name: 'Apply preset Provia Daylight', exact: true }).click()
        await panel.getByRole('tab', { name: 'Manual', exact: true }).click()
        await expect(panel.getByRole('slider', { name: 'Highlight', exact: true })).toHaveAttribute('aria-valuenow', '0')
        await panel.getByRole('button', { name: 'Apply', exact: true }).click()
        await expect(appliedColor(page)).toContainText('Provia Daylight')
        await expect(appliedColor(page)).not.toContainText('Modified')
        await openAdvanced(page)
        await panel.getByRole('button', { name: 'Restore base film', exact: true }).click()
        await panel.getByRole('button', { name: 'Apply', exact: true }).click()
        await expect(appliedColor(page)).toContainText('Provia')
        await expect(appliedColor(page)).not.toContainText('Daylight')
        await expect(appliedColor(page)).not.toContainText('Modified')
      })
    })
  }

  test(`photo favorites survive Cancel and stay first within the film at ${width}px`, async ({ page }) => {
    await startAdvancedMedia(page, 'photo', width)
    await openAdvanced(page)
    const panel = advancedPanel(page)
    const card = panel.locator('[data-recipe-card]').filter({ has: page.getByRole('button', { name: 'Apply preset Provia Daylight', exact: true }) })
    await card.getByRole('button', { name: 'Add to favorites', exact: true }).click()
    await expect(card.getByRole('button', { name: 'Remove from favorites', exact: true })).toHaveAttribute('aria-pressed', 'true')
    await selectPortraitDraft(page)
    await panel.getByRole('button', { name: 'Cancel', exact: true }).click()
    await openAdvanced(page)
    await expect(card.getByRole('button', { name: 'Remove from favorites', exact: true })).toHaveAttribute('aria-pressed', 'true')
    const choices = await panel.getByRole('button', { name: /^Apply preset/ }).allTextContents()
    expect(choices).toHaveLength(8)
    const labels = await panel.getByRole('button', { name: /^Apply preset/ }).evaluateAll(buttons => buttons.map(button => button.getAttribute('aria-label')))
    expect(labels[0]).toBe('Apply preset Provia Daylight')
    expect(new Set(labels).size).toBe(8)
    await expect(appliedColor(page)).not.toContainText('Provia Portrait')
  })

  test(`Restore base and film changes preserve approved photo geometry at ${width}px`, async ({ page }) => {
    await startAdvancedMedia(page, 'photo', width)
    await page.keyboard.press('r')
    const canvas = editorCanvas(page, 'photo')
    await expect.poll(() => canvas.evaluate((element: HTMLCanvasElement) => [element.width, element.height])).toEqual([150, 200])
    await openAdvanced(page)
    await selectPortraitDraft(page)
    await changeHighlight(page)
    await advancedPanel(page).getByRole('button', { name: 'Restore base film', exact: true }).click()
    await advancedPanel(page).getByRole('button', { name: 'Apply', exact: true }).click()
    await expect(appliedColor(page)).not.toContainText('Modified')
    await expect.poll(() => canvas.evaluate((element: HTMLCanvasElement) => [element.width, element.height])).toEqual([150, 200])
    await page.getByRole('button', { name: 'Select film Velvia', exact: true }).click()
    await expect(appliedColor(page)).toContainText('Velvia')
    await expect(appliedColor(page)).not.toContainText('Portrait')
    await expect.poll(() => canvas.evaluate((element: HTMLCanvasElement) => [element.width, element.height])).toEqual([150, 200])
  })
}

test('changing photos discards an unfinished draft and preserves each applied profile', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await uploadMultipleImages(page)
  await waitForEditor(page)
  await page.getByRole('button', { name: 'Select film Provia', exact: true }).click()
  await openAdvanced(page)
  await selectPortraitDraft(page)
  await changeHighlight(page)
  const strip = page.getByRole('tablist', { name: 'Image thumbnails', exact: true })
  await strip.getByRole('tab', { name: 'Image 2 of 2: test-image-2.jpg', exact: true }).click()
  await expect(appliedColor(page)).toContainText('Original')
  await expect(advancedPanel(page)).toHaveCount(0)
  await strip.getByRole('tab', { name: 'Image 1 of 2: test-image.jpg', exact: true }).click()
  await expect(appliedColor(page)).toContainText('Provia')
  await expect(appliedColor(page)).not.toContainText('Portrait')
  await expect(appliedColor(page)).not.toContainText('Modified')
  await openAdvanced(page)
  await advancedPanel(page).getByRole('tab', { name: 'Manual', exact: true }).click()
  await expect(advancedPanel(page).getByRole('slider', { name: 'Highlight', exact: true })).toHaveAttribute('aria-valuenow', '0')
})

for (const media of ['photo', 'video'] as const) {
  test(`${media} changing the main film discards an unfinished recipe and manual draft`, async ({ page }) => {
    await startAdvancedMedia(page, media, 1600)
    await openAdvanced(page)
    await selectPortraitDraft(page)
    await changeHighlight(page)
    await page.getByRole('button', { name: 'Select film Velvia', exact: true }).click()
    await expect(advancedPanel(page)).toHaveCount(0)
    await expect(appliedColor(page)).toContainText('Velvia')
    await expect(appliedColor(page)).not.toContainText('Portrait')
    await expect(appliedColor(page)).not.toContainText('Modified')
    await openAdvanced(page)
    await expect(advancedPanel(page).getByRole('button', { name: /Apply preset Provia/ })).toHaveCount(0)
    await advancedPanel(page).getByRole('tab', { name: 'Manual', exact: true }).click()
    await expect(advancedPanel(page).getByRole('slider', { name: 'Highlight', exact: true })).toHaveAttribute('aria-valuenow', '0')
  })
}
