import { ProcessingOptions, RecipeSettings } from './types'
import { createCurveLUT, applyCurve } from './curves'
import {
  applyColorBalance,
  applySaturation,
  applyWhiteBalanceShift,
  applyToneAdjustment
} from './color'
import { applyGrain, grainEffectToStrength, grainSizeToNumber } from './grain'
import {
  applyClarity,
  applySharpness,
  applyColorChrome,
  applyColorChromeFXBlue
} from './effects'

/**
 * Главный процессор изображений
 * Применяет симуляцию и все настройки рецепта к изображению
 */
export class ImageProcessor {
  /**
   * Применяет обработку к ImageData
   */
  static process(
    imageData: ImageData,
    options: ProcessingOptions
  ): ImageData {
    // Создаём копию ImageData для обработки
    const processed = new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height
    )

    const { simulation, settings } = options

    // 1. Применяем тональную кривую базовой симуляции
    if (simulation.curve) {
      const curveLUT = createCurveLUT(simulation.curve)
      applyCurve(processed, curveLUT, 'rgb')
    }

    // 2. Применяем цветовой баланс симуляции
    if (simulation.colorBalance) {
      applyColorBalance(processed, simulation.colorBalance)
    }

    // 3. Применяем базовую насыщенность симуляции
    if (simulation.saturation !== undefined) {
      applySaturation(processed, simulation.saturation)
    }

    // 4. Применяем настройки рецепта (если есть)
    if (settings) {
      this.applyRecipeSettings(processed, settings)
    }

    return processed
  }

  /**
   * Применяет настройки рецепта
   */
  private static applyRecipeSettings(
    imageData: ImageData,
    settings: RecipeSettings
  ): void {
    // Highlight/Shadow tone
    if (settings.highlight !== undefined || settings.shadow !== undefined) {
      applyToneAdjustment(
        imageData,
        settings.highlight ?? 0,
        settings.shadow ?? 0
      )
    }

    // Color (дополнительная насыщенность)
    if (settings.color !== undefined) {
      const saturationFactor = settings.color / 10 // Нормализуем -4..+4 к -0.4..+0.4
      applySaturation(imageData, saturationFactor)
    }

    // White Balance Shift
    if (settings.wbShiftRed !== undefined || settings.wbShiftBlue !== undefined) {
      applyWhiteBalanceShift(
        imageData,
        settings.wbShiftRed ?? 0,
        settings.wbShiftBlue ?? 0
      )
    }

    // Color Chrome Effect
    if (settings.colorChromeEffect) {
      applyColorChrome(imageData, settings.colorChromeEffect)
    }

    // Color Chrome FX Blue
    if (settings.colorChromeFXBlue) {
      applyColorChromeFXBlue(imageData, settings.colorChromeFXBlue)
    }

    // Clarity
    if (settings.clarity !== undefined && settings.clarity !== 0) {
      applyClarity(imageData, settings.clarity)
    }

    // Sharpness
    if (settings.sharpness !== undefined && settings.sharpness !== 0) {
      applySharpness(imageData, settings.sharpness)
    }

    // Grain
    if (settings.grainEffect && settings.grainEffect !== 'off') {
      const strength = grainEffectToStrength(settings.grainEffect)
      const size = settings.grainSize ? grainSizeToNumber(settings.grainSize) : 1.0
      applyGrain(imageData, strength, size)
    }
  }

  /**
   * Загружает изображение из File в ImageData
   */
  static async loadImage(file: File): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)

      img.onload = () => {
        URL.revokeObjectURL(url)

        // Создаём canvas для получения ImageData
        const canvas = document.createElement('canvas')
        canvas.width = img.width
        canvas.height = img.height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Failed to get canvas context'))
          return
        }

        ctx.drawImage(img, 0, 0)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        resolve(imageData)
      }

      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Failed to load image'))
      }

      img.src = url
    })
  }

  /**
   * Создаёт уменьшенную копию изображения для превью
   */
  static async createThumbnail(
    file: File,
    maxSize: number
  ): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)

      img.onload = () => {
        URL.revokeObjectURL(url)

        // Вычисляем новые размеры
        let width = img.width
        let height = img.height

        if (width > height && width > maxSize) {
          height = (height * maxSize) / width
          width = maxSize
        } else if (height > maxSize) {
          width = (width * maxSize) / height
          height = maxSize
        }

        // Создаём canvas с новыми размерами
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Failed to get canvas context'))
          return
        }

        ctx.drawImage(img, 0, 0, width, height)
        const imageData = ctx.getImageData(0, 0, width, height)
        resolve(imageData)
      }

      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Failed to load image'))
      }

      img.src = url
    })
  }

  /**
   * Добавляет водяной знак на изображение
   */
  static addWatermark(
    imageData: ImageData,
    text: string
  ): ImageData {
    const canvas = document.createElement('canvas')
    canvas.width = imageData.width
    canvas.height = imageData.height

    const ctx = canvas.getContext('2d')
    if (!ctx) return imageData

    // Рисуем изображение
    ctx.putImageData(imageData, 0, 0)

    // Настройки текста - 1.5% от меньшей стороны изображения
    const shortSide = Math.min(imageData.width, imageData.height)
    const fontSize = Math.max(12, Math.round(shortSide * 0.015))
    const bottomOffset = Math.round(shortSide * 0.015)

    ctx.font = `500 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
    ctx.textBaseline = 'bottom'

    // Белый текст с прозрачностью по центру
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.textAlign = 'center'
    ctx.fillText(text, imageData.width / 2, imageData.height - bottomOffset)

    return ctx.getImageData(0, 0, canvas.width, canvas.height)
  }

  /**
   * Конвертирует ImageData в Blob для скачивания
   */
  static imageDataToBlob(
    imageData: ImageData,
    quality: number = 0.95
  ): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas')
      canvas.width = imageData.width
      canvas.height = imageData.height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Failed to get canvas context'))
        return
      }

      ctx.putImageData(imageData, 0, 0)

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('Failed to create blob'))
          }
        },
        'image/jpeg',
        quality
      )
    })
  }
}

