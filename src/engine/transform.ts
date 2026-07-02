/**
 * Трансформации изображения: поворот и crop
 */

import { clampRange } from './utils'

export type RotationAngle = 0 | 90 | 180 | 270

export interface CropArea {
  x: number
  y: number
  width: number
  height: number
}

export type AspectRatio = 'original' | '1:1' | '4:3' | '3:4' | '16:9' | '9:16' | 'free'

export interface NormalizedCropRect {
  x: number
  y: number
  width: number
  height: number
}

export interface ImageTransformState {
  quarterTurns: RotationAngle
  fineAngle: number
  flipHorizontal: boolean
  cropRatio: AspectRatio
  cropScale: number
  cropOffset: { x: number; y: number }
  cropRect: NormalizedCropRect
}

export const DEFAULT_TRANSFORM_STATE: ImageTransformState = {
  quarterTurns: 0,
  fineAngle: 0,
  flipHorizontal: false,
  cropRatio: 'original',
  cropScale: 1,
  cropOffset: { x: 0.5, y: 0.5 },
  cropRect: { x: 0, y: 0, width: 1, height: 1 },
}

export function createDefaultTransformState(): ImageTransformState {
  return {
    ...DEFAULT_TRANSFORM_STATE,
    cropOffset: { ...DEFAULT_TRANSFORM_STATE.cropOffset },
    cropRect: { ...DEFAULT_TRANSFORM_STATE.cropRect },
  }
}

export function nextQuarterTurn(rotation: RotationAngle): RotationAngle {
  return ((rotation + 90) % 360) as RotationAngle
}

export function toggleHorizontalFlip(state: ImageTransformState): ImageTransformState {
  return { ...state, flipHorizontal: !state.flipHorizontal }
}

export function clampFineAngle(angle: number): number {
  const clamped = clampRange(angle, -45, 45)
  const snapped = Math.abs(clamped) < 0.05 ? 0 : clamped
  return Math.round(snapped * 10) / 10
}

/** Minimum uniform scale that keeps every output corner covered after rotation. */
export function minimumCoverScale(width: number, height: number, angle: number): number {
  if (width <= 0 || height <= 0) return 1
  const radians = Math.abs(clampFineAngle(angle)) * Math.PI / 180
  const cos = Math.abs(Math.cos(radians))
  const sin = Math.abs(Math.sin(radians))
  return Math.max(
    (width * cos + height * sin) / width,
    (width * sin + height * cos) / height,
    1,
  )
}

export function flipImageHorizontal(imageData: ImageData): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = imageData.width
  canvas.height = imageData.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Failed to get canvas context')

  const source = document.createElement('canvas')
  source.width = imageData.width
  source.height = imageData.height
  const sourceCtx = source.getContext('2d')
  if (!sourceCtx) throw new Error('Failed to get source canvas context')
  sourceCtx.putImageData(imageData, 0, 0)

  ctx.translate(canvas.width, 0)
  ctx.scale(-1, 1)
  ctx.drawImage(source, 0, 0)
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

/** Renders the complete transform from the immutable source image. */
export function renderImageTransform(
  imageData: ImageData,
  state: ImageTransformState,
): ImageData {
  let rendered = rotateImage(imageData, state.quarterTurns)
  if (state.flipHorizontal) rendered = flipImageHorizontal(rendered)
  if (state.fineAngle !== 0 || state.cropScale !== 1 || state.cropOffset.x !== 0.5 || state.cropOffset.y !== 0.5) {
    rendered = renderFineTransform(rendered, state)
  }

  if (state.cropRatio === 'free') {
    const rect = state.cropRect
    return cropImage(rendered, {
      x: rect.x * rendered.width,
      y: rect.y * rendered.height,
      width: rect.width * rendered.width,
      height: rect.height * rendered.height,
    })
  }
  if (state.cropRatio === 'original') return rendered
  return cropImage(rendered, calculateCropAreaWithOffset(
    rendered.width,
    rendered.height,
    state.cropRatio,
    state.cropOffset.x,
    state.cropOffset.y,
  ))
}

function renderFineTransform(imageData: ImageData, state: ImageTransformState): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = imageData.width
  canvas.height = imageData.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Failed to get canvas context')

  const source = document.createElement('canvas')
  source.width = imageData.width
  source.height = imageData.height
  const sourceCtx = source.getContext('2d')
  if (!sourceCtx) throw new Error('Failed to get source canvas context')
  sourceCtx.putImageData(imageData, 0, 0)

  const scale = minimumCoverScale(imageData.width, imageData.height, state.fineAngle) * Math.max(1, state.cropScale)
  const overflowX = imageData.width * (scale - 1)
  const overflowY = imageData.height * (scale - 1)
  const translateX = (0.5 - state.cropOffset.x) * overflowX
  const translateY = (0.5 - state.cropOffset.y) * overflowY

  ctx.translate(canvas.width / 2 + translateX, canvas.height / 2 + translateY)
  ctx.rotate(clampFineAngle(state.fineAngle) * Math.PI / 180)
  ctx.scale(scale, scale)
  ctx.drawImage(source, -imageData.width / 2, -imageData.height / 2)
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

/**
 * Поворачивает изображение на заданный угол
 */
export function rotateImage(
  imageData: ImageData,
  angle: RotationAngle
): ImageData {
  if (angle === 0) return imageData

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Failed to get canvas context')

  // Для 90° и 270° меняем местами ширину и высоту
  if (angle === 90 || angle === 270) {
    canvas.width = imageData.height
    canvas.height = imageData.width
  } else {
    canvas.width = imageData.width
    canvas.height = imageData.height
  }

  // Создаём временный canvas для исходного изображения
  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = imageData.width
  tempCanvas.height = imageData.height
  const tempCtx = tempCanvas.getContext('2d')
  if (!tempCtx) throw new Error('Failed to get temp canvas context')
  tempCtx.putImageData(imageData, 0, 0)

  // Применяем трансформацию
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate((angle * Math.PI) / 180)
  ctx.drawImage(
    tempCanvas,
    -imageData.width / 2,
    -imageData.height / 2
  )

  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

/**
 * Валидирует и корректирует область crop
 */
export function validateCropArea(
  cropArea: CropArea,
  imageWidth: number,
  imageHeight: number
): CropArea {
  // Ограничиваем координаты
  const x = clampRange(Math.round(cropArea.x), 0, imageWidth - 1)
  const y = clampRange(Math.round(cropArea.y), 0, imageHeight - 1)

  // Ограничиваем размеры
  const maxWidth = imageWidth - x
  const maxHeight = imageHeight - y

  const width = clampRange(Math.round(cropArea.width), 1, maxWidth)
  const height = clampRange(Math.round(cropArea.height), 1, maxHeight)

  return { x, y, width, height }
}

/**
 * Обрезает изображение по заданной области
 */
export function cropImage(
  imageData: ImageData,
  cropArea: CropArea
): ImageData {
  // Валидируем область
  const validArea = validateCropArea(cropArea, imageData.width, imageData.height)

  const canvas = document.createElement('canvas')
  canvas.width = validArea.width
  canvas.height = validArea.height

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Failed to get canvas context')

  // Создаём временный canvas
  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = imageData.width
  tempCanvas.height = imageData.height
  const tempCtx = tempCanvas.getContext('2d')
  if (!tempCtx) throw new Error('Failed to get temp canvas context')
  tempCtx.putImageData(imageData, 0, 0)

  // Рисуем обрезанную область
  ctx.drawImage(
    tempCanvas,
    validArea.x,
    validArea.y,
    validArea.width,
    validArea.height,
    0,
    0,
    validArea.width,
    validArea.height
  )

  return ctx.getImageData(0, 0, validArea.width, validArea.height)
}

/**
 * Вычисляет область crop с поддержкой смещения от центра.
 * @param offsetX горизонтальное смещение 0..1 (0.5 = по центру)
 * @param offsetY вертикальное смещение 0..1 (0.5 = по центру)
 */
export function calculateCropAreaWithOffset(
  imageWidth: number,
  imageHeight: number,
  aspectRatio: AspectRatio,
  offsetX: number = 0.5,
  offsetY: number = 0.5
): CropArea {
  const base = calculateCropArea(imageWidth, imageHeight, aspectRatio)
  const availX = imageWidth - base.width
  const availY = imageHeight - base.height
  const x = Math.round(availX * offsetX)
  const y = Math.round(availY * offsetY)
  return {
    x: Math.max(0, Math.min(availX, x)),
    y: Math.max(0, Math.min(availY, y)),
    width: base.width,
    height: base.height,
  }
}

/**
 * Вычисляет область crop для заданного соотношения сторон
 */
export function calculateCropArea(
  imageWidth: number,
  imageHeight: number,
  aspectRatio: AspectRatio
): CropArea {
  if (aspectRatio === 'free' || aspectRatio === 'original') {
    return {
      x: 0,
      y: 0,
      width: imageWidth,
      height: imageHeight
    }
  }

  const ratios: Record<AspectRatio, number> = {
    'original': imageWidth / imageHeight,
    '1:1': 1,
    '4:3': 4 / 3,
    '3:4': 3 / 4,
    '16:9': 16 / 9,
    '9:16': 9 / 16,
    'free': 1
  }

  const targetRatio = ratios[aspectRatio]
  const currentRatio = imageWidth / imageHeight

  let width: number
  let height: number
  let x: number
  let y: number

  if (currentRatio > targetRatio) {
    // Изображение шире, чем нужно - обрезаем по ширине
    height = imageHeight
    width = height * targetRatio
    x = (imageWidth - width) / 2
    y = 0
  } else {
    // Изображение выше, чем нужно - обрезаем по высоте
    width = imageWidth
    height = width / targetRatio
    x = 0
    y = (imageHeight - height) / 2
  }

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height)
  }
}
