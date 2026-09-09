import { useState, useCallback } from 'react'
import { ImageProcessor } from '../engine/processor'
import { ImageItem } from '../engine/types'
import { THUMBNAIL_MAX_SIZE } from '../constants'
import { extractExif } from '../engine/exif'
import {
  validateMediaSelection,
  type MediaSelectionItem,
} from '../engine/media-selection'
import { createDefaultTransformState } from '../engine/transform'

const MAX_CONCURRENT_DECODES = 2

/**
 * Генерирует уникальный ID для изображения
 */
function generateImageId(): string {
  return `img_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
}

async function decodeImages(
  files: File[],
  existingItems: MediaSelectionItem[] = [],
): Promise<ImageItem[]> {
  const decodedItems: MediaSelectionItem[] = [
    ...existingItems,
    ...files.map(file => ({ file })),
  ]
  const initialValidation = validateMediaSelection(decodedItems)
  if (!initialValidation.valid) throw new Error(initialValidation.error.message)

  const loadedImages = new Array<ImageItem>(files.length)
  let nextIndex = 0
  let failure: unknown
  const existingCount = existingItems.length

  const decodeNext = async () => {
    while (failure === undefined) {
      const index = nextIndex++
      if (index >= files.length) return
      const file = files[index]

      try {
        const [{ original, thumbnail }, exif] = await Promise.all([
          ImageProcessor.decodeImagePair(file, THUMBNAIL_MAX_SIZE, (width, height) => {
            decodedItems[existingCount + index] = { file, width, height }
            const validation = validateMediaSelection(decodedItems)
            if (!validation.valid) throw new Error(validation.error.message)
          }),
          extractExif(file),
        ])

        loadedImages[index] = {
          id: generateImageId(),
          file,
          fileName: file.name,
          original,
          thumbnail,
          exif,
          recipe: null,
          customSettings: {},
          transformedOriginal: original,
          transformedThumbnail: thumbnail,
          rotation: 0,
          transform: createDefaultTransformState(),
        }
      } catch (error) {
        failure = error
      }
    }
  }

  await Promise.all(Array.from(
    { length: Math.min(MAX_CONCURRENT_DECODES, files.length) },
    decodeNext,
  ))
  if (failure !== undefined) throw failure
  return loadedImages
}

/**
 * Хук для загрузки и обработки изображений.
 * Поддерживает как одиночные изображения, так и множественные.
 */
export function useImageProcessor() {
  const [images, setImages] = useState<ImageItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Атомарно загружает массив изображений, декодируя не более двух файлов
   * одновременно. Частичный результат никогда не попадает в состояние.
   */
  const loadImages = useCallback(async (files: File[]) => {
    setIsLoading(true)
    setError(null)

    try {
      const loadedImages = await decodeImages(files)
      setImages(loadedImages)
      setCurrentIndex(0)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось загрузить изображения'
      setError(message)
      console.error('Image loading failed:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  /** Atomically appends files to the current batch without replacing edits. */
  const addImages = useCallback(async (files: File[]) => {
    if (files.length === 0) return
    setIsLoading(true)
    setError(null)
    try {
      const existingItems = images.map(image => ({
        file: image.file,
        width: image.original.width,
        height: image.original.height,
      }))
      const added = await decodeImages(files, existingItems)
      setImages(previous => [...previous, ...added])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось добавить изображения'
      setError(message)
      console.error('Adding images failed:', err)
    } finally {
      setIsLoading(false)
    }
  }, [images])

  /**
   * Перейти к изображению по индексу
   */
  const goToImage = useCallback((index: number) => {
    if (index >= 0 && index < images.length) {
      setCurrentIndex(index)
    }
  }, [images.length])

  /**
   * Перейти к следующему изображению
   */
  const nextImage = useCallback(() => {
    setCurrentIndex(prev => Math.min(prev + 1, images.length - 1))
  }, [images.length])

  /**
   * Перейти к предыдущему изображению
   */
  const previousImage = useCallback(() => {
    setCurrentIndex(prev => Math.max(prev - 1, 0))
  }, [])

  /**
   * Обновить конкретное изображение по ID
   */
  const updateImage = useCallback((id: string, updates: Partial<ImageItem>) => {
    setImages(prev => prev.map(img =>
      img.id === id ? { ...img, ...updates } : img
    ))
  }, [])

  /**
   * Сбрасывает состояние хука к начальному.
   */
  const reset = useCallback(() => {
    setImages([])
    setCurrentIndex(0)
    setError(null)
  }, [])

  return {
    /** Массив загруженных изображений */
    images,
    /** Индекс текущего изображения */
    currentIndex,
    /** Флаг загрузки */
    isLoading,
    /** Сообщение об ошибке */
    error,

    /** Загрузить массив изображений */
    loadImages,
    /** Добавить изображения в текущий набор. */
    addImages,
    /** Перейти к изображению по индексу */
    goToImage,
    /** Следующее изображение */
    nextImage,
    /** Предыдущее изображение */
    previousImage,
    /** Обновить изображение по ID */
    updateImage,
    /** Сбросить состояние */
    reset,
  }
}
