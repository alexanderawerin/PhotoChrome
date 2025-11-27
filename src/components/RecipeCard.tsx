import { useEffect, useRef, useState, memo, useMemo } from 'react'
import { Card } from './ui/card'
import { Recipe } from '../engine/types'
import { ImageProcessor } from '../engine/processor'
import { getSimulation } from '../presets/simulations'
import { getSimulationName } from '../presets/recipes'

interface RecipeCardProps {
  recipe: Recipe
  sourceImage: ImageData
  isActive?: boolean
  onClick: () => void
}

// Размер превью для карточки
const PREVIEW_SIZE = 250

/**
 * Создаёт уникальный ключ для кэширования на основе imageData
 */
function getImageKey(imageData: ImageData): string {
  // Используем размеры и сэмпл пикселей для быстрого хэша
  const sample = [
    imageData.data[0],
    imageData.data[100],
    imageData.data[imageData.data.length - 100],
    imageData.data[imageData.data.length - 1]
  ].join(',')
  return `${imageData.width}x${imageData.height}_${sample}`
}

function RecipeCardComponent({ recipe, sourceImage, isActive, onClick }: RecipeCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [previewData, setPreviewData] = useState<ImageData | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  // Мемоизируем уменьшенное изображение
  const smallImage = useMemo(() => {
    const scale = Math.min(PREVIEW_SIZE / sourceImage.width, PREVIEW_SIZE / sourceImage.height)
    const width = Math.round(sourceImage.width * scale)
    const height = Math.round(sourceImage.height * scale)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    // Рисуем исходное изображение
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = sourceImage.width
    tempCanvas.height = sourceImage.height
    const tempCtx = tempCanvas.getContext('2d')
    if (!tempCtx) return null
    tempCtx.putImageData(sourceImage, 0, 0)

    ctx.drawImage(tempCanvas, 0, 0, width, height)
    return ctx.getImageData(0, 0, width, height)
  }, [sourceImage])

  // Ключ для определения необходимости перегенерации
  const imageKey = useMemo(() => getImageKey(sourceImage), [sourceImage])

  useEffect(() => {
    if (!smallImage) return

    let cancelled = false
    setIsGenerating(true)

    // Используем requestIdleCallback для неблокирующей генерации
    const generatePreview = () => {
      if (cancelled) return

      try {
        const simulation = getSimulation(recipe.filmSimulation)
        if (!simulation || cancelled) return

        const processed = ImageProcessor.process(smallImage, {
          simulation,
          settings: recipe.settings
        })

        if (!cancelled) {
          setPreviewData(processed)
        }
      } catch (err) {
        console.error('Failed to generate preview:', err)
      } finally {
        if (!cancelled) {
          setIsGenerating(false)
        }
      }
    }

    // Небольшая задержка для приоритизации UI
    const timeoutId = setTimeout(generatePreview, 50)

    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [recipe, smallImage, imageKey])

  useEffect(() => {
    if (!previewData || !canvasRef.current) return

    const canvas = canvasRef.current
    canvas.width = previewData.width
    canvas.height = previewData.height

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.putImageData(previewData, 0, 0)
  }, [previewData])

  return (
    <Card
      className={`cursor-pointer transition-all hover:ring-2 hover:ring-primary overflow-hidden ${
        isActive ? 'ring-2 ring-primary' : ''
      }`}
      onClick={onClick}
    >
      <div className="aspect-square bg-black relative">
        {previewData ? (
          <canvas
            ref={canvasRef}
            className="w-full h-full object-cover"
            aria-label={recipe.name}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
          </div>
        )}
        {isGenerating && previewData && (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
          </div>
        )}
      </div>
      <div className="p-2">
        <h3 className="font-medium text-xs truncate">{recipe.name}</h3>
        <p className="text-[10px] text-zinc-500 truncate">{getSimulationName(recipe.filmSimulation)}</p>
      </div>
    </Card>
  )
}

// Мемоизируем компонент для предотвращения лишних ререндеров
export const RecipeCard = memo(RecipeCardComponent, (prevProps, nextProps) => {
  // Перерисовываем только если изменился рецепт, активность или изображение
  return (
    prevProps.recipe.id === nextProps.recipe.id &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.sourceImage === nextProps.sourceImage
  )
})
