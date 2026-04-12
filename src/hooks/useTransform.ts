import { useState, useCallback, useEffect } from 'react'
import { rotateImage, cropImage, calculateCropAreaWithOffset, AspectRatio } from '../engine/transform'

interface CropOffset {
  x: number  // 0..1, 0.5 = по центру
  y: number
}

interface TransformState {
  /** Трансформированное оригинальное изображение */
  transformedOriginal: ImageData
  /** Трансформированный thumbnail */
  transformedThumbnail: ImageData
  /** Режим обрезки активен */
  isCropping: boolean
  /** Текущее соотношение сторон для обрезки */
  cropRatio: AspectRatio
  /** Смещение рамки кропа (0..1 по обеим осям, 0.5 = центр) */
  cropOffset: CropOffset
}

interface TransformActions {
  /** Повернуть изображение по часовой стрелке */
  rotateClockwise: () => void
  /** Повернуть изображение против часовой стрелки */
  rotateCounterClockwise: () => void
  /** Открыть режим обрезки */
  openCrop: () => void
  /** Закрыть режим обрезки без применения */
  cancelCrop: () => void
  /** Изменить соотношение сторон обрезки */
  setCropRatio: (ratio: AspectRatio) => void
  /** Изменить смещение рамки кропа */
  setCropOffset: (offset: CropOffset) => void
  /** Применить обрезку */
  applyCrop: () => void
  /** Сбросить трансформации к исходным изображениям */
  resetTransform: (original: ImageData, thumbnail: ImageData) => void
}

interface UseTransformOptions {
  /** Исходное оригинальное изображение */
  originalImage: ImageData
  /** Исходный thumbnail */
  thumbnail: ImageData
  /** Текущие трансформированные изображения (для multi-image sync) */
  transformedOriginal?: ImageData
  transformedThumbnail?: ImageData
  /** Callback при изменении трансформированных изображений */
  onTransformChange?: (original: ImageData, thumbnail: ImageData) => void
  /** Соотношение при входе в crop и после сброса трансформаций */
  defaultCropRatio: AspectRatio
}

/**
 * Хук для управления трансформациями изображения (поворот, обрезка).
 * Отделяет логику трансформаций от основного компонента Editor.
 * Поддерживает синхронизацию с внешним состоянием для multi-image режима.
 */
export function useTransform({
  originalImage,
  thumbnail,
  transformedOriginal: externalTransformedOriginal,
  transformedThumbnail: externalTransformedThumbnail,
  onTransformChange,
  defaultCropRatio,
}: UseTransformOptions): TransformState & TransformActions {
  const [transformedOriginal, setTransformedOriginal] = useState<ImageData>(
    externalTransformedOriginal || originalImage
  )
  const [transformedThumbnail, setTransformedThumbnail] = useState<ImageData>(
    externalTransformedThumbnail || thumbnail
  )
  const [isCropping, setIsCropping] = useState(false)
  const [cropRatio, setCropRatio] = useState<AspectRatio>(defaultCropRatio)
  const [cropOffset, setCropOffset] = useState<CropOffset>({ x: 0.5, y: 0.5 })

  // Синхронизация с внешним состоянием (для переключения между изображениями)
  useEffect(() => {
    if (externalTransformedOriginal && externalTransformedThumbnail) {
      setTransformedOriginal(externalTransformedOriginal)
      setTransformedThumbnail(externalTransformedThumbnail)
    }
  }, [externalTransformedOriginal, externalTransformedThumbnail])

  /**
   * Применяет поворот к обоим изображениям
   */
  const rotate = useCallback((angle: 90 | 270) => {
    const rotatedOriginal = rotateImage(transformedOriginal, angle)
    const rotatedThumbnail = rotateImage(transformedThumbnail, angle)

    setTransformedOriginal(rotatedOriginal)
    setTransformedThumbnail(rotatedThumbnail)
    onTransformChange?.(rotatedOriginal, rotatedThumbnail)
  }, [transformedOriginal, transformedThumbnail, onTransformChange])

  const rotateClockwise = useCallback(() => rotate(90), [rotate])
  const rotateCounterClockwise = useCallback(() => rotate(270), [rotate])

  const openCrop = useCallback(() => {
    setCropRatio(defaultCropRatio)
    setCropOffset({ x: 0.5, y: 0.5 })
    setIsCropping(true)
  }, [defaultCropRatio])

  const cancelCrop = useCallback(() => {
    setIsCropping(false)
  }, [])

  const applyCrop = useCallback(() => {
    if (cropRatio === 'free') {
      setIsCropping(false)
      return
    }

    const cropAreaOriginal = calculateCropAreaWithOffset(
      transformedOriginal.width,
      transformedOriginal.height,
      cropRatio,
      cropOffset.x,
      cropOffset.y
    )
    const cropAreaThumbnail = calculateCropAreaWithOffset(
      transformedThumbnail.width,
      transformedThumbnail.height,
      cropRatio,
      cropOffset.x,
      cropOffset.y
    )

    const croppedOriginal = cropImage(transformedOriginal, cropAreaOriginal)
    const croppedThumbnail = cropImage(transformedThumbnail, cropAreaThumbnail)

    setTransformedOriginal(croppedOriginal)
    setTransformedThumbnail(croppedThumbnail)
    onTransformChange?.(croppedOriginal, croppedThumbnail)
    setCropOffset({ x: 0.5, y: 0.5 })
    setIsCropping(false)
  }, [cropRatio, cropOffset, transformedOriginal, transformedThumbnail, onTransformChange])

  const resetTransform = useCallback((original: ImageData, thumb: ImageData) => {
    setTransformedOriginal(original)
    setTransformedThumbnail(thumb)
    setIsCropping(false)
    setCropRatio(defaultCropRatio)
    setCropOffset({ x: 0.5, y: 0.5 })
  }, [defaultCropRatio])

  return {
    // State
    transformedOriginal,
    transformedThumbnail,
    isCropping,
    cropRatio,
    cropOffset,
    // Actions
    rotateClockwise,
    rotateCounterClockwise,
    openCrop,
    cancelCrop,
    setCropRatio,
    setCropOffset,
    applyCrop,
    resetTransform,
  }
}

