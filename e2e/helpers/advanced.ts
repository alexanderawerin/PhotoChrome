import { expect, type Page } from '@playwright/test'
import { uploadImage, uploadVideo, waitForEditor } from './upload'

export type AdvancedMedia = 'photo' | 'video'

export const advancedPanel = (page: Page) => page.getByRole('region', { name: 'Advanced settings', exact: true })
export const appliedColor = (page: Page) => page.getByLabel('Applied color', { exact: true })
export const advancedTrigger = (page: Page) => page.getByRole('navigation', { name: 'Editor modes', exact: true }).getByRole('button', { name: 'Open Advanced settings', exact: true })
export const editorCanvas = (page: Page, media: AdvancedMedia) => page.getByLabel(media === 'photo' ? 'Preview' : 'Video preview', { exact: true })

export async function startAdvancedMedia(page: Page, media: AdvancedMedia, width: number) {
  await page.setViewportSize({ width, height: width < 768 ? 852 : 1000 })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  if (media === 'video') {
    await uploadVideo(page, 'test-video-silent.mp4')
    const playback = page.getByRole('toolbar', { name: 'Video playback', exact: true })
    await playback.getByRole('button', { name: 'Pause', exact: true }).click()
    await expect(playback.getByRole('button', { name: 'Play', exact: true })).toBeVisible()
  }
  else {
    await uploadImage(page)
    await waitForEditor(page)
  }
  await page.getByRole('button', { name: 'Select film Provia', exact: true }).click()
  await expect(advancedTrigger(page)).toBeEnabled()
  await expect(editorCanvas(page, media)).toBeVisible()
}

export async function openAdvanced(page: Page) {
  await advancedTrigger(page).click()
  await expect(advancedPanel(page)).toHaveCount(1)
  await expect(advancedPanel(page)).toBeVisible()
  await expect(advancedPanel(page).getByRole('heading', { name: 'Advanced', exact: true })).toHaveCount(0)
  await expect(advancedPanel(page).getByRole('button', { name: 'Restore base film', exact: true })).toHaveCount(0)
}

export async function selectPortraitDraft(page: Page) {
  const panel = advancedPanel(page)
  await panel.getByRole('tab', { name: 'Recipes', exact: true }).click()
  await panel.getByRole('button', { name: /^Apply preset Provia Portrait(?:, selected)?$/ }).click()
  await expect(panel.getByRole('button', { name: 'Apply', exact: true })).toBeEnabled()
}

export async function changeHighlight(page: Page) {
  const panel = advancedPanel(page)
  await panel.getByRole('tab', { name: 'Manual', exact: true }).click()
  const slider = panel.getByRole('slider', { name: 'Highlight', exact: true })
  const before = await slider.getAttribute('aria-valuenow')
  await slider.focus()
  await page.keyboard.press(before === '4' ? 'ArrowLeft' : 'ArrowRight')
  await expect(slider).not.toHaveAttribute('aria-valuenow', before!)
  await expect(panel.getByRole('button', { name: 'Apply', exact: true })).toBeEnabled()
  return slider.getAttribute('aria-valuenow')
}

export async function previewPixels(page: Page, media: AdvancedMedia) {
  return editorCanvas(page, media).evaluate(async (canvas: HTMLCanvasElement) => {
    // Read after the scheduled preview paint; the uploaded video stays paused.
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Preview canvas has no readable pixel context')
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(pixels))
    return `${canvas.width}×${canvas.height}:${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')}`
  })
}
