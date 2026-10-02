import { test, expect } from './helpers/fixtures'
import { clickEditorAction } from './helpers/editor-controls'

const thumbnail = (page: import('@playwright/test').Page, name: string) => page.getByRole('button', { name, exact: true }).locator('.film-thumbnail')
const pixels = (canvas: import('@playwright/test').Locator) => canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL())

test('film dock paints real source-based previews and selection does not redraw ready thumbnails', async ({ page, editorPage }) => {
  const original = thumbnail(page, 'Select Original')
  const provia = thumbnail(page, 'Select film Provia')
  await expect(original).toHaveAttribute('data-preview-state', 'ready')
  await expect(provia).toHaveAttribute('data-preview-state', 'ready')
  await expect(original.locator('canvas')).toHaveAttribute('aria-hidden', 'true')
  const baseline = await pixels(original.locator('canvas'))
  const processed = await pixels(provia.locator('canvas'))
  const resizedSource = await original.locator('canvas').evaluate((canvas: HTMLCanvasElement) => {
    const preview = document.querySelector<HTMLCanvasElement>('canvas[aria-label="Preview"]')!
    const reference = document.createElement('canvas')
    reference.width = canvas.width
    reference.height = canvas.height
    reference.getContext('2d')!.drawImage(preview, 0, 0, canvas.width, canvas.height)
    return reference.toDataURL()
  })
  expect(baseline).toBe(resizedSource)
  expect(processed).not.toBe(baseline)
  await page.evaluate(() => {
    const originalPaint = CanvasRenderingContext2D.prototype.putImageData
    const draws: string[] = []
    ;(window as unknown as { filmDraws: string[] }).filmDraws = draws
    CanvasRenderingContext2D.prototype.putImageData = new Proxy(originalPaint, { apply(target, context: CanvasRenderingContext2D, args: unknown[]) {
      if (context.canvas.classList.contains('film-thumbnail-canvas')) draws.push(context.canvas.closest('button')!.getAttribute('aria-label')!)
      return Reflect.apply(target, context, args)
    } })
  })
  await page.getByRole('button', { name: 'Select film Provia', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Export processed image (Ctrl+S)', exact: true })).toBeEnabled()
  await clickEditorAction(page, 'Help')
  await page.getByRole('dialog', { name: 'Photochrome help', exact: true }).getByRole('button', { name: 'Close', exact: true }).click()
  expect(await pixels(original.locator('canvas'))).toBe(baseline)
  expect(await pixels(provia.locator('canvas'))).toBe(processed)
  const draws = await page.evaluate(() => (window as unknown as { filmDraws: string[] }).filmDraws)
  expect(draws).not.toContain('Select Original')
  expect(draws).not.toContain('Select film Provia')
})

test('offscreen film thumbnails render lazily when the mobile film strip scrolls', async ({ page }) => {
  await page.setViewportSize({ width: 393, height: 852 })
  await page.goto('/')
  const first = thumbnail(page, 'Select Original')
  const last = thumbnail(page, 'Select film Classic Neg')
  await expect(first).toHaveAttribute('data-preview-state', 'ready')
  await expect(last).toHaveAttribute('data-preview-state', 'idle')
  expect(await last.locator('canvas').evaluate((canvas: HTMLCanvasElement) => canvas.width)).toBe(0)
  await page.getByRole('button', { name: 'Select film Classic Neg', exact: true }).scrollIntoViewIfNeeded()
  await expect(last).toHaveAttribute('data-preview-state', 'ready')
  expect(await last.locator('canvas').evaluate((canvas: HTMLCanvasElement) => canvas.width)).toBeGreaterThan(0)
  await expect(page.getByRole('button', { name: 'Select Original', exact: true })).toHaveAttribute('aria-pressed', 'true')
})

test('holding Original compares color reversibly with pointer and keyboard without changing geometry', async ({ page, editorPage }) => {
  const preview = page.getByLabel('Preview', { exact: true })
  await page.keyboard.press('r')
  await expect.poll(() => preview.evaluate((canvas: HTMLCanvasElement) => [canvas.width, canvas.height])).toEqual([150, 200])
  const original = await pixels(preview)
  await page.getByRole('button', { name: 'Select film Provia', exact: true }).click()
  await expect.poll(() => pixels(preview)).not.toBe(original)
  const colored = await pixels(preview)
  const compare = page.getByRole('button', { name: 'Hold to compare original', exact: true })
  const box = await compare.boundingBox()
  if (!box) throw new Error('Comparison button unavailable')
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await expect(compare).toHaveAttribute('aria-pressed', 'true')
  await expect.poll(() => pixels(preview)).toBe(original)
  await page.mouse.up()
  await expect.poll(() => pixels(preview)).toBe(colored)
  await compare.focus()
  await page.keyboard.down('Space')
  await expect.poll(() => pixels(preview)).toBe(original)
  await page.keyboard.up('Space')
  await expect(compare).toHaveAttribute('aria-pressed', 'false')
  await expect.poll(() => pixels(preview)).toBe(colored)
  expect(await preview.evaluate((canvas: HTMLCanvasElement) => [canvas.width, canvas.height])).toEqual([150, 200])
  await expect(page.getByRole('button', { name: 'Select film Provia', exact: true })).toHaveAttribute('aria-pressed', 'true')
})

test('header exposes the correct primary export and secondary actions at desktop and mobile widths', async ({ page, multiImageEditorPage }) => {
  for (const width of [1200, 393]) {
    await page.setViewportSize({ width, height: 852 })
    const header = page.locator('header')
    const current = header.getByRole('button', { name: 'Export processed image (Ctrl+S)', exact: true })
    const batch = header.getByRole('button', { name: 'Export all photos', exact: true })
    const more = header.getByRole('button', { name: 'More editor actions', exact: true })
    await expect(width >= 768 ? current : batch).toBeVisible()
    await expect(width >= 768 ? batch : current).toBeHidden()
    await expect(header.getByRole('button', { name: 'Help', exact: true })).toBeHidden()
    await more.focus()
    await page.keyboard.press('Enter')
    await expect(current).toBeVisible()
    await expect(batch).toBeVisible()
    await expect(header.getByRole('button', { name: 'Apply current color to all 2 images', exact: true })).toBeVisible()
    await expect(header.getByRole('button', { name: 'Help', exact: true })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(more).toBeFocused()
    await expect(width >= 768 ? batch : current).toBeHidden()
  }
})

test('secondary export returns focus to the visible More trigger after completion closes', async ({ page, multiImageEditorPage }) => {
  for (const width of [1200, 393]) {
    await page.setViewportSize({ width, height: 852 })
    await expect(page.getByRole('button', { name: width >= 768 ? 'Export processed image (Ctrl+S)' : 'Export all photos', exact: true })).toBeVisible()
    const pending = page.waitForEvent('download')
    await clickEditorAction(page, width >= 768 ? 'Export all photos' : 'Export processed image (Ctrl+S)')
    await pending
    const completion = page.getByRole('dialog', { name: 'Export complete', exact: true })
    await expect(completion).toBeVisible()
    await expect(completion.getByRole('button', { name: 'Back to editor', exact: true })).toBeFocused()
    await page.keyboard.press('Escape')
    await expect(completion).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'More editor actions', exact: true })).toBeFocused()
  }
})
