import { test, expect } from './helpers/fixtures'
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

function modes(page: Page): Locator {
  return page.getByRole('navigation', { name: 'Editor modes', exact: true })
}

function cropTools(page: Page): Locator {
  return page.getByLabel('Crop tools', { exact: true })
}

function cropRegion(page: Page): Locator {
  return page.getByRole('region', { name: 'Crop image', exact: true })
}

function actionZone(page: Page): Locator {
  return page.locator('.mobile-editor-actions')
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

async function openCropSession(page: Page): Promise<Locator> {
  await modes(page).getByRole('button', { name: /^crop$/i }).click()
  await expect(cropTools(page)).toBeVisible()
  await cropTools(page).getByRole('button', { name: 'Open crop session', exact: true }).click()

  const region = cropRegion(page)
  await expect(region).toBeVisible()
  return region
}

async function openRatioChooser(region: Locator): Promise<Locator> {
  await region.getByRole('button', { name: 'Choose crop ratio', exact: true }).click()
  const ratios = region.getByRole('group', { name: 'Crop ratios', exact: true })
  await expect(ratios).toBeVisible()
  return ratios
}

async function selectedRatio(region: Locator): Promise<string> {
  const ratios = await openRatioChooser(region)
  const selected = ratios.locator('button[aria-pressed="true"]')
  await expect(selected).toHaveCount(1)
  const label = (await selected.textContent())?.trim() ?? ''
  await region.getByRole('button', { name: 'Choose crop ratio', exact: true }).click()
  return label
}

async function chooseRatio(region: Locator, label: string): Promise<void> {
  const ratios = await openRatioChooser(region)
  await ratios.getByRole('button', { name: label, exact: true }).click()
  await expect(region.getByRole('button', { name: 'Choose crop ratio', exact: true })).toBeFocused()
}

async function visibleRatioSlot(trigger: Locator): Promise<string> {
  return trigger.locator('span').evaluateAll(spans => {
    const visible = spans.find(span => Number.parseFloat(getComputedStyle(span).opacity) > 0.5)
    return visible?.textContent?.trim() ?? ''
  })
}

async function angleValueWhileHeld(page: Page, region: Locator): Promise<void> {
  const trigger = region.getByRole('button', { name: 'Choose crop ratio', exact: true })
  const idleRatio = await visibleRatioSlot(trigger)
  expect(idleRatio).not.toMatch(/°$/)

  const angle = region.getByRole('slider', { name: 'Crop angle', exact: true })
  const initialAngle = await angle.getAttribute('aria-valuenow')
  await angle.focus()
  await page.keyboard.down('ArrowRight')
  await expect.poll(() => visibleRatioSlot(trigger)).toMatch(/^-?\d+\.\d+°$/)
  expect(await angle.getAttribute('aria-valuenow')).not.toBe(initialAngle)
  await page.keyboard.up('ArrowRight')
  await expect.poll(() => visibleRatioSlot(trigger)).toBe(idleRatio)

  const sliderBox = await angle.boundingBox()
  expect(sliderBox).not.toBeNull()
  if (!sliderBox) return

  await page.mouse.move(sliderBox.x + sliderBox.width * 0.45, sliderBox.y + sliderBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(sliderBox.x + sliderBox.width * 0.75, sliderBox.y + sliderBox.height / 2)
  await expect.poll(() => visibleRatioSlot(trigger)).toMatch(/^-?\d+\.\d+°$/)
  await page.mouse.up()
  await expect.poll(() => visibleRatioSlot(trigger)).toBe(idleRatio)
}

async function expectTouchTarget(locator: Locator): Promise<void> {
  const box = await locator.boundingBox()
  expect(box).not.toBeNull()
  if (!box) return
  expect(box.width).toBeGreaterThanOrEqual(44)
  expect(box.height).toBeGreaterThanOrEqual(44)
}

test.describe('Editor — mobile Crop session', () => {
  test('keeps the action zone stable and exposes Crop as a non-modal region', async ({ page, editorPage }) => {
    const actions = actionZone(page)
    await expect(actions).toBeVisible()
    const presetsActions = await readRect(actions)

    const region = await openCropSession(page)
    await expect(region).not.toHaveAttribute('aria-modal', 'true')
    await expect(page.getByRole('dialog', { name: 'Crop image', exact: true })).toHaveCount(0)
    await expect(modes(page)).toBeVisible()
    await expect(modes(page).getByRole('button', { name: /^crop$/i })).toHaveAttribute('aria-current', 'page')

    const cropActions = await readRect(actions)
    expect(Math.abs(cropActions.width - presetsActions.width)).toBeLessThanOrEqual(EPSILON)
    expect(Math.abs(cropActions.height - presetsActions.height)).toBeLessThanOrEqual(EPSILON)

    const cancel = actions.getByRole('button', { name: 'Cancel', exact: true })
    const done = actions.getByRole('button', { name: 'Done', exact: true })
    await expect(cancel).toBeVisible()
    await expect(done).toBeVisible()
    const cancelBox = await cancel.boundingBox()
    const doneBox = await done.boundingBox()
    expect(cancelBox).not.toBeNull()
    expect(doneBox).not.toBeNull()
    if (cancelBox && doneBox) expect(cancelBox.x).toBeLessThan(doneBox.x)
  })

  test('dismisses and selects crop ratios with the keyboard while preserving focus', async ({ page, editorPage }) => {
    const region = await openCropSession(page)
    const trigger = region.getByRole('button', { name: 'Choose crop ratio', exact: true })

    const ratios = await openRatioChooser(region)
    await expect(ratios.getByRole('button', { name: 'Original', exact: true })).toBeVisible()
    await expect(ratios.getByRole('button', { name: 'Free', exact: true })).toBeVisible()
    await expect(ratios.getByRole('button', { name: '9:16', exact: true })).toBeVisible()
    await expect(ratios.getByRole('menuitem')).toHaveCount(0)
    await expect(ratios.locator('button[aria-pressed="true"]')).toHaveCount(1)

    await page.keyboard.press('Escape')
    await expect(ratios).toBeHidden()
    await expect(region).toBeVisible()
    await expect(trigger).toBeFocused()
    await expect(region.getByRole('slider', { name: 'Crop angle', exact: true })).toBeVisible()

    await trigger.click()
    await expect(ratios).toBeVisible()
    // The crop overlay intentionally sits above the canvas.  Click the inert
    // filename in the header as a real outside target for the chooser.
    await page.locator('header:visible p:visible').filter({ hasText: 'test-image.jpg' }).click()
    await expect(ratios).toBeHidden()
    await expect(region).toBeVisible()

    await trigger.click()
    const square = ratios.getByRole('button', { name: '1:1', exact: true })
    await square.focus()
    await page.keyboard.press('Enter')
    await expect(ratios).toBeHidden()
    await expect(trigger).toBeFocused()
    await expect(trigger.locator('span:not([aria-hidden="true"])')).toHaveText('1:1')
    expect(await selectedRatio(region)).toBe('1:1')
  })

  test('shows the fine angle only while the angle control is held and keeps sliders touch-sized', async ({ page, editorPage }) => {
    const region = await openCropSession(page)
    const angle = region.getByRole('slider', { name: 'Crop angle', exact: true })
    const zoom = region.getByRole('slider', { name: 'Crop zoom', exact: true })
    // Radix exposes the thumb itself as role=slider; the Slider root two
    // levels above it is the enlarged touch target supplied by the wrapper.
    await expectTouchTarget(angle.locator('xpath=../..'))
    await expectTouchTarget(zoom.locator('xpath=../..'))
    await angleValueWhileHeld(page, region)
  })

  test('reverts a canceled crop draft and persists a completed one', async ({ page, editorPage }) => {
    let region = await openCropSession(page)
    const baselineRatio = await selectedRatio(region)
    const baselineAngle = await region.getByRole('slider', { name: 'Crop angle', exact: true }).getAttribute('aria-valuenow')

    await chooseRatio(region, '1:1')
    const draftAngleControl = region.getByRole('slider', { name: 'Crop angle', exact: true })
    await draftAngleControl.focus()
    await page.keyboard.press('ArrowRight')
    const draftAngle = await draftAngleControl.getAttribute('aria-valuenow')
    expect(draftAngle).not.toBe(baselineAngle)

    const cancel = actionZone(page).getByRole('button', { name: 'Cancel', exact: true })
    await cancel.focus()
    await page.keyboard.press('Enter')
    await expect(cropRegion(page)).toBeHidden()

    await cropTools(page).getByRole('button', { name: 'Open crop session', exact: true }).click()
    region = cropRegion(page)
    await expect(region).toBeVisible()
    expect(await selectedRatio(region)).toBe(baselineRatio)
    await expect(region.getByRole('slider', { name: 'Crop angle', exact: true })).toHaveAttribute('aria-valuenow', baselineAngle ?? '0')

    await chooseRatio(region, '1:1')
    const committedAngleControl = region.getByRole('slider', { name: 'Crop angle', exact: true })
    await committedAngleControl.focus()
    await page.keyboard.press('ArrowRight')
    const committedAngle = await committedAngleControl.getAttribute('aria-valuenow')
    const done = actionZone(page).getByRole('button', { name: 'Done', exact: true })
    await done.focus()
    await page.keyboard.press('Space')
    await expect(cropRegion(page)).toBeHidden()

    await cropTools(page).getByRole('button', { name: 'Open crop session', exact: true }).click()
    region = cropRegion(page)
    await expect(region).toBeVisible()
    expect(await selectedRatio(region)).toBe('1:1')
    await expect(region.getByRole('slider', { name: 'Crop angle', exact: true })).toHaveAttribute('aria-valuenow', committedAngle ?? '0')
  })

  test('cancels an unfinished crop when switching the primary tab', async ({ page, editorPage }) => {
    let region = await openCropSession(page)
    const baselineRatio = await selectedRatio(region)
    const baselineAngle = await region.getByRole('slider', { name: 'Crop angle', exact: true }).getAttribute('aria-valuenow')

    await chooseRatio(region, '1:1')
    const angle = region.getByRole('slider', { name: 'Crop angle', exact: true })
    await angle.focus()
    await page.keyboard.press('ArrowRight')

    await modes(page).getByRole('button', { name: /^presets$/i }).click()
    await expect(region).toBeHidden()
    await expect(modes(page).getByRole('button', { name: /^presets$/i })).toHaveAttribute('aria-current', 'page')

    await modes(page).getByRole('button', { name: /^crop$/i }).click()
    await cropTools(page).getByRole('button', { name: 'Open crop session', exact: true }).click()
    region = cropRegion(page)
    await expect(region).toBeVisible()
    expect(await selectedRatio(region)).toBe(baselineRatio)
    await expect(region.getByRole('slider', { name: 'Crop angle', exact: true })).toHaveAttribute('aria-valuenow', baselineAngle ?? '0')
  })

  test('opens Crop with C after blurring an unfinished Adjust tool and restores its draft', async ({ page, editorPage }) => {
    await page.getByRole('region', { name: 'Preset carousel', exact: true }).locator('[aria-label^="Apply preset"]').first().click()
    await modes(page).getByRole('button', { name: /^adjust$/i }).click()
    await page.getByRole('button', { name: 'Adjust Highlight', exact: true }).click()

    const adjustControls = page.getByLabel('Highlight controls', { exact: true })
    const slider = adjustControls.getByRole('slider', { name: 'Highlight', exact: true })
    const baseline = await slider.getAttribute('aria-valuenow')
    await slider.focus()
    await page.keyboard.press('ArrowRight')
    await expect(slider).not.toHaveAttribute('aria-valuenow', baseline ?? '')

    // Blur through a passive header label so the C shortcut reaches the editor.
    await page.locator('header:visible p:visible').filter({ hasText: 'test-image.jpg' }).click()
    await page.keyboard.press('c')
    await expect(modes(page).getByRole('button', { name: /^crop$/i })).toHaveAttribute('aria-current', 'page')
    const crop = cropRegion(page)
    await expect(crop).toBeVisible()

    await actionZone(page).getByRole('button', { name: 'Cancel', exact: true }).click()
    await modes(page).getByRole('button', { name: /^adjust$/i }).click()
    await page.getByRole('button', { name: 'Adjust Highlight', exact: true }).click()
    await expect(page.getByLabel('Highlight controls', { exact: true }).getByRole('slider', { name: 'Highlight', exact: true })).toHaveAttribute('aria-valuenow', baseline ?? '0')
  })

  test('does not expose Crop when C is pressed in the playable demo', async ({ page, landingPage }) => {
    await page.keyboard.press('c')
    await expect(cropRegion(page)).toHaveCount(0)
    await expect(modes(page).getByRole('button', { name: /^presets$/i })).toHaveAttribute('aria-current', 'page')
    await expect(modes(page).getByRole('button', { name: /^adjust$/i })).toHaveCount(0)
    await expect(modes(page).getByRole('button', { name: /^crop$/i })).toHaveCount(0)
  })
})
