import { expect, Page } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const FIXTURES_DIR = path.join(__dirname, '..', 'fixtures')

export function fixturePath(filename: string): string {
  return path.join(FIXTURES_DIR, filename)
}

function mediaInput(page: Page) {
  return page.getByLabel('Choose photos or video to edit', { exact: true })
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
  await page.locator('canvas[aria-label="Video preview"]').waitFor({ state: 'visible', timeout: 15_000 })
}

/** Wait for the editor to be fully loaded after image upload. */
export async function waitForEditor(page: Page) {
  // Wait for loading overlay to disappear
  const loadingOverlay = page.locator('[aria-label="Loading image"]')
  await loadingOverlay.waitFor({ state: 'hidden', timeout: 15_000 })
  // Wait for the editor preview, not recipe/thumbnail canvases whose DOM order
  // and visibility change across responsive layouts.
  await page.locator('canvas[aria-label="Preview"]').waitFor({ state: 'visible', timeout: 15_000 })
}

/** Select a deterministic neutral base film through the main editor. */
export async function selectBaseFilm(page: Page, name = 'Provia') {
  const film = page.getByRole('button', { name: `Select film ${name}`, exact: true })
  await film.click()
  await expect(film).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('p:visible').filter({ hasText: /^Processing\.\.\.$/ })).toHaveCount(0)
  await expect(page.getByLabel('Applied color', { exact: true })).not.toContainText(/Preparing:|Unavailable:/)
}

/** Choose a detailed recipe in the active film's reversible Advanced draft. */
export async function selectAdvancedRecipe(page: Page, recipeName: string, apply = true) {
  const panel = page.getByRole('region', { name: 'Advanced settings', exact: true })
  if (!await panel.isVisible()) await page.getByRole('navigation', { name: 'Editor modes', exact: true }).getByRole('button', { name: 'Open Advanced settings', exact: true }).click()
  await panel.getByRole('tab', { name: 'Recipes', exact: true }).click()
  const escaped = recipeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  await panel.getByRole('button', { name: new RegExp(`^Apply preset ${escaped}(?:, selected)?$`) }).click()
  await expect(panel.getByRole('button', { name: 'Apply', exact: true })).toBeEnabled()
  if (apply) await panel.getByRole('button', { name: 'Apply', exact: true }).click()
}
