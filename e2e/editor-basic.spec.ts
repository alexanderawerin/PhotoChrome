import { test, expect } from './helpers/fixtures'
import { selectBaseFilm } from './helpers/upload'

for (const width of [1200, 1600]) {
  test.describe(`Editor — Desktop at ${width}px`, () => {
    test.use({ viewport: { width, height: 900 } })

    test('starts with Original and keeps Advanced contextual', async ({ page, editorPage }) => {
      await expect(page.getByLabel('Preview', { exact: true })).toBeVisible()
      await expect(page.getByRole('complementary', { name: 'Film browser', exact: true })).toBeVisible()
      await expect(page.getByRole('region', { name: 'Advanced settings', exact: true })).toHaveCount(0)
      await expect(page.getByRole('button', { name: 'Open Advanced settings', exact: true })).toBeDisabled()
      await expect(page.getByRole('button', { name: 'Export processed image (Ctrl+S)', exact: true })).toBeEnabled()
    })

    test('opens and cancels Advanced without hiding the film choices', async ({ page, editorPage }) => {
      await selectBaseFilm(page)
      const open = page.getByRole('button', { name: 'Open Advanced settings', exact: true })
      await open.click()
      const advanced = page.getByRole('region', { name: 'Advanced settings', exact: true })
      await expect(advanced).toBeVisible()
      await expect(page.getByRole('group', { name: 'Film selection', exact: true })).toBeVisible()
      await page.getByRole('button', { name: 'Close Advanced settings', exact: true }).click()
      await expect(advanced).toHaveCount(0)
      await expect(open).toBeFocused()
      await open.click()
      await expect(advanced).toBeVisible()
      await advanced.getByRole('button', { name: 'Cancel', exact: true }).click()
      await expect(open).toBeFocused()
    })
  })
}
