import { test, expect } from './helpers/fixtures'
import { uploadImage, uploadMultipleImages, waitForEditor } from './helpers/upload'
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
  const cropRegion = page.getByRole('region', { name: 'Crop image', exact: true })

  for (const control of [cropTools, cropRegion]) {
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
  const carousel = page.getByRole('region', { name: 'Preset carousel', exact: true })
  const cards = carousel.locator('[aria-label^="Apply preset"]')
  await expect(cards.first()).toBeVisible({ timeout: 15_000 })
  await cards.first().click()
}

async function expectTouchTarget(locator: Locator): Promise<void> {
  const box = await locator.boundingBox()
  expect(box).not.toBeNull()
  if (!box) return
  expect(box.width).toBeGreaterThanOrEqual(44)
  expect(box.height).toBeGreaterThanOrEqual(44)
}

async function expectVisibleTouchTargets(locator: Locator): Promise<void> {
  const count = await locator.count()
  for (let index = 0; index < count; index += 1) {
    const target = locator.nth(index)
    if (await target.isVisible().catch(() => false)) await expectTouchTarget(target)
  }
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const dimensions = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
  }))
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1)
  expect(dimensions.bodyWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1)
}

async function expectNonOverlappingVisibleButtons(container: Locator): Promise<void> {
  const boxes = await container.locator('button:visible').evaluateAll(buttons => buttons
    .filter(button => {
      const style = getComputedStyle(button)
      const rect = button.getBoundingClientRect()
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0
    })
    .map(button => {
      const rect = button.getBoundingClientRect()
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }
    }))

  for (let leftIndex = 0; leftIndex < boxes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < boxes.length; rightIndex += 1) {
      const left = boxes[leftIndex]
      const right = boxes[rightIndex]
      const overlaps = left.left < right.right - 1
        && left.right > right.left + 1
        && left.top < right.bottom - 1
        && left.bottom > right.top + 1
      expect(overlaps, `mobile controls overlap at indexes ${leftIndex} and ${rightIndex}`).toBe(false)
    }
  }
}

async function expectVisibleButtonTextFits(buttons: Locator): Promise<void> {
  const issues = await buttons.evaluateAll(elements => elements.flatMap(button => {
    const buttonStyle = getComputedStyle(button)
    const buttonRect = button.getBoundingClientRect()
    if (buttonStyle.display === 'none' || buttonStyle.visibility === 'hidden' || buttonRect.width === 0 || buttonRect.height === 0) return []

    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const walker = document.createTreeWalker(button, NodeFilter.SHOW_TEXT)
    const textRects: Array<{ text: string; rect: DOMRect }> = []
    let node = walker.nextNode()
    while (node) {
      const text = node.textContent?.trim()
      const parent = node.parentElement
      if (text && parent && !parent.closest('[aria-hidden="true"]')) {
        const range = document.createRange()
        range.selectNodeContents(node)
        textRects.push(...Array.from(range.getClientRects()).map(rect => ({ text, rect })))
      }
      node = walker.nextNode()
    }

    return textRects.flatMap(({ text, rect }) => {
      const fitsButton = rect.left >= buttonRect.left - 1
        && rect.right <= buttonRect.right + 1
        && rect.top >= buttonRect.top - 1
        && rect.bottom <= buttonRect.bottom + 1
      const fitsViewport = rect.left >= -1
        && rect.right <= viewportWidth + 1
        && rect.top >= -1
        && rect.bottom <= viewportHeight + 1
      return fitsButton && fitsViewport ? [] : [{
        text,
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom),
      }]
    })
  }))

  expect(issues).toEqual([])
}

async function stressTextSize(page: Page): Promise<void> {
  await page.locator('header button, nav[aria-label="Editor modes"] button, .mobile-editor-actions button').evaluateAll(elements => {
    for (const element of elements) {
      const fontSize = Number.parseFloat(getComputedStyle(element).fontSize)
      if (Number.isFinite(fontSize)) (element as HTMLElement).style.fontSize = `${fontSize * 2}px`
    }
  })
  await page.waitForTimeout(0)
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

  for (const viewport of [
    { width: 320, height: 740 },
    { width: 393, height: 852 },
  ]) {
    test.describe(`compact mobile chrome at ${viewport.width}px`, () => {
      test.use({ viewport })

      test('keeps touch targets, rows, and text within the viewport', async ({ page, editorPage }) => {
        const header = page.locator('header:visible')
        const modes = page.getByRole('navigation', { name: 'Editor modes', exact: true })
        const actions = page.locator('.mobile-editor-actions:visible')

        await expectVisibleTouchTargets(header.locator('button:visible'))
        await expectVisibleTouchTargets(modes.locator('button:visible'))
        await expectVisibleTouchTargets(actions.locator('button:visible'))
        await expectNonOverlappingVisibleButtons(header)
        await expectNonOverlappingVisibleButtons(modes)
        await expectNonOverlappingVisibleButtons(actions)
        await expectNoHorizontalOverflow(page)

        await stressTextSize(page)
        await expectVisibleTouchTargets(header.locator('button:visible'))
        await expectVisibleTouchTargets(modes.locator('button:visible'))
        await expectVisibleTouchTargets(actions.locator('button:visible'))
        await expectNonOverlappingVisibleButtons(header)
        await expectNonOverlappingVisibleButtons(modes)
        await expectNonOverlappingVisibleButtons(actions)
        await expectVisibleButtonTextFits(header.locator('button:visible'))
        await expectVisibleButtonTextFits(modes.locator('button:visible'))
        await expectVisibleButtonTextFits(actions.locator('button:visible'))
        await expectNoHorizontalOverflow(page)

        await page.goto('/', { waitUntil: 'domcontentloaded' })
        await uploadMultipleImages(page)
        await waitForEditor(page)
        await selectMobilePreset(page)

        const batchActions = page.locator('.mobile-editor-actions:visible')
        await expect(batchActions.getByRole('button', { name: /Apply current preset to all 2 images/ })).toBeVisible()
        await expect(batchActions.getByRole('button', { name: 'Export all photos', exact: true })).toBeVisible()
        await stressTextSize(page)
        await expectVisibleTouchTargets(batchActions.locator('button:visible'))
        await expectNonOverlappingVisibleButtons(batchActions)
        await expectVisibleButtonTextFits(batchActions.locator('button:visible'))
        await expectNoHorizontalOverflow(page)
      })

      test('keeps the circular Adjust tool browser keyboard reachable', async ({ page }) => {
        await page.goto('/', { waitUntil: 'domcontentloaded' })
        await uploadImage(page, 'test-image.jpg')
        await waitForEditor(page)
        await selectMobilePreset(page)

        const modes = page.getByRole('navigation', { name: 'Editor modes', exact: true })
        await modes.getByRole('button', { name: /^adjust$/i }).click()
        const tools = page.getByLabel('Adjust tools', { exact: true })
        await expect(tools).toBeVisible()
        const toolButtons = tools.locator('button:visible')
        await expect(toolButtons).not.toHaveCount(0)
        await expectVisibleTouchTargets(toolButtons)

        const highlight = tools.getByRole('button', { name: 'Adjust Highlight', exact: true })
        await highlight.focus()
        await expect(highlight).toBeFocused()
        await page.keyboard.press('Enter')

        const controls = page.getByLabel('Highlight controls', { exact: true })
        const slider = controls.getByRole('slider', { name: 'Highlight', exact: true })
        const initialValue = await slider.getAttribute('aria-valuenow')
        await slider.focus()
        await expect(slider).toBeFocused()
        await page.keyboard.press('ArrowRight')
        await expect(slider).not.toHaveAttribute('aria-valuenow', initialValue ?? '')
        await expect(controls.getByText('Highlight', { exact: true })).toBeVisible()

        await expectNoHorizontalOverflow(page)
      })
    })
  }

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

  test('contains a portrait in the Crop workspace before and during a non-modal crop session', async ({ page }) => {
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
    const cropRegion = page.getByRole('region', { name: 'Crop image', exact: true })
    await expect(cropRegion).toBeVisible()
    await expect(cropRegion).not.toHaveAttribute('aria-modal', 'true')
    await expect(page.getByRole('dialog', { name: 'Crop image', exact: true })).toHaveCount(0)
    await expect(modes).toBeVisible()
    await expect(modes.getByRole('button', { name: /^crop$/i })).toHaveAttribute('aria-current', 'page')
    await expectContainedInWorkspace(page)

    await page.getByRole('button', { name: 'Cancel', exact: true }).click()
    await expect(cropRegion).toBeHidden()
    await expect(page.getByLabel('Crop tools', { exact: true })).toBeVisible()
    await expectContainedInWorkspace(page)

    await openCrop.click()
    await expect(cropRegion).toBeVisible()
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    await expect(cropRegion).toBeHidden()
    await expect(page.getByLabel('Crop tools', { exact: true })).toBeVisible()
    await expectContainedInWorkspace(page)
  })
})
