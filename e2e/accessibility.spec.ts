import { clickEditorAction } from './helpers/editor-controls'
import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { test, expect } from './helpers/fixtures'
import { openCropSession } from './helpers/editor-controls'
import { waitForEditor } from './helpers/upload'

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

async function expectNoAccessibilityViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(WCAG_TAGS)
    .analyze()

  expect(results.violations).toEqual([])
}

test.describe('Accessibility', () => {
  test('playable demo has no detectable WCAG A/AA violations', async ({ page, landingPage }) => {
    await waitForEditor(page)
    await expectNoAccessibilityViolations(page)
  })

  test('photo editor has no detectable WCAG A/AA violations', async ({ page, editorPage }) => {
    await expectNoAccessibilityViolations(page)
  })

  test('Help dialog has no detectable WCAG A/AA violations', async ({ page, editorPage }) => {
    await clickEditorAction(page, 'Help')
    await expect(page.getByRole('dialog')).toBeVisible()
    await expectNoAccessibilityViolations(page)
  })

  test('Crop inspector has no detectable WCAG A/AA violations', async ({ page, editorPage }) => {
    await openCropSession(page)
    await expect(page.getByRole('slider', { name: 'Crop angle' })).toBeVisible()
    await expectNoAccessibilityViolations(page)
  })
})
