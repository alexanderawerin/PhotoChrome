import sharp from 'sharp'
import { test, expect } from './helpers/fixtures'

const films = ['Provia', 'Velvia', 'Astia', 'Pro 400H', 'Superia', 'Acros', 'Neopan', 'Eterna', 'Classic Chrome', 'Classic Neg']

test('new photo starts as Original and exposes exactly ten main films', async ({ page, editorPage }) => {
  const selection = page.getByRole('group', { name: 'Film selection' })
  await expect(selection.getByRole('button', { name: /^Select / })).toHaveCount(11)
  await expect(selection.getByRole('button', { name: 'Select Original', exact: true })).toHaveAttribute('aria-pressed', 'true')
  for (const film of films) await expect(selection.getByRole('button', { name: `Select film ${film}`, exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /Random|Smart Picks|Editor's Choice/i })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Export processed image (Ctrl+S)', exact: true })).toBeEnabled()
})

test('Original exports a valid full-resolution JPEG', async ({ page, editorPage }) => {
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export processed image (Ctrl+S)', exact: true }).click()
  const download = await downloaded
  expect(download.suggestedFilename()).toBe('photochrome_original_test-image.jpg')
  const path = await download.path()
  expect(path).not.toBeNull()
  const metadata = await sharp(path!).metadata()
  expect(metadata.format).toBe('jpeg')
  expect([metadata.width, metadata.height]).toEqual([200, 150])
})

test('selecting Original or another film preserves approved geometry', async ({ page, editorPage }) => {
  const canvas = page.locator('canvas[aria-label="Preview"]')
  await page.keyboard.press('r')
  await expect.poll(() => canvas.evaluate((element: HTMLCanvasElement) => [element.width, element.height])).toEqual([150, 200])
  for (const film of ['Provia', 'Classic Neg']) {
    const choice = page.getByRole('button', { name: `Select film ${film}`, exact: true })
    await choice.click()
    await expect(choice).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('button', { name: 'Export processed image (Ctrl+S)', exact: true })).toBeEnabled()
    await expect.poll(() => canvas.evaluate((element: HTMLCanvasElement) => [element.width, element.height])).toEqual([150, 200])
  }
  await page.getByRole('button', { name: 'Select Original', exact: true }).click()
  await expect.poll(() => canvas.evaluate((element: HTMLCanvasElement) => [element.width, element.height])).toEqual([150, 200])
})

test('comparison retains the same geometry while removing color', async ({ page, editorPage }) => {
  const canvas = page.locator('canvas[aria-label="Preview"]')
  await page.keyboard.press('r')
  await expect.poll(() => canvas.evaluate((element: HTMLCanvasElement) => [element.width, element.height])).toEqual([150, 200])
  const original = await canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL())
  await page.getByRole('button', { name: 'Select film Provia', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Export processed image (Ctrl+S)', exact: true })).toBeEnabled()
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur())
  await page.keyboard.down('Space')
  await expect.poll(() => canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL())).toBe(original)
  await page.keyboard.up('Space')
  await expect.poll(() => canvas.evaluate((element: HTMLCanvasElement) => element.toDataURL())).not.toBe(original)
})
