import { useState, useCallback } from 'react'
import { ImageProcessor } from '../engine/processor'
import { Recipe } from '../engine/types'
import { getSimulation } from '../presets/simulations'
import { THUMBNAIL_MAX_SIZE } from '../constants'

export interface ProcessedImage {
  /** Оригинальное изображение в полном разрешении */
  original: ImageData
  /** Копия оригинала для возможного отката изменений */
  processed: ImageData
  /** Уменьшенная версия для быстрого превью */
  thumbnail: ImageData
}

/**
 * Хук для загрузки и обработки изображений.
 * Управляет состоянием загрузки, ошибками и предоставляет методы обработки.
 */
export function useImageProcessor() {
  const [image, setImage] = useState<File | null>(null)
  const [imageData, setImageData] = useState<ProcessedImage | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Загружает изображение из файла.
   * Создаёт оригинал и thumbnail параллельно.
   */
  const loadImage = useCallback(async (file: File) => {
    setIsLoading(true)
    setError(null)

    try {
      setImage(file)
      
      // Загружаем оригинал и создаём thumbnail параллельно
      const [original, thumbnail] = await Promise.all([
        ImageProcessor.loadImage(file),
        ImageProcessor.createThumbnail(file, THUMBNAIL_MAX_SIZE)
      ])

      setImageData({
        original,
        processed: new ImageData(
          new Uint8ClampedArray(original.data),
          original.width,
          original.height
        ),
        thumbnail
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Не удалось загрузить изображение'
      setError(message)
      console.error('Image loading failed:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Обрабатывает thumbnail с применением рецепта.
   * Используется для быстрого предпросмотра.
   */
  const processImage = useCallback(
    (recipe: Recipe): ImageData | null => {
      if (!imageData) return null

      try {
        const simulation = getSimulation(recipe.filmSimulation)
        if (!simulation) {
          throw new Error(`Симуляция ${recipe.filmSimulation} не найдена`)
        }

        return ImageProcessor.process(imageData.thumbnail, {
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
    [imageData]
  )

  /**
   * Обрабатывает полное изображение с применением рецепта.
   * Используется для финального экспорта.
   */
  const processFullImage = useCallback(
    (recipe: Recipe): ImageData | null => {
      if (!imageData) return null

      try {
        const simulation = getSimulation(recipe.filmSimulation)
        if (!simulation) {
          throw new Error(`Симуляция ${recipe.filmSimulation} не найдена`)
        }

        return ImageProcessor.process(imageData.original, {
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
    [imageData]
  )

  /**
   * Сбрасывает состояние хука к начальному.
   */
  const reset = useCallback(() => {
    setImage(null)
    setImageData(null)
    setError(null)
  }, [])

  return {
    /** Загруженный файл изображения */
    image,
    /** Данные изображения (оригинал, обработанное, thumbnail) */
    imageData,
    /** Флаг загрузки */
    isLoading,
    /** Сообщение об ошибке */
    error,
    /** Загрузить изображение из файла */
    loadImage,
    /** Обработать thumbnail (быстрый превью) */
    processImage,
    /** Обработать полное изображение (для экспорта) */
    processFullImage,
    /** Сбросить состояние */
    reset
  }
}

