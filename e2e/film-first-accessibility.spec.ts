import AxeBuilder from '@axe-core/playwright'
import { test, expect } from './helpers/fixtures'
import { advancedPanel, editorCanvas, openAdvanced, startAdvancedMedia } from './helpers/advanced'

for (const width of [320, 393, 1200, 1600]) {
  for (const media of ['photo', 'video'] as const) {
    test(`${media} at ${width}px supports 200% text, reduced motion, keyboard and Advanced accessibility`, async ({ page }) => {
      test.setTimeout(60000)
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await startAdvancedMedia(page, media, width)
      await page.addStyleTag({ content: 'html { font-size: 200% !important; }' })
      await openAdvanced(page)
      const panel = advancedPanel(page)
      const recipes = panel.getByRole('tab', { name: 'Recipes', exact: true })
      await recipes.focus()
      await recipes.press('ArrowRight')
      await expect(panel.getByRole('tab', { name: 'Manual', exact: true })).toBeFocused()
      await expect(panel.getByRole('tab', { name: 'Manual', exact: true })).toHaveAttribute('aria-selected', 'true')
      await expect(panel.getByRole('slider', { name: 'Highlight', exact: true })).toBeVisible()
      const layout = await page.evaluate(() => ({ width: innerWidth, documentWidth: document.documentElement.scrollWidth }))
      expect(layout.documentWidth).toBeLessThanOrEqual(layout.width)
      const preview = await editorCanvas(page, media).boundingBox()
      expect(preview).not.toBeNull()
      expect(preview!.width).toBeGreaterThanOrEqual(60)
      expect(preview!.height).toBeGreaterThanOrEqual(60)
      for (const name of ['Apply', 'Cancel']) {
        const button = panel.getByRole('button', { name, exact: true })
        const box = await button.boundingBox()
        expect(box).not.toBeNull()
        expect(box!.x).toBeGreaterThanOrEqual(0)
        expect(box!.y).toBeGreaterThanOrEqual(0)
        expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1)
        expect(box!.y + box!.height).toBeLessThanOrEqual((page.viewportSize()?.height ?? 1000) + 1)
      }
      const scan = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
      expect(scan.violations).toEqual([])
      await panel.getByRole('button', { name: 'Cancel', exact: true }).click()
      await expect(panel).toHaveCount(0)
    })
  }
}
