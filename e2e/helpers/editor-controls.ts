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

/** Use the stage arrows where present; keyboard navigation remains available on touch. */
export async function navigateImage(page: Page, direction: 'next' | 'previous'): Promise<void> {
  const button = page.getByRole('button', { name: direction === 'next' ? 'Next image' : 'Previous image', exact: true })
  if (await button.isVisible()) await button.click()
  else {
    await editorModes(page).getByRole('button', { name: 'Films', exact: true }).focus()
    await page.keyboard.press(direction === 'next' ? 'ArrowRight' : 'ArrowLeft')
  }
}
