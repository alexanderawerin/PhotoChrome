import { test, expect } from './helpers/fixtures'
import { fixturePath, selectBaseFilm, waitForEditor } from './helpers/upload'
import { previewPixels } from './helpers/advanced'

for (const width of [393, 1440]) {
  test(`contact sheet selects photos directly and retains independent edits at ${width}px`, async ({ page, multiImageEditorPage }) => {
    await page.setViewportSize({ width, height: 900 })
    const strip = page.getByRole('group', { name: 'Your photos', exact: true })
    const first = strip.getByRole('button', { name: 'Select photo 1: test-image.jpg', exact: true })
    const second = strip.getByRole('button', { name: 'Select photo 2: test-image-2.jpg', exact: true })
    await selectBaseFilm(page, 'Velvia')
    const edited = await previewPixels(page, 'photo')
    await second.click()
    await expect(second).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByLabel('Applied color', { exact: true })).toContainText('Original')
    await expect(page.locator('.editor-media-title')).toHaveText('test-image-2.jpg')
    await expect.poll(() => previewPixels(page, 'photo')).not.toBe(edited)
    await first.click()
    await expect(first).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByLabel('Applied color', { exact: true })).toContainText('Velvia')
    await expect.poll(() => previewPixels(page, 'photo')).toBe(edited)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  })
}

test('demo contact sheet switches photos without exposing full editing controls', async ({ page, landingPage }) => {
  await waitForEditor(page)
  const strip = page.getByRole('group', { name: 'Demo photos', exact: true })
  const before = await previewPixels(page, 'photo')
  const third = strip.getByRole('button', { name: 'Select photo 3: Demo 3', exact: true })
  await third.click()
  await expect(third).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(() => previewPixels(page, 'photo')).not.toBe(before)
  await expect(page.getByRole('button', { name: 'Add media (photos or video)', exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: /Export|Advanced|^Crop$/ })).toHaveCount(0)
})

test('canceling an import preserves edits and rejects late decoder completion', async ({ page, multiImageEditorPage }) => {
  await selectBaseFilm(page)
  const before = await previewPixels(page, 'photo')
  await page.evaluate(() => {
    const original = window.createImageBitmap
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    Object.assign(window, { releaseCanceledDecode: release })
    window.createImageBitmap = new Proxy(original, {
      apply(target, thisArg, args) {
        window.createImageBitmap = original
        return gate.then(() => Reflect.apply(target, thisArg, args))
      },
    })
  })
  await page.getByLabel('Add photos to current batch', { exact: true }).setInputFiles(fixturePath('test-image.jpg'))
  const loading = page.getByRole('status', { name: 'Loading image', exact: true })
  await expect(loading).toBeVisible()
  await loading.getByRole('button', { name: 'Cancel import', exact: true }).click()
  await expect(loading).toHaveCount(0)
  await expect(page.getByRole('group', { name: 'Your photos', exact: true }).getByRole('button')).toHaveCount(2)
  await expect.poll(() => previewPixels(page, 'photo')).toBe(before)
  await page.evaluate(() => (window as unknown as { releaseCanceledDecode: () => void }).releaseCanceledDecode())
  // A new import must succeed after the canceled decoder is released.
  await page.getByLabel('Add photos to current batch', { exact: true }).setInputFiles(fixturePath('test-image.jpg'))
  await expect(page.getByRole('group', { name: 'Your photos', exact: true }).getByRole('button')).toHaveCount(3)
  await expect.poll(() => previewPixels(page, 'photo')).toBe(before)
  await expect(page.getByLabel('Applied color', { exact: true })).toContainText('Provia')
})
