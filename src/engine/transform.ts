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

export type AspectRatio = '1:1' | '4:3' | '3:4' | '16:9' | '9:16' | 'free'

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
 * Вычисляет область crop для заданного соотношения сторон
 */
export function calculateCropArea(
  imageWidth: number,
  imageHeight: number,
  aspectRatio: AspectRatio
): CropArea {
  if (aspectRatio === 'free') {
    return {
      x: 0,
      y: 0,
      width: imageWidth,
      height: imageHeight
    }
  }

  const ratios: Record<AspectRatio, number> = {
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
