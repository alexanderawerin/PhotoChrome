import type { RecipeSettings } from './types'
import {
  applyDynamicRange,
  applyWhiteBalanceKelvin,
  applyWhiteBalancePreset,
} from './color'

export function needsPreprocess(settings?: RecipeSettings): boolean {
  return !!(
    (settings?.dynamicRange && settings.dynamicRange !== 'DR100') ||
    (settings?.whiteBalance && settings.whiteBalance !== 'auto') ||
    settings?.whiteBalanceKelvin !== undefined
  )
}

export function applyPreprocessSettings(
  imageData: ImageData,
  settings?: RecipeSettings
): void {
  if (settings?.dynamicRange && settings.dynamicRange !== 'DR100') {
    applyDynamicRange(imageData, settings.dynamicRange)
  }
  if (settings?.whiteBalance && settings.whiteBalance !== 'auto') {
    applyWhiteBalancePreset(imageData, settings.whiteBalance)
  }
  if (settings?.whiteBalanceKelvin !== undefined) {
    applyWhiteBalanceKelvin(imageData, settings.whiteBalanceKelvin)
  }
}
