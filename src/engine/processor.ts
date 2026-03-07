import { ProcessingOptions, RecipeSettings } from './types'
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
import {
  applyClarity,
  applySharpness,
  applyColorChrome,
  applyColorChromeFXBlue
} from './effects'
import { getPhotoWebGLProcessor } from './webgl/processor'

// Maximum image dimension for WebGL processing (texture size limit)
const WEBGL_MAX_DIMENSION = 4096

/**
 * Информация о рецепте для EXIF-метаданных при экспорте
 */
export interface ExifInfo {
  recipeName?: string
  recipeId?: string
  settings?: RecipeSettings
}

/**
 * Главный процессор изображений.
 * Применяет симуляцию и все настройки рецепта к изображению.
 *
 * Pipeline:
 * 1. Pre-process: Dynamic Range, White Balance Preset (CPU, не в GL shader)
 * 2. Main processing: curve → color balance → saturation → recipe settings
 *    - WebGL path: всё остальное через GPU (быстрее)
 *    - CPU fallback: если WebGL недоступен или изображение слишком большое
 */
export class ImageProcessor {
  // Worker singleton for async CPU processing
  private static processingWorker: Worker | null = null
  private static workerCallbacks: Map<string, (data: ImageData) => void> = new Map()
  private static workerRejects: Map<string, (err: Error) => void> = new Map()

  /**
   * Применяет обработку к ImageData.
   * Сначала пробует WebGL (GPU), при недоступности — CPU.
   */
  static process(
    imageData: ImageData,
    options: ProcessingOptions
  ): ImageData {
    const { settings } = options

    // 1. Pre-process: Dynamic Range и White Balance Preset
    //    Эти эффекты не реализованы в GL shader, применяем на CPU перед основным pipeline.
    let inputData = imageData
    const needsPreprocess =
      (settings?.dynamicRange && settings.dynamicRange !== 'DR100') ||
      (settings?.whiteBalance && settings.whiteBalance !== 'auto')

    if (needsPreprocess) {
      inputData = new ImageData(
        new Uint8ClampedArray(imageData.data),
        imageData.width,
        imageData.height
      )
      if (settings?.dynamicRange && settings.dynamicRange !== 'DR100') {
        applyDynamicRange(inputData, settings.dynamicRange)
      }
      if (settings?.whiteBalance && settings.whiteBalance !== 'auto') {
        applyWhiteBalancePreset(inputData, settings.whiteBalance)
      }
    }

    // 2. Пробуем WebGL для основного pipeline
    const webglResult = this.processWithWebGL(inputData, options)
    if (webglResult) return webglResult

    // 3. CPU fallback
    return this.processCPU(inputData, options)
  }

  /**
   * Обрабатывает изображение через WebGL (GPU).
   * Возвращает null если WebGL недоступен, ошибка или изображение слишком большое.
   */
  private static processWithWebGL(
    imageData: ImageData,
    options: ProcessingOptions
  ): ImageData | null {
    if (
      imageData.width > WEBGL_MAX_DIMENSION ||
      imageData.height > WEBGL_MAX_DIMENSION
    ) {
      return null
    }

    try {
      const processor = getPhotoWebGLProcessor()
      processor.init(imageData.width, imageData.height)
      const resultCanvas = processor.processFrame(imageData, options, 0)
      const ctx = resultCanvas.getContext('2d')
      if (!ctx) return null
      return ctx.getImageData(0, 0, resultCanvas.width, resultCanvas.height)
    } catch {
      return null
    }
  }

  /**
   * Полный CPU pipeline (fallback когда WebGL недоступен)
   */
  private static processCPU(
    imageData: ImageData,
    options: ProcessingOptions
  ): ImageData {
    const processed = new ImageData(
      new Uint8ClampedArray(imageData.data),
      imageData.width,
      imageData.height
    )

    const { simulation, settings } = options

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
    if (settings) {
      this.applyRecipeSettings(processed, settings)
    }

    return processed
  }

  /**
   * Асинхронная обработка через Web Worker.
   * Не блокирует UI — идеально для полноразмерного экспорта.
   */
  static processAsync(
    imageData: ImageData,
    options: ProcessingOptions
  ): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      try {
        const worker = this.getProcessingWorker()
        const requestId = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`

        this.workerCallbacks.set(requestId, resolve)
        this.workerRejects.set(requestId, reject)

        const buffer = imageData.data.buffer.slice(0)
        worker.postMessage(
          { requestId, buffer, width: imageData.width, height: imageData.height, options },
          [buffer]
        )
      } catch (err) {
        reject(err)
      }
    })
  }

  private static getProcessingWorker(): Worker {
    if (!this.processingWorker) {
      this.processingWorker = new Worker(
        new URL('./processor.worker.ts', import.meta.url),
        { type: 'module' }
      )

      this.processingWorker.addEventListener('message', (e: MessageEvent) => {
        const { requestId, buffer, width, height } = e.data
        const resolve = this.workerCallbacks.get(requestId)
        if (resolve) {
          this.workerCallbacks.delete(requestId)
          this.workerRejects.delete(requestId)
          resolve(new ImageData(new Uint8ClampedArray(buffer), width, height))
        }
      })

      this.processingWorker.addEventListener('error', (e: ErrorEvent) => {
        console.error('Processing worker error:', e.message)
        this.workerRejects.forEach(reject => reject(new Error(e.message)))
        this.workerCallbacks.clear()
        this.workerRejects.clear()
        this.processingWorker = null
      })
    }
    return this.processingWorker
  }

  /**
   * Применяет настройки рецепта.
   * Примечание: dynamicRange и whiteBalance уже обработаны в process() как pre-step.
   */
  private static applyRecipeSettings(
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

  /**
   * Загружает изображение из File в ImageData.
   * Если передан maxSize — масштабирует так чтобы длинная сторона не превышала maxSize.
   */
  private static async fileToImageData(file: File, maxSize?: number): Promise<ImageData> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)

      img.onload = () => {
        URL.revokeObjectURL(url)

        let width = img.width
        let height = img.height

        if (maxSize !== undefined) {
          if (width > height && width > maxSize) {
            height = (height * maxSize) / width
            width = maxSize
          } else if (height > maxSize) {
            width = (width * maxSize) / height
            height = maxSize
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Failed to get canvas context'))
          return
        }

        ctx.drawImage(img, 0, 0, width, height)
        resolve(ctx.getImageData(0, 0, width, height))
      }

      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Failed to load image'))
      }

      img.src = url
    })
  }

  /**
   * Загружает изображение из File в ImageData
   */
  static loadImage(file: File): Promise<ImageData> {
    return this.fileToImageData(file)
  }

  /**
   * Создаёт уменьшенную копию изображения для превью
   */
  static createThumbnail(file: File, maxSize: number): Promise<ImageData> {
    return this.fileToImageData(file, maxSize)
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

    ctx.putImageData(imageData, 0, 0)

    const shortSide = Math.min(imageData.width, imageData.height)
    const fontSize = Math.max(12, Math.round(shortSide * 0.015))
    const bottomOffset = Math.round(shortSide * 0.015)

    ctx.font = `500 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
    ctx.textBaseline = 'bottom'
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.textAlign = 'center'
    ctx.fillText(text, imageData.width / 2, imageData.height - bottomOffset)

    return ctx.getImageData(0, 0, canvas.width, canvas.height)
  }

  /**
   * Конвертирует ImageData в Blob для скачивания.
   * Если передан exifInfo — записывает метаданные рецепта в EXIF.
   */
  static async imageDataToBlob(
    imageData: ImageData,
    quality: number = 0.95,
    exifInfo?: ExifInfo
  ): Promise<Blob> {
    const canvas = document.createElement('canvas')
    canvas.width = imageData.width
    canvas.height = imageData.height

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Failed to get canvas context')

    ctx.putImageData(imageData, 0, 0)

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => b ? resolve(b) : reject(new Error('Failed to create blob')),
        'image/jpeg',
        quality
      )
    })

    if (!exifInfo) return blob

    try {
      const piexif = await import('piexifjs')
      const binaryStr = await this.blobToBinaryString(blob)

      const comment = JSON.stringify({
        app: 'Photochrome',
        recipe: exifInfo.recipeName,
        id: exifInfo.recipeId,
        settings: exifInfo.settings,
      })

      const exifObj = {
        '0th': {
          [piexif.ImageIFD.Software]: 'Photochrome',
          [piexif.ImageIFD.ImageDescription]: exifInfo.recipeName ?? '',
        },
        Exif: {
          [piexif.ExifIFD.UserComment]: comment,
        },
      }

      const exifBytes = piexif.dump(exifObj)
      const inserted = piexif.insert(exifBytes, binaryStr)
      return this.binaryStringToBlob(inserted, 'image/jpeg')
    } catch (err) {
      console.warn('Failed to write EXIF metadata:', err)
      return blob
    }
  }

  private static blobToBinaryString(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target!.result as string)
      reader.onerror = reject
      reader.readAsBinaryString(blob)
    })
  }

  private static binaryStringToBlob(binaryStr: string, mimeType: string): Blob {
    const bytes = new Uint8Array(binaryStr.length)
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i)
    }
    return new Blob([bytes], { type: mimeType })
  }
}
