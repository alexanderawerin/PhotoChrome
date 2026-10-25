import { test, expect } from './helpers/fixtures'
import { fixturePath, selectBaseFilm, waitForEditor } from './helpers/upload'
import { openAdvanced, previewPixels } from './helpers/advanced'

for (const width of [320, 393, 1440]) {
  test(`on-demand collection preserves independent edits at ${width}px`, async ({ page, multiImageEditorPage }) => {
    await page.setViewportSize({ width, height: 852 })
    const collection = page.getByRole('group', { name: 'Your photos', exact: true })
    await expect(collection).toHaveCount(0)
    await selectBaseFilm(page, 'Velvia')
    const edited = await previewPixels(page, 'photo')
    await page.getByRole('button', { name: 'Open photo collection, 1 of 2', exact: true }).click()
    await collection.getByRole('button', { name: 'Select photo 2: test-image-2.jpg', exact: true }).click()
    await expect(collection).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Open photo collection, 2 of 2', exact: true })).toBeFocused()
    await expect(page.getByLabel('Applied color', { exact: true })).toContainText('Original')
    await page.getByRole('button', { name: 'Open photo collection, 2 of 2', exact: true }).click()
    await collection.getByRole('button', { name: 'Select photo 1: test-image.jpg', exact: true }).click()
    await expect.poll(() => previewPixels(page, 'photo')).toBe(edited)
    await expect(page.getByLabel('Applied color', { exact: true })).toContainText('Velvia')
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  })
}

test('demo collection switches photos and retains demo restrictions', async ({ page, landingPage }) => {
  await waitForEditor(page)
  const before = await previewPixels(page, 'photo')
  await page.getByRole('button', { name: /Open demo photo collection/ }).click()
  await page.getByRole('button', { name: 'Select photo 3: Demo 3', exact: true }).click()
  await expect.poll(() => previewPixels(page, 'photo')).not.toBe(before)
  await expect(page.getByRole('button', { name: 'Upload photos', exact: true })).toBeEnabled()
  await expect(page.getByRole('button', { name: /Export|Advanced|^Crop$/ })).toHaveCount(0)
})

test('canceling import retains edits and rejects late decoder completion', async ({ page, multiImageEditorPage }) => {
  await selectBaseFilm(page)
  const before = await previewPixels(page, 'photo')
  await page.evaluate(() => {
    const original = window.createImageBitmap
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    Object.assign(window, { releaseCanceledDecode: release })
    window.createImageBitmap = new Proxy(original, { apply(target, thisArg, args) {
      window.createImageBitmap = original
      return gate.then(() => Reflect.apply(target, thisArg, args))
    } })
  })
  await page.getByLabel('Add photos to current batch', { exact: true }).setInputFiles(fixturePath('test-image.jpg'))
  const loading = page.getByRole('status', { name: 'Loading image', exact: true })
  await expect(loading).toBeVisible()
  await loading.getByRole('button', { name: 'Cancel import', exact: true }).click()
  await expect(loading).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Open photo collection, 1 of 2', exact: true })).toBeVisible()
  await expect.poll(() => previewPixels(page, 'photo')).toBe(before)
  await page.evaluate(() => (window as unknown as { releaseCanceledDecode: () => void }).releaseCanceledDecode())
  await page.getByLabel('Add photos to current batch', { exact: true }).setInputFiles(fixturePath('test-image.jpg'))
  await expect(page.getByRole('button', { name: 'Open photo collection, 1 of 3', exact: true })).toBeVisible()
  await expect.poll(() => previewPixels(page, 'photo')).toBe(before)
})

test('focused manual tool and draft survive desktop/mobile resize, then Cancel discards all changes', async ({ page, editorPage }) => {
  await selectBaseFilm(page)
  await page.setViewportSize({ width: 1200, height: 900 })
  await openAdvanced(page)
  await page.getByRole('tab', { name: 'Manual', exact: true }).click()
  const shadow = page.getByRole('slider', { name: 'Shadow', exact: true })
  await shadow.focus()
  await page.keyboard.press('ArrowRight')
  await expect(shadow).toHaveAttribute('aria-valuenow', '1')
  const node = await shadow.elementHandle()
  await page.setViewportSize({ width: 320, height: 740 })
  await expect(shadow).toBeFocused()
  await expect(page.getByRole('button', { name: 'Adjust Shadow', exact: true })).toHaveAttribute('aria-pressed', 'true')
  expect(await shadow.evaluate((element, previous) => element === previous, node)).toBe(true)
  await page.getByRole('button', { name: 'Adjust Color', exact: true }).click()
  await page.getByRole('slider', { name: 'Color', exact: true }).focus()
  await page.keyboard.press('ArrowRight')
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await openAdvanced(page)
  await page.getByRole('tab', { name: 'Manual', exact: true }).click()
  await page.getByRole('button', { name: 'Adjust Shadow', exact: true }).click()
  await expect(shadow).toHaveAttribute('aria-valuenow', '0')
  await page.getByRole('button', { name: 'Adjust Color', exact: true }).click()
  await expect(page.getByRole('slider', { name: 'Color', exact: true })).toHaveAttribute('aria-valuenow', '0')
})
