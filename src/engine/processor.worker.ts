/**
 * Web Worker для асинхронной CPU-обработки изображений.
 * Выполняется в отдельном потоке — не блокирует UI.
 *
 * Используется для полноразмерного экспорта через ImageProcessor.processAsync().
 */

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
import { applyClarity, applySharpness, applyColorChrome, applyColorChromeFXBlue } from './effects'

interface WorkerRequest {
  requestId: string
  buffer: ArrayBuffer
  width: number
  height: number
  plan: ProcessingPlan
}

function applyRecipeSettings(imageData: ImageData, settings: RecipeSettings): void {
  if (settings.highlight !== undefined || settings.shadow !== undefined) {
    applyToneAdjustment(imageData, settings.highlight ?? 0, settings.shadow ?? 0)
  }
  if (settings.color !== undefined) {
    applySaturation(imageData, settings.color / 10)
  }
  if (settings.wbShiftRed !== undefined || settings.wbShiftBlue !== undefined) {
    applyWhiteBalanceShift(imageData, settings.wbShiftRed ?? 0, settings.wbShiftBlue ?? 0)
  }
  if (settings.colorChromeEffect) applyColorChrome(imageData, settings.colorChromeEffect)
  if (settings.colorChromeFXBlue) applyColorChromeFXBlue(imageData, settings.colorChromeFXBlue)
  if (settings.clarity !== undefined && settings.clarity !== 0) applyClarity(imageData, settings.clarity)
  if (settings.sharpness !== undefined && settings.sharpness !== 0) applySharpness(imageData, settings.sharpness)
  if (settings.grainEffect && settings.grainEffect !== 'off') {
    const strength = grainEffectToStrength(settings.grainEffect)
    const size = settings.grainSize ? grainSizeToNumber(settings.grainSize) : 1.0
    applyGrain(imageData, strength, size)
  }
}

function processData(imageData: ImageData, plan: ProcessingPlan): ImageData {
  const { simulation, settings, lut } = plan

  const processed = new ImageData(
    new Uint8ClampedArray(imageData.data),
    imageData.width,
    imageData.height
  )

  applyPreprocessSettings(processed, settings)

  // Simulation: HaldCLUT or curve-based
  if (lut) {
    applyHaldCLUT(processed, lut)
  } else {
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

  // Recipe settings
  if (settings) {
    applyRecipeSettings(processed, settings)
  }

  return processed
}

self.addEventListener('message', (e: MessageEvent<WorkerRequest>) => {
  const { requestId, buffer, width, height, plan } = e.data
  const imageData = new ImageData(new Uint8ClampedArray(buffer), width, height)
  const result = processData(imageData, plan)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(self as any).postMessage(
    { requestId, buffer: result.data.buffer, width: result.width, height: result.height },
    [result.data.buffer]
  )
})
