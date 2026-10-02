import { expect, type Page } from '@playwright/test'

export const editorControls = (page: Page) => page.getByRole('complementary', { name: 'Editor controls', exact: true })
export const editorModes = (page: Page) => editorControls(page).getByRole('navigation', { name: 'Editor modes', exact: true })
export const editorActions = (page: Page) => editorControls(page).getByRole('toolbar', { name: 'Editor actions', exact: true })
const cropSettings = (page: Page) => editorControls(page).getByRole('region', { name: 'Crop settings', exact: true })

export async function openCropSession(page: Page): Promise<void> {
  await editorModes(page).getByRole('button', { name: 'Crop', exact: true }).click()
  await editorControls(page).getByRole('group', { name: 'Crop tools', exact: true })
    .getByRole('button', { name: 'Open crop session', exact: true }).click()
  await expect(cropSettings(page)).toBeVisible()
}
