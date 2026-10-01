import { ProcessingPlan, RecipeSettings } from './types'
import { processOnCPU } from './cpu'
import { getPhotoWebGLProcessor } from './webgl/processor'
import { assertProcessingResourcesReady, assertProcessingTarget } from './processing-plan'

// Maximum image dimension for WebGL processing (texture size limit)
const WEBGL_MAX_DIMENSION = 4096
// Minimum dimension to use WebGL — smaller images are faster on CPU
// and avoid GPU contention when rendering many recipe card previews
const WEBGL_MIN_DIMENSION = 512

/**
 * Информация о рецепте для EXIF-метаданных при экспорте
 */
export interface ExifInfo {
  recipeName?: string
  recipeId?: string
  settings?: RecipeSettings
}

export interface ProcessAsyncOptions {
  signal?: AbortSignal
  timeoutMs?: number
}

export class ProcessingTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Image processing timed out after ${timeoutMs} ms`)
    this.name = 'ProcessingTimeoutError'
  }
}

interface QueuedProcessingRequest {
  requestId: string
  imageData: ImageData
  plan: ProcessingPlan
  options: Required<Pick<ProcessAsyncOptions, 'timeoutMs'>> & Pick<ProcessAsyncOptions, 'signal'>
  resolve: (data: ImageData) => void
  reject: (error: Error) => void
  timeoutId?: ReturnType<typeof setTimeout>
  abortHandler?: () => void
}

const DEFAULT_PROCESSING_TIMEOUT_MS = 120_000

function createAbortError(): Error {
  if (typeof DOMException !== 'undefined') {
    return new DOMException('Image processing was cancelled', 'AbortError')
  }
  const error = new Error('Image processing was cancelled')
  error.name = 'AbortError'
  return error
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
  private static registeredWorkerLuts = new Set<string>()
  private static activeWorkerRequest: QueuedProcessingRequest | null = null
  private static workerQueue: QueuedProcessingRequest[] = []

  /**
   * Применяет обработку к ImageData.
   * Сначала пробует WebGL (GPU), при недоступности — CPU.
   */
  static process(
    imageData: ImageData,
    plan: ProcessingPlan
  ): ImageData {
    assertProcessingTarget(plan, imageData.width, imageData.height)
    assertProcessingResourcesReady(plan)
    if (plan.colorMode === 'original') return this.processOnCPU(imageData, plan)
    // 1. HaldCLUT simulations use CPU (reliable trilinear interpolation).
    //    WebGL sampler3D is unstable across browsers — CPU LUT is ~50ms for 1600px thumbnails.
    const { lut } = plan
    if (!lut) {
      // Curve-based simulations can use WebGL (no 3D texture needed)
      const webglResult = this.processWithWebGL(imageData, plan)
      if (webglResult) return webglResult
    }

    // 2. CPU path (HaldCLUT lookup or curve-based fallback)
    return this.processOnCPU(imageData, plan)
  }

  /**
   * Обрабатывает изображение через WebGL (GPU).
   * Возвращает null если WebGL недоступен, ошибка или изображение слишком большое.
   */
  private static processWithWebGL(
    imageData: ImageData,
    plan: ProcessingPlan
  ): ImageData | null {
    if (
      imageData.width > WEBGL_MAX_DIMENSION ||
      imageData.height > WEBGL_MAX_DIMENSION ||
      (imageData.width < WEBGL_MIN_DIMENSION && imageData.height < WEBGL_MIN_DIMENSION)
    ) {
      return null
    }

    try {
      const processor = getPhotoWebGLProcessor()
      processor.init(imageData.width, imageData.height)
      processor.processFrame(imageData, plan, 0)
      return processor.getImageData()
    } catch {
      return null
    }
  }

  /**
   * Полный CPU pipeline (fallback когда WebGL недоступен)
   */
  static processOnCPU(
    imageData: ImageData,
    plan: ProcessingPlan
  ): ImageData {
    assertProcessingTarget(plan, imageData.width, imageData.height)
    assertProcessingResourcesReady(plan)
    return processOnCPU(imageData, plan)
  }

  /**
   * Асинхронная обработка через Web Worker.
   * Не блокирует UI — идеально для полноразмерного экспорта.
   */
  static processAsync(
    imageData: ImageData,
    plan: ProcessingPlan,
    options: ProcessAsyncOptions = {}
  ): Promise<ImageData> {
    assertProcessingTarget(plan, imageData.width, imageData.height)
    assertProcessingResourcesReady(plan)
    const timeoutMs = options.timeoutMs ?? DEFAULT_PROCESSING_TIMEOUT_MS
    if (!Number.isFinite(timeoutMs) || timeoutMs < 0) {
      return Promise.reject(new Error('Processing timeout must be a non-negative finite number'))
    }
    if (options.signal?.aborted) return Promise.reject(createAbortError())

    return new Promise((resolve, reject) => {
      const request: QueuedProcessingRequest = {
        requestId: `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        imageData,
        plan,
        options: { signal: options.signal, timeoutMs },
        resolve,
        reject,
      }

      request.abortHandler = () => this.cancelWorkerRequest(request)
      options.signal?.addEventListener('abort', request.abortHandler, { once: true })
      this.workerQueue.push(request)
      this.startNextWorkerRequest()
    })
  }

  private static startNextWorkerRequest(): void {
    if (this.activeWorkerRequest) return

    const request = this.workerQueue.shift()
    if (!request) return
    if (request.options.signal?.aborted) {
      this.cleanupWorkerRequest(request)
      request.reject(createAbortError())
      this.startNextWorkerRequest()
      return
    }

    this.activeWorkerRequest = request
    try {
      const worker = this.getProcessingWorker()
      this.registerPlanLut(worker, request.plan)

      const buffer = request.imageData.data.buffer.slice(0)
      const workerPlan: ProcessingPlan = request.plan.lut
        ? { ...request.plan, lut: null }
        : request.plan

      request.timeoutId = setTimeout(() => {
        if (this.activeWorkerRequest === request) {
          this.restartWorkerAfterFailure(new ProcessingTimeoutError(request.options.timeoutMs))
        }
      }, request.options.timeoutMs)

      worker.postMessage(
        {
          type: 'process',
          requestId: request.requestId,
          buffer,
          width: request.imageData.width,
          height: request.imageData.height,
          plan: workerPlan,
          lutId: request.plan.lut ? request.plan.simulation.id : undefined,
        },
        [buffer]
      )
    } catch (error) {
      this.restartWorkerAfterFailure(error instanceof Error ? error : new Error(String(error)))
    }
  }

  private static registerPlanLut(worker: Worker, plan: ProcessingPlan): void {
    if (!plan.lut || this.registeredWorkerLuts.has(plan.simulation.id)) return

    const data = new Uint8ClampedArray(plan.lut.data)
    worker.postMessage({
      type: 'register-lut',
      lutId: plan.simulation.id,
      lut: { ...plan.lut, data },
    }, [data.buffer])
    this.registeredWorkerLuts.add(plan.simulation.id)
  }

  private static cancelWorkerRequest(request: QueuedProcessingRequest): void {
    if (this.activeWorkerRequest === request) {
      this.restartWorkerAfterFailure(createAbortError())
      return
    }

    const queueIndex = this.workerQueue.indexOf(request)
    if (queueIndex >= 0) {
      this.workerQueue.splice(queueIndex, 1)
      this.cleanupWorkerRequest(request)
      request.reject(createAbortError())
    }
  }

  private static completeWorkerRequest(request: QueuedProcessingRequest, result: ImageData): void {
    if (this.activeWorkerRequest !== request) return
    this.activeWorkerRequest = null
    this.cleanupWorkerRequest(request)
    request.resolve(result)
    this.startNextWorkerRequest()
  }

  private static rejectWorkerRequest(request: QueuedProcessingRequest, error: Error): void {
    if (this.activeWorkerRequest !== request) return
    this.activeWorkerRequest = null
    this.cleanupWorkerRequest(request)
    request.reject(error)
    this.startNextWorkerRequest()
  }

  private static cleanupWorkerRequest(request: QueuedProcessingRequest): void {
    if (request.timeoutId !== undefined) clearTimeout(request.timeoutId)
    if (request.abortHandler) {
      request.options.signal?.removeEventListener('abort', request.abortHandler)
    }
  }

  private static restartWorkerAfterFailure(error: Error): void {
    const request = this.activeWorkerRequest
    this.activeWorkerRequest = null
    if (request) this.cleanupWorkerRequest(request)
    this.terminateProcessingWorker()
    if (request) request.reject(error)
    this.startNextWorkerRequest()
  }

  private static terminateProcessingWorker(): void {
    this.processingWorker?.terminate()
    this.processingWorker = null
    this.registeredWorkerLuts.clear()
  }

  /** Releases worker resources and rejects active or queued requests. */
  static disposeProcessingWorker(): void {
    const error = createAbortError()
    const requests = [
      ...(this.activeWorkerRequest ? [this.activeWorkerRequest] : []),
      ...this.workerQueue,
    ]
    this.activeWorkerRequest = null
    this.workerQueue = []
    this.terminateProcessingWorker()
    for (const request of requests) {
      this.cleanupWorkerRequest(request)
      request.reject(error)
    }
  }

  private static getProcessingWorker(): Worker {
    if (!this.processingWorker) {
      const worker = new Worker(
        new URL('./processor.worker.ts', import.meta.url),
        { type: 'module' }
      )
      this.processingWorker = worker

      worker.addEventListener('message', (e: MessageEvent) => {
        if (this.processingWorker !== worker) return
        const request = this.activeWorkerRequest
        if (!request || e.data.requestId !== request.requestId) return

        if (e.data.type === 'error') {
          this.rejectWorkerRequest(request, new Error(e.data.message || 'Worker processing failed'))
          return
        }
        const { buffer, width, height } = e.data
        this.completeWorkerRequest(
          request,
          new ImageData(new Uint8ClampedArray(buffer), width, height)
        )
      })

      worker.addEventListener('error', (e: ErrorEvent) => {
        if (this.processingWorker !== worker) return
        console.error('Processing worker error:', e.message)
        this.restartWorkerAfterFailure(new Error(e.message || 'Processing worker failed'))
      })
    }
    return this.processingWorker
  }

  /** Copy only the requested pixel size and release its backing canvas promptly. */
  private static bitmapToImageData(bitmap: ImageBitmap, width: number, height: number): ImageData {
    const canvas = document.createElement('canvas')
    try {
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (!context) throw new Error('Failed to get canvas context')
      context.drawImage(bitmap, 0, 0, width, height)
      return context.getImageData(0, 0, width, height)
    } finally {
      canvas.width = 0
      canvas.height = 0
    }
  }

  /** Load-time ownership retains dimensions and a preview, never full-size RGBA. */
  static async decodeImagePreview(
    file: File,
    thumbnailMaxSize: number,
    validateDimensions?: (width: number, height: number) => void,
    signal?: AbortSignal,
  ): Promise<{ thumbnail: ImageData; width: number; height: number }> {
    signal?.throwIfAborted()
    if (!Number.isFinite(thumbnailMaxSize) || thumbnailMaxSize <= 0) throw new Error('Preview size must be positive')
    const bitmap = await createImageBitmap(file)
    try {
      signal?.throwIfAborted()
      const { width, height } = bitmap
      validateDimensions?.(width, height)
      signal?.throwIfAborted()
      const scale = Math.min(1, thumbnailMaxSize / Math.max(width, height))
      const thumbnail = this.bitmapToImageData(bitmap, Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)))
      signal?.throwIfAborted()
      return { thumbnail, width, height }
    } finally {
      // Native decode cannot be interrupted; late results are closed and rejected.
      bitmap.close()
    }
  }

  /** Export owns this full-resolution buffer for the duration of one photo. */
  static async decodeImageOriginal(
    file: File,
    signal?: AbortSignal,
    validateDimensions?: (width: number, height: number) => void,
  ): Promise<ImageData> {
    signal?.throwIfAborted()
    const bitmap = await createImageBitmap(file)
    try {
      signal?.throwIfAborted()
      validateDimensions?.(bitmap.width, bitmap.height)
      signal?.throwIfAborted()
      const original = this.bitmapToImageData(bitmap, bitmap.width, bitmap.height)
      signal?.throwIfAborted()
      return original
    } finally {
      bitmap.close()
    }
  }

  static async createThumbnail(file: File, maxSize: number): Promise<ImageData> {
    return (await this.decodeImagePreview(file, maxSize)).thumbnail
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

    try {
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
    } finally {
      canvas.width = 0
      canvas.height = 0
    }
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

    let blob: Blob
    try {
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Failed to get canvas context')
      ctx.putImageData(imageData, 0, 0)
      blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          value => value ? resolve(value) : reject(new Error('Failed to create blob')),
          'image/jpeg',
          quality,
        )
      })
    } finally {
      canvas.width = 0
      canvas.height = 0
    }

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
