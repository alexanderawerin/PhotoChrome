import { test, expect } from './helpers/fixtures'
import { uploadImage, waitForEditor } from './helpers/upload'
import type { Locator, Page } from '@playwright/test'

test.use({ viewport: { width: 393, height: 852 } })

const EPSILON = 2

type Rect = {
  top: number
  right: number
  bottom: number
  left: number
  width: number
  height: number
}

type PreviewGeometry = Rect & {
  viewportWidth: number
  viewportHeight: number
  sourceWidth: number
  sourceHeight: number
}

function preview(page: Page): Locator {
  return page.locator('canvas[aria-label="Preview"]')
}

async function readRect(locator: Locator): Promise<Rect> {
  return locator.evaluate(element => {
    const rect = element.getBoundingClientRect()
    return {
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    }
  })
}

type AdjustSlotState = {
  iconOpacity: number
  valueOpacity: number
  valueText: string
}

async function readAdjustSlotState(controls: Locator): Promise<AdjustSlotState> {
  return controls.locator('div[aria-hidden="true"]').evaluate(slot => {
    const icon = slot.querySelector('svg')
    const value = slot.querySelector('span')
    return {
      iconOpacity: Number(icon ? getComputedStyle(icon).opacity : 0),
      valueOpacity: Number(value ? getComputedStyle(value).opacity : 0),
      valueText: value?.textContent?.trim() ?? '',
    }
  })
}

async function readPreviewGeometry(page: Page): Promise<PreviewGeometry> {
  return preview(page).evaluate(canvas => {
    const rect = canvas.getBoundingClientRect()
    const element = canvas as HTMLCanvasElement
    return {
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      sourceWidth: element.width,
      sourceHeight: element.height,
    }
  })
}

async function waitForPreview(page: Page): Promise<void> {
  await expect(preview(page)).toBeVisible({ timeout: 15_000 })
  await expect.poll(async () => {
    const box = await readPreviewGeometry(page)
    return box.width > 0 && box.height > 0
  }).toBe(true)
}

async function expectFullViewportCover(page: Page): Promise<void> {
  await expect.poll(async () => {
    const box = await readPreviewGeometry(page)
    return box.sourceWidth > 0
      && box.sourceHeight > 0
      && box.width >= box.viewportWidth - EPSILON
      && box.height >= box.viewportHeight - EPSILON
      && box.left <= EPSILON
      && box.top <= EPSILON
      && box.right >= box.viewportWidth - EPSILON
      && box.bottom >= box.viewportHeight - EPSILON
  }).toBe(true)
}

async function visibleLowerControl(page: Page): Promise<Rect> {
  const cropTools = page.getByLabel('Crop tools', { exact: true })
  const cropDialog = page.getByRole('dialog', { name: 'Crop image', exact: true })

  for (const control of [cropTools, cropDialog]) {
    if (await control.isVisible().catch(() => false)) return readRect(control)
  }

  throw new Error('Expected visible mobile lower controls for preview workspace')
}

async function expectContainedInWorkspace(page: Page): Promise<void> {
  const header = page.locator('header:visible')
  await expect.poll(async () => {
    const box = await readPreviewGeometry(page)
    const headerRect = await readRect(header)
    const lowerRect = await visibleLowerControl(page)
    return box.sourceWidth > 0
      && box.sourceHeight > 0
      && Math.abs(box.width / box.height - box.sourceWidth / box.sourceHeight) < 0.01
      && box.left >= -EPSILON
      && box.right <= box.viewportWidth + EPSILON
      && box.top >= headerRect.bottom - EPSILON
      && box.bottom <= lowerRect.top + EPSILON
  }).toBe(true)
}

async function selectMobilePreset(page: Page): Promise<void> {
  await page
    .getByRole('region', { name: 'Preset carousel', exact: true })
    .locator('[aria-label^="Apply preset"]')
    .first()
    .click()
}

test.describe('Editor — mobile preview layout', () => {
  test('keeps the demo preview fullbleed while preserving demo restrictions', async ({ page, landingPage }) => {
    await waitForPreview(page)
    await expect(page.getByRole('button', { name: 'Upload photos', exact: true })).toBeVisible({ timeout: 15_000 })
    await expectFullViewportCover(page)

    const modes = page.getByRole('navigation', { name: 'Editor modes', exact: true })
    await expect(modes.getByRole('button', { name: /^presets$/i })).toHaveAttribute('aria-current', 'page')
    await expect(modes.getByRole('button', { name: /^adjust$/i })).toHaveCount(0)
    await expect(modes.getByRole('button', { name: /^crop$/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Export/ })).toHaveCount(0)
  })

  for (const fixture of ['test-image.jpg', 'test-image-2.jpg']) {
    test(`keeps ${fixture} fullbleed across Presets and Adjust`, async ({ page }) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' })
      await uploadImage(page, fixture)
      await waitForEditor(page)
      await waitForPreview(page)
      await selectMobilePreset(page)
      await expectFullViewportCover(page)

      const modes = page.getByRole('navigation', { name: 'Editor modes', exact: true })
      await modes.getByRole('button', { name: /^adjust$/i }).click()
      await expect(modes.getByRole('button', { name: /^adjust$/i })).toHaveAttribute('aria-current', 'page')
      await expect(page.getByLabel('Adjust tools', { exact: true })).toBeVisible()
      await expectFullViewportCover(page)
    })
  }

  test('shows Adjust title and value while active, then restores the icon when idle', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await uploadImage(page, 'test-image.jpg')
    await waitForEditor(page)
    await selectMobilePreset(page)

    const modes = page.getByRole('navigation', { name: 'Editor modes', exact: true })
    await modes.getByRole('button', { name: /^adjust$/i }).click()
    await page.getByRole('button', { name: 'Adjust Highlight', exact: true }).click()

    const controls = page.getByLabel('Highlight controls', { exact: true })
    const slider = controls.getByRole('slider', { name: 'Highlight', exact: true })
    const valueSlot = controls.locator('[aria-hidden="true"] span')
    await expect(controls.getByText('Highlight', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Reset Highlight to preset', exact: true })).toBeVisible()

    const initialValue = await slider.getAttribute('aria-valuenow')
    await slider.focus()
    await page.keyboard.down('ArrowRight')
    await expect(slider).not.toHaveAttribute('aria-valuenow', initialValue ?? '')
    await expect.poll(() => readAdjustSlotState(controls)).toMatchObject({
      iconOpacity: 0,
      valueOpacity: 1,
    })
    await expect(valueSlot).toHaveText((await slider.getAttribute('aria-valuetext')) ?? '')

    await page.keyboard.up('ArrowRight')
    await expect.poll(() => readAdjustSlotState(controls)).toMatchObject({
      iconOpacity: 1,
      valueOpacity: 0,
    })

    const sliderBox = await slider.boundingBox()
    expect(sliderBox).not.toBeNull()
    if (!sliderBox) return
    await page.mouse.move(sliderBox.x + sliderBox.width / 2, sliderBox.y + sliderBox.height / 2)
    await page.mouse.down()
    await page.mouse.move(sliderBox.x + sliderBox.width / 2 + 20, sliderBox.y + sliderBox.height / 2)
    await expect.poll(() => readAdjustSlotState(controls)).toMatchObject({
      iconOpacity: 0,
      valueOpacity: 1,
    })
    await expect(valueSlot).toHaveText((await slider.getAttribute('aria-valuetext')) ?? '')

    await page.mouse.up()
    await expect.poll(() => readAdjustSlotState(controls)).toMatchObject({
      iconOpacity: 1,
      valueOpacity: 0,
    })
  })

  test('restores a canceled Adjust session and keeps a completed one after reopening', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await uploadImage(page, 'test-image.jpg')
    await waitForEditor(page)
    await selectMobilePreset(page)

    const modes = page.getByRole('navigation', { name: 'Editor modes', exact: true })
    await modes.getByRole('button', { name: /^adjust$/i }).click()
    await page.getByRole('button', { name: 'Adjust Highlight', exact: true }).click()
    const firstSlider = page.getByLabel('Highlight controls', { exact: true }).getByRole('slider', { name: 'Highlight', exact: true })
    const baseline = await firstSlider.getAttribute('aria-valuenow')
    await firstSlider.focus()
    await page.keyboard.press('ArrowRight')
    const draft = await firstSlider.getAttribute('aria-valuenow')
    expect(draft).not.toBe(baseline)

    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(page.getByLabel('Adjust tools', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Adjust Highlight', exact: true }).click()
    await expect(page.getByLabel('Highlight controls', { exact: true }).getByRole('slider', { name: 'Highlight', exact: true })).toHaveAttribute('aria-valuenow', baseline ?? '')

    const canceledSlider = page.getByLabel('Highlight controls', { exact: true }).getByRole('slider', { name: 'Highlight', exact: true })
    await canceledSlider.focus()
    await page.keyboard.press('ArrowRight')
    const completedValue = await canceledSlider.getAttribute('aria-valuenow')
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    await expect(page.getByLabel('Adjust tools', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Adjust Highlight', exact: true }).click()
    await expect(page.getByLabel('Highlight controls', { exact: true }).getByRole('slider', { name: 'Highlight', exact: true })).toHaveAttribute('aria-valuenow', completedValue ?? '')
  })

  test('contains a portrait in the Crop workspace before and during a crop session', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await uploadImage(page, 'test-image-2.jpg')
    await waitForEditor(page)
    await waitForPreview(page)

    const modes = page.getByRole('navigation', { name: 'Editor modes', exact: true })
    await modes.getByRole('button', { name: /^crop$/i }).click()
    await expect(modes.getByRole('button', { name: /^crop$/i })).toHaveAttribute('aria-current', 'page')
    await expect(page.getByLabel('Crop tools', { exact: true })).toBeVisible()
    await expectContainedInWorkspace(page)

    const openCrop = page.getByRole('button', { name: 'Open crop session', exact: true })
    await openCrop.click()
    const dialog = page.getByRole('dialog', { name: 'Crop image', exact: true })
    await expect(dialog).toBeVisible()
    await expectContainedInWorkspace(page)

    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(dialog).toBeHidden()
    await expectContainedInWorkspace(page)

    await openCrop.click()
    await expect(dialog).toBeVisible()
    await dialog.getByRole('button', { name: 'Apply', exact: true }).click()
    await expect(dialog).toBeHidden()
    await expectContainedInWorkspace(page)
  })
})
