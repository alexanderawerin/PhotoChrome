import { test as base } from '@playwright/test'
import { uploadImage, uploadMultipleImages, waitForEditor } from './upload'

type AppFixtures = {
  /** Page navigated to landing screen */
  landingPage: ReturnType<typeof base.extend> extends never ? never : never
  /** Page with a single image loaded in editor */
  editorPage: ReturnType<typeof base.extend> extends never ? never : never
  /** Page with two images loaded in editor */
  multiImageEditorPage: ReturnType<typeof base.extend> extends never ? never : never
}

export const test = base.extend<{
  landingPage: void
  editorPage: void
  multiImageEditorPage: void
}>({
  landingPage: [async ({ page }, use) => {
    await page.goto('/')
    await use()
  }, { auto: false }],

  editorPage: [async ({ page }, use) => {
    await page.goto('/')
    await uploadImage(page)
    await waitForEditor(page)
    await use()
  }, { auto: false }],

  multiImageEditorPage: [async ({ page }, use) => {
    await page.goto('/')
    await uploadMultipleImages(page)
    await waitForEditor(page)
    await use()
  }, { auto: false }],
})

export { expect } from '@playwright/test'
