import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test, expect } from './helpers/fixtures'
import { selectBaseFilm, uploadImage, uploadVideo, waitForEditor } from './helpers/upload'

const films = [
  ['provia', 'Provia'], ['velvia', 'Velvia'], ['astia', 'Astia'], ['pro-400h', 'Pro 400H'],
  ['superia', 'Superia'], ['acros', 'Acros'], ['neopan', 'Neopan'], ['eterna', 'Eterna'],
  ['classic-chrome', 'Classic Chrome'], ['classic-neg', 'Classic Neg'],
] as const
const recipesDirectory = fileURLToPath(new URL('../src/presets/recipes/', import.meta.url))

test('every retained recipe is available only inside its film Advanced catalog', async ({ page, editorPage }) => {
  test.setTimeout(60_000)
  const records: { id: string; name: string; filmSimulation: string }[] = []
  for (const file of await readdir(recipesDirectory)) {
    if (file.endsWith('.json')) records.push(JSON.parse(await readFile(path.join(recipesDirectory, file), 'utf8')))
  }
  expect(records).toHaveLength(100)
  expect(new Set(records.map(recipe => recipe.id)).size).toBe(100)
  const seen = new Set<string>()
  for (const [id, name] of films) {
    await selectBaseFilm(page, name)
    await page.getByRole('button', { name: 'Open Advanced settings', exact: true }).click()
    const panel = page.getByRole('region', { name: 'Advanced settings', exact: true })
    const expected = records.filter(recipe => recipe.filmSimulation === id)
    const choices = panel.getByRole('button', { name: /^Apply preset / })
    await expect(choices).toHaveCount(expected.length)
    const labels = await choices.evaluateAll(buttons => buttons.map(button => button.getAttribute('aria-label')))
    expect(labels.sort()).toEqual(expected.map(recipe => `Apply preset ${recipe.name}`).sort())
    for (const recipe of expected) seen.add(recipe.id)
    await expect(panel.getByRole('button', { name: /Random|Randomize|Smart Picks|Editor's Choice/i })).toHaveCount(0)
    await panel.getByRole('button', { name: 'Cancel', exact: true }).click()
  }
  expect(seen.size).toBe(100)
})

for (const media of ['photo', 'video'] as const) {
  test(`${media} preserves saved favorite recipe IDs and scopes them to their film`, async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('photochrome_favorites', JSON.stringify(['provia-daylight', 'classic-color'])))
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    if (media === 'photo') { await uploadImage(page); await waitForEditor(page) }
    else await uploadVideo(page, 'test-video-silent.mp4')
    await selectBaseFilm(page)
    await page.getByRole('button', { name: /^(Open Advanced settings|Advanced settings)$/ }).click()
    const panel = page.getByRole('region', { name: 'Advanced settings', exact: true })
    const card = panel.locator('[data-recipe-card]').filter({ has: page.getByRole('button', { name: 'Apply preset Provia Daylight', exact: true }) })
    await expect(card.getByRole('button', { name: 'Remove from favorites', exact: true })).toHaveAttribute('aria-pressed', 'true')
    const labels = await panel.getByRole('button', { name: /^Apply preset / }).evaluateAll(buttons => buttons.map(button => button.getAttribute('aria-label')))
    expect(labels[0]).toBe('Apply preset Provia Daylight')
    expect(new Set(labels).size).toBe(8)
    await expect(panel.getByRole('button', { name: /^Apply preset Classic Color/ })).toHaveCount(0)
    await panel.getByRole('button', { name: 'Cancel', exact: true }).click()
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('photochrome_favorites') || '[]'))).toEqual(['provia-daylight', 'classic-color'])
  })
}
