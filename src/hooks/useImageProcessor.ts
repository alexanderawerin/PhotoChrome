import { useState, useCallback, useMemo } from 'react'
import { ImageProcessor } from '../engine/processor'
import { ImageItem, Recipe } from '../engine/types'
import { getSimulation } from '../presets/simulations'
import { THUMBNAIL_MAX_SIZE } from '../constants'
import { extractExif } from '../engine/exif'
import {
  validateMediaSelection,
  type MediaSelectionItem,
} from '../engine/media-selection'

const MAX_CONCURRENT_DECODES = 2

export interface ProcessedImage {
  /** Оригинальное изображение в полном разрешении */
  original: ImageData
  /** Копия оригинала для возможного отката изменений */
  processed: ImageData
  /** Уменьшенная версия для быстрого превью */
  thumbnail: ImageData
}

/**
 * Генерирует уникальный ID для изображения
 */
function generateImageId(): string {
  return `img_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
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
      const initialValidation = validateMediaSelection(files.map(file => ({ file })))
      if (!initialValidation.valid) throw new Error(initialValidation.error.message)

      const decodedItems: MediaSelectionItem[] = files.map(file => ({ file }))
      const loadedImages = new Array<ImageItem>(files.length)
      let nextIndex = 0
      let failure: unknown

      const decodeNext = async () => {
        while (failure === undefined) {
          const index = nextIndex++
          if (index >= files.length) return
          const file = files[index]

          try {
            const [{ original, thumbnail }, exif] = await Promise.all([
              ImageProcessor.decodeImagePair(file, THUMBNAIL_MAX_SIZE, (width, height) => {
                // Validate dimensions before allocating full-size canvas pixels.
                decodedItems[index] = { file, width, height }
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
            }
          } catch (error) {
            failure = error
          }
        }
      }

      await Promise.all(Array.from(
        { length: Math.min(MAX_CONCURRENT_DECODES, files.length) },
        decodeNext
      ))
      if (failure !== undefined) throw failure

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

  /**
   * Получить текущее активное изображение
   */
  const currentImage = useMemo(() =>
    images[currentIndex] ?? null,
    [images, currentIndex]
  )

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
   * Обновить текущее изображение
   */
  const updateCurrentImage = useCallback((updates: Partial<ImageItem>) => {
    if (currentImage) {
      updateImage(currentImage.id, updates)
    }
  }, [currentImage, updateImage])

  /**
   * Обрабатывает thumbnail с применением рецепта.
   * Используется для быстрого предпросмотра.
   * @deprecated Используйте прямой доступ к imageItem.recipe
   */
  const processImage = useCallback(
    (recipe: Recipe): ImageData | null => {
      if (!currentImage) return null

      try {
        const simulation = getSimulation(recipe.filmSimulation)
        if (!simulation) {
          throw new Error(`Симуляция ${recipe.filmSimulation} не найдена`)
        }

        return ImageProcessor.process(currentImage.thumbnail, {
          simulation,
          settings: recipe.settings
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Не удалось обработать изображение'
        setError(message)
        console.error('Image processing failed:', err)
        return null
      }
    },
    [currentImage]
  )

  /**
   * Обрабатывает полное изображение с применением рецепта.
   * Используется для финального экспорта.
   * @deprecated Используйте прямой доступ к imageItem.recipe
   */
  const processFullImage = useCallback(
    (recipe: Recipe): ImageData | null => {
      if (!currentImage) return null

      try {
        const simulation = getSimulation(recipe.filmSimulation)
        if (!simulation) {
          throw new Error(`Симуляция ${recipe.filmSimulation} не найдена`)
        }

        return ImageProcessor.process(currentImage.original, {
          simulation,
          settings: recipe.settings
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Не удалось обработать изображение'
        setError(message)
        console.error('Full image processing failed:', err)
        return null
      }
    },
    [currentImage]
  )

  /**
   * Сбрасывает состояние хука к начальному.
   */
  const reset = useCallback(() => {
    setImages([])
    setCurrentIndex(0)
    setError(null)
  }, [])

  // Backward compatibility: если загружено одно изображение, возвращаем старый формат
  const legacyImageData = useMemo(() => {
    if (images.length === 1 && currentImage) {
      return {
        original: currentImage.original,
        processed: currentImage.transformedOriginal,
        thumbnail: currentImage.thumbnail
      }
    }
    return null
  }, [images, currentImage])

  return {
    /** Массив загруженных изображений */
    images,
    /** Текущее активное изображение */
    currentImage,
    /** Индекс текущего изображения */
    currentIndex,
    /** Общее количество изображений */
    totalImages: images.length,
    /** Флаг загрузки */
    isLoading,
    /** Сообщение об ошибке */
    error,

    /** Загрузить массив изображений */
    loadImages,
    /** Перейти к изображению по индексу */
    goToImage,
    /** Следующее изображение */
    nextImage,
    /** Предыдущее изображение */
    previousImage,
    /** Обновить изображение по ID */
    updateImage,
    /** Обновить текущее изображение */
    updateCurrentImage,

    /** @deprecated Обработать thumbnail (используйте recipe в ImageItem) */
    processImage,
    /** @deprecated Обработать полное изображение (используйте recipe в ImageItem) */
    processFullImage,
    /** Сбросить состояние */
    reset,

    /** @deprecated Backward compatibility для single image mode */
    image: currentImage?.file ?? null,
    /** @deprecated Backward compatibility для single image mode */
    imageData: legacyImageData,
    /** @deprecated Backward compatibility для single image mode */
    loadImage: async (file: File) => loadImages([file])
  }
}
