import { test as base } from '@playwright/test'
import { uploadImage, uploadMultipleImages, waitForEditor } from './upload'

export const test = base.extend<{
  landingPage: void
  editorPage: void
  multiImageEditorPage: void
}>({
  landingPage: [async ({ page }, use) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await use()
  }, { auto: false }],

  editorPage: [async ({ page }, use) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await uploadImage(page)
    await waitForEditor(page)
    await use()
  }, { auto: false }],

  multiImageEditorPage: [async ({ page }, use) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await uploadMultipleImages(page)
    await waitForEditor(page)
    await use()
  }, { auto: false }],
})

export { expect } from '@playwright/test'
