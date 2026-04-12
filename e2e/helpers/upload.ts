import { Page } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures')

export function fixturePath(filename: string): string {
  return path.join(FIXTURES_DIR, filename)
}

/** Upload a single image via the hidden file input on LandingScreen. */
export async function uploadImage(page: Page, filename = 'test-image.jpg') {
  const fileInput = page.locator('input#media-upload')
  await fileInput.setInputFiles(fixturePath(filename))
}

/** Upload multiple images at once. */
export async function uploadMultipleImages(
  page: Page,
  filenames: string[] = ['test-image.jpg', 'test-image-2.jpg']
) {
  const fileInput = page.locator('input#media-upload')
  await fileInput.setInputFiles(filenames.map(f => fixturePath(f)))
}

/** Wait for the editor to be fully loaded after image upload. */
export async function waitForEditor(page: Page) {
  // Wait for loading overlay to disappear
  const loadingOverlay = page.locator('[aria-label="Loading image"]')
  await loadingOverlay.waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {
    // May already be gone if load was fast
  })
  // Wait for canvas to appear
  await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 15_000 })
}

/** Select a recipe by clicking the first visible recipe card in the desktop side panel. */
export async function selectFirstRecipe(page: Page) {
  // Scope to the desktop aside panel to avoid mobile hidden duplicates
  const card = page.locator('aside [aria-label^="Apply preset"]').first()
  await card.click()
  // Wait for card to become selected
  await page.locator('aside [aria-label*=", selected"]').first().waitFor({ state: 'visible', timeout: 10_000 })
}
