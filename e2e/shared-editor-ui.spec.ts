import { test, expect } from './helpers/fixtures'
import { advancedPanel, advancedTrigger, appliedColor, changeHighlight, openAdvanced, previewPixels, selectPortraitDraft, startAdvancedMedia, type AdvancedMedia } from './helpers/advanced'

async function expectOneControlHost(page: import('@playwright/test').Page) {
  await expect(page.getByRole('complementary', { name: 'Editor controls', exact: true, includeHidden: true })).toHaveCount(1)
  await expect(page.getByRole('navigation', { name: 'Editor modes', exact: true, includeHidden: true })).toHaveCount(1)
  // Advanced owns its Apply/Cancel footer; the common action toolbar is absent.
  await expect(page.getByRole('toolbar', { name: 'Editor actions', exact: true, includeHidden: true })).toHaveCount(0)
  await expect(advancedPanel(page)).toHaveCount(1)
}

for (const media of ['photo', 'video'] as const satisfies readonly AdvancedMedia[]) {
  test(`${media} keeps the same Manual draft, tab and focused slider through 393→1200→393 resize`, async ({ page }) => {
    await startAdvancedMedia(page, media, 393)
    const appliedPixels = await previewPixels(page, media)
    await openAdvanced(page)
    await selectPortraitDraft(page)
    const highlight = await changeHighlight(page)
    const panel = advancedPanel(page)
    const manual = panel.getByRole('tab', { name: 'Manual', exact: true })
    const slider = panel.getByRole('slider', { name: 'Highlight', exact: true })
    const sliderNode = await slider.elementHandle()
    const panelNode = await panel.elementHandle()
    if (!sliderNode || !panelNode) throw new Error('Active Advanced controls unavailable')
    await expect.poll(() => previewPixels(page, media)).not.toBe(appliedPixels)
    const draftPixels = await previewPixels(page, media)
    await slider.focus()

    for (const viewport of [{ width: 1200, height: 900 }, { width: 393, height: 852 }]) {
      await page.setViewportSize(viewport)
      await expectOneControlHost(page)
      expect(await panel.evaluate((element, previous) => element === previous, panelNode)).toBe(true)
      expect(await slider.evaluate((element, previous) => element === previous, sliderNode)).toBe(true)
      await expect(slider).toBeFocused()
      await expect(slider).toHaveAttribute('aria-valuenow', highlight!)
      await expect(manual).toHaveAttribute('aria-selected', 'true')
      await expect(panel.getByRole('button', { name: /^Apply preset/ })).toHaveCount(0)
      await expect(panel.getByText('Provia · Provia Portrait', { exact: true })).toBeVisible()
      await expect.poll(() => previewPixels(page, media)).toBe(draftPixels)
      await expect(appliedColor(page)).not.toContainText('Provia Portrait')
      await expect(appliedColor(page)).not.toContainText('Modified')
    }

    await panel.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(panel).toHaveCount(0)
    await expect.poll(() => previewPixels(page, media)).toBe(appliedPixels)
    await expect(advancedTrigger(page)).toBeFocused()
    await openAdvanced(page)
    await panel.getByRole('tab', { name: 'Manual', exact: true }).click()
    await expect(slider).toHaveAttribute('aria-valuenow', '0')
    await expect(panel.getByRole('tabpanel', { name: 'Manual', exact: true }).getByText('Provia', { exact: true })).toBeVisible()
  })

  test(`${media} preserves Recipes content and favorites through 1200→393→1200 resize without applying its draft`, async ({ page }) => {
    await startAdvancedMedia(page, media, 1200)
    const appliedPixels = await previewPixels(page, media)
    await openAdvanced(page)
    const panel = advancedPanel(page)
    const recipes = panel.getByRole('tab', { name: 'Recipes', exact: true })
    const card = panel.locator('[data-recipe-card]').filter({ has: page.getByRole('button', { name: /^Apply preset Provia Portrait(?:, selected)?$/ }) })
    await card.getByRole('button', { name: 'Add to favorites', exact: true }).click()
    await card.getByRole('button', { name: 'Apply preset Provia Portrait', exact: true }).click()
    const favorite = card.getByRole('button', { name: 'Remove from favorites', exact: true })
    const cardNode = await card.elementHandle()
    if (!cardNode) throw new Error('Recipe card unavailable')
    await favorite.focus()
    await expect.poll(() => previewPixels(page, media)).not.toBe(appliedPixels)
    const draftPixels = await previewPixels(page, media)

    for (const viewport of [{ width: 393, height: 852 }, { width: 1200, height: 900 }]) {
      await page.setViewportSize(viewport)
      await expectOneControlHost(page)
      expect(await card.evaluate((element, previous) => element === previous, cardNode)).toBe(true)
      await expect(favorite).toBeFocused()
      await expect(favorite).toHaveAttribute('aria-pressed', 'true')
      await expect(recipes).toHaveAttribute('aria-selected', 'true')
      await expect(panel.getByRole('button', { name: 'Apply preset Provia Portrait, selected', exact: true })).toHaveAttribute('aria-pressed', 'true')
      await expect(panel.getByRole('button', { name: /^Apply preset/ })).toHaveCount(8)
      await expect(panel.getByRole('slider')).toHaveCount(0)
      await expect.poll(() => previewPixels(page, media)).toBe(draftPixels)
    }

    await panel.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect.poll(() => previewPixels(page, media)).toBe(appliedPixels)
    await expect(appliedColor(page)).not.toContainText('Provia Portrait')
    await expect(advancedTrigger(page)).toBeFocused()
    await openAdvanced(page)
    await expect(favorite).toHaveAttribute('aria-pressed', 'true')
    await expect(panel.getByRole('button', { name: 'Apply preset Provia Portrait', exact: true })).toHaveAttribute('aria-pressed', 'false')
  })
}
