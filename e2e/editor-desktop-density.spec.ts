import { test, expect } from './helpers/fixtures'
import { advancedPanel, openAdvanced, startAdvancedMedia } from './helpers/advanced'
import { openCropSession } from './helpers/editor-controls'
import { selectBaseFilm } from './helpers/upload'

for (const width of [393, 1440]) {
  test(`Films and Recipes share option and thumbnail dimensions at ${width}px`, async ({ page, editorPage }) => {
    await page.setViewportSize({ width, height: 1000 })
    await selectBaseFilm(page)
    const film = page.getByRole('button', { name: 'Select film Provia', exact: true })
    const filmBox = await film.boundingBox()
    const filmThumbnail = await film.locator('.film-thumbnail').boundingBox()
    await openAdvanced(page)
    const recipe = advancedPanel(page).getByRole('button', { name: 'Apply preset Provia Portrait', exact: true })
    const recipeBox = await recipe.boundingBox()
    const recipeThumbnail = await recipe.locator('.film-thumbnail').boundingBox()
    if (!filmBox || !filmThumbnail || !recipeBox || !recipeThumbnail) throw new Error('Film option geometry unavailable')
    for (const key of ['width', 'height'] as const) {
      expect(Math.abs(recipeBox[key] - filmBox[key])).toBeLessThanOrEqual(1)
      expect(Math.abs(recipeThumbnail[key] - filmThumbnail[key])).toBeLessThanOrEqual(1)
    }
    await expect(recipe).toHaveClass(/film-option/)
    await expect(recipe.locator('.film-thumbnail')).toHaveAttribute('data-preview-state', 'ready')
    await expect(advancedPanel(page).getByRole('button', { name: /favorites/i })).toHaveCount(0)
  })
}

test('desktop film dock fits its contents and narrow dock scrolls without page overflow', async ({ page, editorPage }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  const dock = page.getByRole('complementary', { name: 'Editor controls', exact: true })
  const strip = page.getByRole('group', { name: 'Film selection', exact: true }).locator('.film-selector-scroll')
  await expect.poll(() => strip.evaluate(element => Math.abs(element.clientWidth - element.scrollWidth))).toBeLessThanOrEqual(1)
  const dockBox = await dock.boundingBox()
  const contentWidth = await strip.evaluate(element => element.scrollWidth)
  if (!dockBox) throw new Error('Film dock geometry unavailable')
  expect(dockBox.width - contentWidth).toBeLessThanOrEqual(32)
  await page.setViewportSize({ width: 768, height: 1000 })
  await expect.poll(() => strip.evaluate(element => element.scrollWidth - element.clientWidth)).toBeGreaterThan(1)
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(768)
})

test('desktop Crop actions and geometry tools precede controls in a compact dock', async ({ page, editorPage }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await openCropSession(page)
  const crop = page.getByRole('region', { name: 'Crop settings', exact: true })
  const done = crop.getByRole('button', { name: 'Done', exact: true })
  const cancel = crop.getByRole('button', { name: 'Cancel', exact: true })
  const rotate = crop.getByRole('button', { name: /Rotate/ })
  const slider = crop.getByRole('slider', { name: 'Crop angle', exact: true })
  const boxes = await Promise.all([done, cancel, rotate, slider].map(locator => locator.boundingBox()))
  if (boxes.some(box => !box)) throw new Error('Crop control geometry unavailable')
  const [doneBox, cancelBox, rotateBox, sliderBox] = boxes.map(box => box!)
  expect(Math.abs(doneBox.y - cancelBox.y)).toBeLessThanOrEqual(1)
  expect(Math.abs(doneBox.y - rotateBox.y)).toBeLessThanOrEqual(8)
  expect(doneBox.y + doneBox.height).toBeLessThanOrEqual(sliderBox.y)
  expect(doneBox.x).toBeGreaterThan(rotateBox.x)
  const dock = await page.getByRole('complementary', { name: 'Editor controls', exact: true }).boundingBox()
  expect(dock!.width).toBeLessThanOrEqual(640)
})

test('applied color stays within the photo in every mode and desktop comparison has compact bounds', async ({ page, editorPage }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  const preview = page.getByLabel('Preview', { exact: true })
  const status = page.getByLabel('Applied color', { exact: true })
  const expectInsidePhoto = async () => {
    const photo = await preview.boundingBox()
    const label = await status.boundingBox()
    if (!photo || !label) throw new Error('Photo status geometry unavailable')
    expect(label.x).toBeGreaterThanOrEqual(photo.x)
    expect(label.y).toBeGreaterThanOrEqual(photo.y)
    expect(label.x + label.width).toBeLessThanOrEqual(photo.x + photo.width)
    expect(label.y + label.height).toBeLessThanOrEqual(photo.y + photo.height)
  }
  await expectInsidePhoto()
  const compare = await page.getByRole('button', { name: 'Hold to compare original', exact: true }).boundingBox()
  expect(compare!.height).toBeLessThan(44)
  await selectBaseFilm(page)
  await openAdvanced(page)
  await expectInsidePhoto()
  await advancedPanel(page).getByRole('button', { name: 'Cancel', exact: true }).click()
  await openCropSession(page)
  await expectInsidePhoto()
})


test('wide touch Manual keeps toggle, reset, white balance and slider targets touch-sized', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, viewport: { width: 1106, height: 1000 }, baseURL: 'http://localhost:5173' })
  try {
    const page = await context.newPage()
    await startAdvancedMedia(page, 'photo', 1106)
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)
    await openAdvanced(page)
    const panel = advancedPanel(page)
    await panel.getByRole('tab', { name: 'Manual', exact: true }).click()
    const expectTargets = async () => {
      const buttons = panel.locator('.editor-tuning-control button')
      await expect(panel.getByRole('radio')).not.toHaveCount(0)
      await expect(panel.getByRole('button', { name: 'Reset Highlight to profile', exact: true })).toBeVisible()
      expect(await buttons.count()).toBeGreaterThan(20)
      for (const button of await buttons.all()) {
        const box = await button.boundingBox()
        if (!box) throw new Error('Manual button geometry unavailable')
        expect(box.width, await button.getAttribute('aria-label') ?? '').toBeGreaterThanOrEqual(44)
        expect(box.height, await button.getAttribute('aria-label') ?? '').toBeGreaterThanOrEqual(44)
      }
      for (const slider of await panel.getByRole('slider').all()) {
        expect(await slider.evaluate(element => element.closest('.editor-tuning-slider')!.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44)
      }
    }
    await expectTargets()
    await panel.getByRole('button', { name: 'White Balance Kelvin mode', exact: true }).click()
    await expect(panel.getByRole('slider', { name: /^White balance .* Kelvin$/ })).toBeVisible()
    await expectTargets()
  } finally {
    await context.close()
  }
})
