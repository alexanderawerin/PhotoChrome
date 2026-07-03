import { Page } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures')

export function fixturePath(filename: string): string {
  return path.join(FIXTURES_DIR, filename)
}

function mediaInput(page: Page) {
  return page.locator('input[aria-label="Choose photos or video to edit"], input#media-upload').first()
}

/** Upload a single image via the playable demo CTA. */
export async function uploadImage(page: Page, filename = 'test-image.jpg') {
  const fileInput = mediaInput(page)
  await fileInput.waitFor({ state: 'attached', timeout: 15_000 })
  await fileInput.setInputFiles(fixturePath(filename))
}

/** Upload multiple images at once. */
export async function uploadMultipleImages(
  page: Page,
  filenames: string[] = ['test-image.jpg', 'test-image-2.jpg']
) {
  const fileInput = mediaInput(page)
  await fileInput.waitFor({ state: 'attached', timeout: 15_000 })
  await fileInput.setInputFiles(filenames.map(f => fixturePath(f)))
}

/** Upload the deterministic three-second H.264/AAC fixture. */
export async function uploadVideo(page: Page, filename = 'test-video.mp4') {
  const input = mediaInput(page)
  await input.waitFor({ state: 'attached', timeout: 15_000 })
  await input.setInputFiles(fixturePath(filename))
  await page.getByText('3s • 640×360').waitFor({ state: 'visible', timeout: 15_000 })
}

/** Wait for the editor to be fully loaded after image upload. */
export async function waitForEditor(page: Page) {
  // Wait for loading overlay to disappear
  const loadingOverlay = page.locator('[aria-label="Loading image"]')
  await loadingOverlay.waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {
    // May already be gone if load was fast
  })
  // Wait for the editor preview, not recipe/thumbnail canvases whose DOM order
  // and visibility change across responsive layouts.
  await page.locator('canvas[aria-label="Preview"]').waitFor({ state: 'visible', timeout: 15_000 })
}

/** Select a recipe by clicking the first visible recipe card in the desktop side panel. */
export async function selectFirstRecipe(page: Page) {
  // Scope to the desktop aside panel to avoid mobile hidden duplicates
  const card = page.locator('aside [aria-label^="Apply preset"]').first()
  await card.click()
  // Wait for card to become selected
  await page.locator('aside [aria-label*=", selected"]').first().waitFor({ state: 'visible', timeout: 10_000 })
}
