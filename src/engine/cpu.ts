import type { ProcessingPlan, RecipeSettings } from './types'
import { applyHaldCLUT } from './haldclut'
import { createCurveLUT, applyCurve } from './curves'
import {
  applyColorBalance,
  applySaturation,
  applyWhiteBalanceShift,
  applyToneAdjustment,
} from './color'
import { applyPreprocessSettings } from './preprocess'
import { applyGrain, grainEffectToStrength, grainSizeToNumber } from './grain'
import {
  applyClarity,
  applySharpness,
  applyColorChrome,
  applyColorChromeFXBlue
} from './effects'
import { assertProcessingResourcesReady, assertProcessingTarget } from './processing-plan'

/** Shared deterministic CPU pipeline for direct and worker processing. */
export function processOnCPU(imageData: ImageData, plan: ProcessingPlan): ImageData {
  assertProcessingTarget(plan, imageData.width, imageData.height)
  if (plan.colorMode !== 'original') assertProcessingResourcesReady(plan)
  const processed = new ImageData(
    new Uint8ClampedArray(imageData.data),
    imageData.width,
    imageData.height
  )

  if (plan.colorMode === 'original') return processed

  const { simulation, settings, lut } = plan

  applyPreprocessSettings(processed, settings)

  // HaldCLUT path: single 3D LUT lookup replaces curve + colorBalance + saturation
  if (lut) {
    applyHaldCLUT(processed, lut)
  } else {
    // Fallback: curve-based approach
    if (simulation.curve) {
      const curveLUT = createCurveLUT(simulation.curve)
      applyCurve(processed, curveLUT, 'rgb')
    }
    if (simulation.colorBalance) {
      applyColorBalance(processed, simulation.colorBalance)
    }
    if (simulation.saturation !== undefined) {
      applySaturation(processed, simulation.saturation)
    }
  }
  if (settings) {
    applyRecipeSettings(processed, settings)
  }

  return processed
}

function applyRecipeSettings(
  imageData: ImageData,
  settings: RecipeSettings
): void {
  if (settings.highlight !== undefined || settings.shadow !== undefined) {
    applyToneAdjustment(
      imageData,
      settings.highlight ?? 0,
      settings.shadow ?? 0
    )
  }

  if (settings.color !== undefined) {
    applySaturation(imageData, settings.color / 10)
  }

  if (settings.wbShiftRed !== undefined || settings.wbShiftBlue !== undefined) {
    applyWhiteBalanceShift(
      imageData,
      settings.wbShiftRed ?? 0,
      settings.wbShiftBlue ?? 0
    )
  }

  if (settings.colorChromeEffect) {
    applyColorChrome(imageData, settings.colorChromeEffect)
  }
  if (settings.colorChromeFXBlue) {
    applyColorChromeFXBlue(imageData, settings.colorChromeFXBlue)
  }

  if (settings.clarity !== undefined && settings.clarity !== 0) {
    applyClarity(imageData, settings.clarity)
  }
  if (settings.sharpness !== undefined && settings.sharpness !== 0) {
    applySharpness(imageData, settings.sharpness)
  }

  if (settings.grainEffect && settings.grainEffect !== 'off') {
    const strength = grainEffectToStrength(settings.grainEffect)
    const size = settings.grainSize ? grainSizeToNumber(settings.grainSize) : 1.0
    applyGrain(imageData, strength, size)
  }
}
