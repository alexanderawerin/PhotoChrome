import { test, expect } from './helpers/fixtures'
import type { Locator, Page } from '@playwright/test'
import { advancedPanel, openAdvanced } from './helpers/advanced'
import { selectBaseFilm } from './helpers/upload'

test.use({ viewport: { width: 393, height: 852 } })

function modes(page: Page): Locator {
  return page.getByRole('navigation', { name: 'Editor modes', exact: true })
}

function cropRegion(page: Page): Locator {
  return page.getByRole('region', { name: 'Crop settings', exact: true })
}

function actionZone(page: Page): Locator {
  return page.getByRole('toolbar', { name: 'Editor actions', exact: true })
}

async function openCropSession(page: Page): Promise<Locator> {
  await modes(page).getByRole('button', { name: /^crop$/i }).click()

  const region = cropRegion(page)
  await expect(region).toBeVisible()
  return region
}

async function openRatioChooser(region: Locator): Promise<Locator> {
  await region.getByRole('button', { name: 'Choose crop ratio', exact: true }).click()
  const ratios = region.page().getByRole('group', { name: 'Crop ratios', exact: true })
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
  test('moves completion actions into the Crop dock and exposes a non-modal region', async ({ page, editorPage }) => {
    const actions = actionZone(page)
    await expect(actions).toBeVisible()

    const region = await openCropSession(page)
    await expect(region).not.toHaveAttribute('aria-modal', 'true')
    await expect(page.getByRole('dialog', { name: /Crop/ })).toHaveCount(0)
    await expect(modes(page)).toBeVisible()
    await expect(modes(page).getByRole('button', { name: /^crop$/i })).toHaveAttribute('aria-current', 'page')

    await expect(page.locator('header').getByRole('toolbar', { name: 'Editor actions', exact: true })).toHaveCount(0)

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
    // The brand is an inert outside target that preserves the Crop session.
    await page.locator('header').getByText('PhotoChrome', { exact: true }).click()
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

    await modes(page).getByRole('button', { name: 'Crop', exact: true }).click()
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
    await expect(done).toBeEnabled()
    await done.focus()
    await page.keyboard.press('Space')
    await expect(cropRegion(page)).toBeHidden()

    await modes(page).getByRole('button', { name: 'Crop', exact: true }).click()
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

    await modes(page).getByRole('button', { name: /^films$/i }).click()
    await expect(region).toBeHidden()
    await expect(modes(page).getByRole('button', { name: /^films$/i })).toHaveAttribute('aria-current', 'page')

    await modes(page).getByRole('button', { name: /^crop$/i }).click()
    region = cropRegion(page)
    await expect(region).toBeVisible()
    expect(await selectedRatio(region)).toBe(baselineRatio)
    await expect(region.getByRole('slider', { name: 'Crop angle', exact: true })).toHaveAttribute('aria-valuenow', baselineAngle ?? '0')
  })

  test('keeps C restricted during an Advanced draft and restores color after switching to Crop', async ({ page, editorPage }) => {
    await selectBaseFilm(page)
    await openAdvanced(page)
    const panel = advancedPanel(page)
    await panel.getByRole('tab', { name: 'Manual', exact: true }).click()
    const slider = panel.getByRole('slider', { name: 'Highlight', exact: true })
    const baseline = await slider.getAttribute('aria-valuenow')
    await slider.focus()
    await page.keyboard.press('ArrowRight')
    await expect(slider).not.toHaveAttribute('aria-valuenow', baseline!)
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur())
    await page.keyboard.press('c')
    await expect(panel).toBeVisible()
    await expect(cropRegion(page)).toHaveCount(0)

    await modes(page).getByRole('button', { name: 'Crop', exact: true }).click()
    await expect(panel).toHaveCount(0)
    await expect(cropRegion(page)).toBeVisible()
    await actionZone(page).getByRole('button', { name: 'Cancel', exact: true }).click()
    await openAdvanced(page)
    await panel.getByRole('tab', { name: 'Manual', exact: true }).click()
    await expect(slider).toHaveAttribute('aria-valuenow', baseline!)
  })

  test('does not expose Crop when C is pressed in the playable demo', async ({ page, landingPage }) => {
    await page.keyboard.press('c')
    await expect(cropRegion(page)).toHaveCount(0)
    await expect(modes(page).getByRole('button', { name: /^films$/i })).toHaveAttribute('aria-current', 'page')
    await expect(modes(page).getByRole('button', { name: /^(Open|Close) Advanced settings$/ })).toHaveCount(0)
    await expect(modes(page).getByRole('button', { name: /^crop$/i })).toHaveCount(0)
  })
})
