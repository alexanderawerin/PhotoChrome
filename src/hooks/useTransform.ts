import { useState, useCallback } from 'react'
import { rotateImage, cropImage, calculateCropArea, AspectRatio } from '../engine/transform'

interface TransformState {
  /** Трансформированное оригинальное изображение */
  transformedOriginal: ImageData
  /** Трансформированный thumbnail */
  transformedThumbnail: ImageData
  /** Режим обрезки активен */
  isCropping: boolean
  /** Текущее соотношение сторон для обрезки */
  cropRatio: AspectRatio
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
  /** Callback при изменении трансформированных изображений */
  onTransformChange?: (original: ImageData, thumbnail: ImageData) => void
}

/**
 * Хук для управления трансформациями изображения (поворот, обрезка).
 * Отделяет логику трансформаций от основного компонента Editor.
 */
export function useTransform({
  originalImage,
  thumbnail,
  onTransformChange,
}: UseTransformOptions): TransformState & TransformActions {
  const [transformedOriginal, setTransformedOriginal] = useState<ImageData>(originalImage)
  const [transformedThumbnail, setTransformedThumbnail] = useState<ImageData>(thumbnail)
  const [isCropping, setIsCropping] = useState(false)
  const [cropRatio, setCropRatio] = useState<AspectRatio>('1:1')

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
    setCropRatio('1:1')
    setIsCropping(true)
  }, [])

  const cancelCrop = useCallback(() => {
    setIsCropping(false)
  }, [])

  const applyCrop = useCallback(() => {
    if (cropRatio === 'free') {
      setIsCropping(false)
      return
    }

    // Вычисляем crop area отдельно для оригинала и thumbnail
    const cropAreaOriginal = calculateCropArea(
      transformedOriginal.width,
      transformedOriginal.height,
      cropRatio
    )
    const cropAreaThumbnail = calculateCropArea(
      transformedThumbnail.width,
      transformedThumbnail.height,
      cropRatio
    )

    const croppedOriginal = cropImage(transformedOriginal, cropAreaOriginal)
    const croppedThumbnail = cropImage(transformedThumbnail, cropAreaThumbnail)

    setTransformedOriginal(croppedOriginal)
    setTransformedThumbnail(croppedThumbnail)
    onTransformChange?.(croppedOriginal, croppedThumbnail)
    setIsCropping(false)
  }, [cropRatio, transformedOriginal, transformedThumbnail, onTransformChange])

  const resetTransform = useCallback((original: ImageData, thumb: ImageData) => {
    setTransformedOriginal(original)
    setTransformedThumbnail(thumb)
    setIsCropping(false)
    setCropRatio('1:1')
  }, [])

  return {
    // State
    transformedOriginal,
    transformedThumbnail,
    isCropping,
    cropRatio,
    // Actions
    rotateClockwise,
    rotateCounterClockwise,
    openCrop,
    cancelCrop,
    setCropRatio,
    applyCrop,
    resetTransform,
  }
}

