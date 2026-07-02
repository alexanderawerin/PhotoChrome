import { useState, useCallback, useEffect } from 'react'
import {
  clampFineAngle,
  nextQuarterTurn,
  createDefaultTransformState,
  renderImageTransform,
  toggleHorizontalFlip,
  type AspectRatio,
  type ImageTransformState,
  type NormalizedCropRect,
} from '../engine/transform'

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
  transformState: ImageTransformState
}

interface TransformActions {
  /** Повернуть изображение по часовой стрелке */
  rotateClockwise: () => void
  /** Повернуть изображение против часовой стрелки */
  rotateCounterClockwise: () => void
  /** Отразить изображение по горизонтали. Повторный вызов восстанавливает вид. */
  flipHorizontal: () => void
  /** Открыть режим обрезки */
  openCrop: () => void
  /** Закрыть режим обрезки без применения */
  cancelCrop: () => void
  /** Изменить соотношение сторон обрезки */
  setCropRatio: (ratio: AspectRatio) => void
  /** Изменить смещение рамки кропа */
  setCropOffset: (offset: CropOffset) => void
  setCropScale: (scale: number) => void
  setFineAngle: (angle: number) => void
  setFreeCropRect: (rect: NormalizedCropRect) => void
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
  externalTransformState?: ImageTransformState
  /** Callback при изменении трансформированных изображений */
  onTransformChange?: (original: ImageData, thumbnail: ImageData, state: ImageTransformState) => void
  onTransformPreview?: (thumbnail: ImageData) => void
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
  externalTransformState,
  onTransformChange,
  onTransformPreview,
}: UseTransformOptions): TransformState & TransformActions {
  const [transformedOriginal, setTransformedOriginal] = useState<ImageData>(
    externalTransformedOriginal || originalImage
  )
  const [transformedThumbnail, setTransformedThumbnail] = useState<ImageData>(
    externalTransformedThumbnail || thumbnail
  )
  const [isCropping, setIsCropping] = useState(false)
  const [transformState, setTransformState] = useState<ImageTransformState>(
    externalTransformState ?? createDefaultTransformState
  )
  const [cropStateBefore, setCropStateBefore] = useState<ImageTransformState | null>(null)
  const cropRatio = transformState.cropRatio
  const cropOffset = transformState.cropOffset

  // Синхронизация с внешним состоянием (для переключения между изображениями)
  useEffect(() => {
    if (externalTransformedOriginal && externalTransformedThumbnail) {
      setTransformedOriginal(externalTransformedOriginal)
      setTransformedThumbnail(externalTransformedThumbnail)
    }
    if (externalTransformState) setTransformState(externalTransformState)
  }, [externalTransformedOriginal, externalTransformedThumbnail, externalTransformState])

  /**
   * Применяет поворот к обоим изображениям
   */
  const rotate = useCallback((angle: 90 | 270) => {
    const quarterTurns = angle === 90
      ? nextQuarterTurn(transformState.quarterTurns)
      : ((transformState.quarterTurns + 270) % 360) as ImageTransformState['quarterTurns']
    const nextState = { ...transformState, quarterTurns }
    const rotatedOriginal = renderImageTransform(originalImage, nextState)
    const rotatedThumbnail = renderImageTransform(thumbnail, nextState)
    setTransformedOriginal(rotatedOriginal)
    setTransformedThumbnail(rotatedThumbnail)
    setTransformState(nextState)
    onTransformChange?.(rotatedOriginal, rotatedThumbnail, nextState)
  }, [originalImage, thumbnail, transformState, onTransformChange])

  const rotateClockwise = useCallback(() => rotate(90), [rotate])
  const rotateCounterClockwise = useCallback(() => rotate(270), [rotate])

  const flipHorizontal = useCallback(() => {
    const nextState = toggleHorizontalFlip(transformState)
    const flippedOriginal = renderImageTransform(originalImage, nextState)
    const flippedThumbnail = renderImageTransform(thumbnail, nextState)
    setTransformedOriginal(flippedOriginal)
    setTransformedThumbnail(flippedThumbnail)
    setTransformState(nextState)
    onTransformChange?.(flippedOriginal, flippedThumbnail, nextState)
  }, [originalImage, thumbnail, transformState, onTransformChange])

  const openCrop = useCallback(() => {
    setCropStateBefore({
      ...transformState,
      cropOffset: { ...transformState.cropOffset },
      cropRect: { ...transformState.cropRect },
    })
    setIsCropping(true)
  }, [transformState])

  const previewCropUpdate = useCallback((update: Partial<ImageTransformState>) => {
    const nextState: ImageTransformState = {
      ...transformState,
      ...update,
      fineAngle: update.fineAngle === undefined ? transformState.fineAngle : clampFineAngle(update.fineAngle),
      cropScale: Math.max(1, update.cropScale ?? transformState.cropScale),
    }
    setTransformState(nextState)
    const preview = renderImageTransform(thumbnail, nextState)
    setTransformedThumbnail(preview)
    onTransformPreview?.(preview)
  }, [onTransformPreview, thumbnail, transformState])

  const cancelCrop = useCallback(() => {
    if (cropStateBefore) {
      const restoredOriginal = renderImageTransform(originalImage, cropStateBefore)
      const restoredThumbnail = renderImageTransform(thumbnail, cropStateBefore)
      setTransformState(cropStateBefore)
      setTransformedOriginal(restoredOriginal)
      setTransformedThumbnail(restoredThumbnail)
      onTransformPreview?.(restoredThumbnail)
    }
    setCropStateBefore(null)
    setIsCropping(false)
  }, [cropStateBefore, onTransformPreview, originalImage, thumbnail])

  const applyCrop = useCallback(() => {
    const croppedOriginal = renderImageTransform(originalImage, transformState)
    const croppedThumbnail = renderImageTransform(thumbnail, transformState)
    setTransformedOriginal(croppedOriginal)
    setTransformedThumbnail(croppedThumbnail)
    onTransformChange?.(croppedOriginal, croppedThumbnail, transformState)
    setCropStateBefore(null)
    setIsCropping(false)
  }, [originalImage, thumbnail, transformState, onTransformChange])

  const setCropRatio = useCallback((ratio: AspectRatio) => previewCropUpdate({ cropRatio: ratio }), [previewCropUpdate])
  const setCropOffset = useCallback((offset: CropOffset) => previewCropUpdate({ cropOffset: offset }), [previewCropUpdate])
  const setCropScale = useCallback((scale: number) => previewCropUpdate({ cropScale: scale }), [previewCropUpdate])
  const setFineAngle = useCallback((angle: number) => previewCropUpdate({ fineAngle: angle }), [previewCropUpdate])
  const setFreeCropRect = useCallback((cropRect: NormalizedCropRect) => previewCropUpdate({ cropRect }), [previewCropUpdate])

  const resetTransform = useCallback((original: ImageData, thumb: ImageData) => {
    setTransformedOriginal(original)
    setTransformedThumbnail(thumb)
    setIsCropping(false)
    setTransformState(createDefaultTransformState())
    setCropStateBefore(null)
  }, [])

  return {
    // State
    transformedOriginal,
    transformedThumbnail,
    isCropping,
    cropRatio,
    cropOffset,
    transformState,
    // Actions
    rotateClockwise,
    rotateCounterClockwise,
    flipHorizontal,
    openCrop,
    cancelCrop,
    setCropRatio,
    setCropOffset,
    setCropScale,
    setFineAngle,
    setFreeCropRect,
    applyCrop,
    resetTransform,
  }
}
