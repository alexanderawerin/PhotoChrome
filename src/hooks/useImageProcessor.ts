import { useState, useCallback } from 'react'
import { ImageProcessor } from '../engine/processor'
import { ProcessingOptions, Recipe } from '../engine/types'
import { getSimulation } from '../presets/simulations'

export interface ProcessedImage {
  original: ImageData
  processed: ImageData
  thumbnail: ImageData
}

export function useImageProcessor() {
  const [image, setImage] = useState<File | null>(null)
  const [imageData, setImageData] = useState<ProcessedImage | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadImage = useCallback(async (file: File) => {
    setIsLoading(true)
    setError(null)

    try {
      setImage(file)
      
      // Загружаем оригинал и создаём thumbnail
      const [original, thumbnail] = await Promise.all([
        ImageProcessor.loadImage(file),
        ImageProcessor.createThumbnail(file, 1600)
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
      setError(err instanceof Error ? err.message : 'Failed to load image')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const processImage = useCallback(
    async (recipe: Recipe): Promise<ImageData | null> => {
      if (!imageData) return null

      try {
        const simulation = getSimulation(recipe.filmSimulation)
        if (!simulation) {
          throw new Error(`Simulation ${recipe.filmSimulation} not found`)
        }

        const options: ProcessingOptions = {
          simulation,
          settings: recipe.settings
        }

        // Обрабатываем thumbnail для быстрого предпросмотра
        const processed = ImageProcessor.process(imageData.thumbnail, options)
        return processed
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to process image')
        return null
      }
    },
    [imageData]
  )

  const processFullImage = useCallback(
    async (recipe: Recipe): Promise<ImageData | null> => {
      if (!imageData) return null

      try {
        const simulation = getSimulation(recipe.filmSimulation)
        if (!simulation) {
          throw new Error(`Simulation ${recipe.filmSimulation} not found`)
        }

        const options: ProcessingOptions = {
          simulation,
          settings: recipe.settings
        }

        // Обрабатываем полное изображение
        const processed = ImageProcessor.process(imageData.original, options)
        return processed
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to process image')
        return null
      }
    },
    [imageData]
  )

  const exportImage = useCallback(
    async (processedImageData: ImageData, filename: string) => {
      try {
        const blob = await ImageProcessor.imageDataToBlob(processedImageData)
        const url = URL.createObjectURL(blob)
        
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to export image')
      }
    },
    []
  )

  const reset = useCallback(() => {
    setImage(null)
    setImageData(null)
    setError(null)
  }, [])

  return {
    image,
    imageData,
    isLoading,
    error,
    loadImage,
    processImage,
    processFullImage,
    exportImage,
    reset
  }
}

