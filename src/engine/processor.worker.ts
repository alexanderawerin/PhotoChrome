/**
 * Web Worker для асинхронной CPU-обработки изображений.
 * Выполняется в отдельном потоке — не блокирует UI.
 *
 * Используется для полноразмерного экспорта через ImageProcessor.processAsync().
 */

import type { ProcessingOptions, RecipeSettings } from './types'
import type { HaldCLUT } from './haldclut'
import { applyHaldCLUT } from './haldclut'
import { createCurveLUT, applyCurve } from './curves'
import {
  applyColorBalance,
  applySaturation,
  applyWhiteBalanceShift,
  applyToneAdjustment,
  applyDynamicRange,
  applyWhiteBalancePreset,
} from './color'
import { applyGrain, grainEffectToStrength, grainSizeToNumber } from './grain'
import { applyClarity, applySharpness, applyColorChrome, applyColorChromeFXBlue } from './effects'

interface WorkerRequest {
  requestId: string
  buffer: ArrayBuffer
  width: number
  height: number
  options: ProcessingOptions
  // HaldCLUT data (transferred from main thread)
  lutData?: ArrayBuffer
  lutWidth?: number
  lutLevel?: number
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

function processData(imageData: ImageData, options: ProcessingOptions, lut: HaldCLUT | null): ImageData {
  const { simulation, settings } = options

  const processed = new ImageData(
    new Uint8ClampedArray(imageData.data),
    imageData.width,
    imageData.height
  )

  // Pre-process: Dynamic Range и White Balance Preset
  if (settings?.dynamicRange && settings.dynamicRange !== 'DR100') {
    applyDynamicRange(processed, settings.dynamicRange)
  }
  if (settings?.whiteBalance && settings.whiteBalance !== 'auto') {
    applyWhiteBalancePreset(processed, settings.whiteBalance)
  }

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
  const { requestId, buffer, width, height, options, lutData, lutWidth, lutLevel } = e.data
  const imageData = new ImageData(new Uint8ClampedArray(buffer), width, height)

  // Reconstruct HaldCLUT from transferred data
  let lut: HaldCLUT | null = null
  if (lutData && lutWidth && lutLevel) {
    lut = {
      level: lutLevel,
      gridSize: lutLevel * lutLevel,
      width: lutWidth,
      data: new Uint8ClampedArray(lutData),
    }
  }

  const result = processData(imageData, options, lut)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(self as any).postMessage(
    { requestId, buffer: result.data.buffer, width: result.width, height: result.height },
    [result.data.buffer]
  )
})
