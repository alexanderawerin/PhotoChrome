import { expect, type Page } from '@playwright/test'

export const editorControls = (page: Page) => page.getByRole('complementary', { name: 'Editor controls', exact: true })
export const editorModes = (page: Page) => page.getByRole('navigation', { name: 'Editor modes', exact: true })
export const editorActions = (page: Page) => page.getByRole('toolbar', { name: 'Editor actions', exact: true })
const cropSettings = (page: Page) => editorControls(page).getByRole('region', { name: 'Crop settings', exact: true })

export async function openCropSession(page: Page): Promise<void> {
  await editorModes(page).getByRole('button', { name: 'Crop', exact: true }).click()
  await editorControls(page).getByRole('group', { name: 'Crop tools', exact: true })
    .getByRole('button', { name: 'Open crop session', exact: true }).click()
  await expect(cropSettings(page)).toBeVisible()
}

/** Reveal relocated secondary actions without depending on responsive DOM order. */
export async function clickEditorAction(page: Page, name: string | RegExp): Promise<void> {
  const action = page.getByRole('button', { name, exact: typeof name === 'string' })
  if (!await action.isVisible()) await page.getByRole('button', { name: 'More editor actions', exact: true }).click()
  await action.click()
}

export async function openImageChooser(page: Page): Promise<void> {
  const chooser = page.getByRole('button', { name: 'Choose image', exact: true })
  if (await chooser.count() && !await page.getByRole('tablist', { name: 'Image thumbnails', exact: true }).isVisible()) await chooser.click()
}

export async function chooseImage(page: Page, name: string): Promise<void> {
  await openImageChooser(page)
  await page.getByRole('tab', { name, exact: true }).click()
}
