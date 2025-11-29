import { useEffect, useRef, useState, memo } from 'react'
import { Heart } from 'lucide-react'
import { Card } from './ui/card'
import { Recipe } from '../engine/types'
import { ImageProcessor } from '../engine/processor'
import { getSimulation } from '../presets/simulations'
import { 
  RECIPE_CARD_PREVIEW_SIZE, 
  PREVIEW_GENERATION_DELAY,
  PREVIEW_CACHE_MAX_SIZE,
  SMALL_IMAGE_CACHE_MAX_SIZE
} from '../constants'

interface RecipeCardProps {
  recipe: Recipe
  sourceImage: ImageData
  isActive?: boolean
  isFavorite?: boolean
  onFavoriteToggle?: (recipeId: string) => void
  onClick: () => void
}

/**
 * Кэш для уменьшенных изображений.
 * Ключ: строка вида "width_height_samplePixels"
 * Значение: уменьшенное ImageData
 */
const smallImageCache = new Map<string, ImageData>()

/**
 * Кэш для обработанных превью.
 * Ключ: строка вида "recipeId_imageKey"
 * Значение: обработанное ImageData
 */
const processedPreviewCache = new Map<string, ImageData>()

/**
 * Создаёт уникальный ключ для кэширования на основе imageData.
 * Использует размеры и сэмпл пикселей для быстрого хэша.
 */
function getImageKey(imageData: ImageData): string {
  const data = imageData.data
  const sample = [
    data[0],
    data[Math.min(100, data.length - 1)],
    data[Math.max(0, data.length - 100)],
    data[data.length - 1]
  ].join(',')
  return `${imageData.width}x${imageData.height}_${sample}`
}

/**
 * Создаёт уменьшенное изображение для превью с кэшированием.
 * Переиспользует canvas для уменьшения аллокаций памяти.
 */
function createSmallImage(sourceImage: ImageData): ImageData | null {
  const cacheKey = getImageKey(sourceImage)
  
  // Проверяем кэш
  const cached = smallImageCache.get(cacheKey)
  if (cached) return cached

  const scale = Math.min(
    RECIPE_CARD_PREVIEW_SIZE / sourceImage.width,
    RECIPE_CARD_PREVIEW_SIZE / sourceImage.height
  )
  const width = Math.round(sourceImage.width * scale)
  const height = Math.round(sourceImage.height * scale)

  // Используем один canvas для обеих операций
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null

  // Рисуем исходное изображение
  canvas.width = sourceImage.width
  canvas.height = sourceImage.height
  ctx.putImageData(sourceImage, 0, 0)

  // Создаём уменьшенную версию
  const smallCanvas = document.createElement('canvas')
  smallCanvas.width = width
  smallCanvas.height = height
  const smallCtx = smallCanvas.getContext('2d', { willReadFrequently: true })
  if (!smallCtx) return null

  smallCtx.drawImage(canvas, 0, 0, width, height)
  const result = smallCtx.getImageData(0, 0, width, height)

  // Сохраняем в кэш
  if (smallImageCache.size >= SMALL_IMAGE_CACHE_MAX_SIZE) {
    // Удаляем первый элемент (FIFO)
    const firstKey = smallImageCache.keys().next().value
    if (firstKey) smallImageCache.delete(firstKey)
  }
  smallImageCache.set(cacheKey, result)

  return result
}

function RecipeCardComponent({ 
  recipe, 
  sourceImage, 
  isActive, 
  isFavorite = false,
  onFavoriteToggle,
  onClick 
}: RecipeCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [previewData, setPreviewData] = useState<ImageData | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent card click
    onFavoriteToggle?.(recipe.id)
  }

  useEffect(() => {
    let cancelled = false

    const generatePreview = () => {
      if (cancelled) return

      try {
        const imageKey = getImageKey(sourceImage)
        const cacheKey = `${recipe.id}_${imageKey}`

        // Проверяем кэш обработанных превью
        const cachedPreview = processedPreviewCache.get(cacheKey)
        if (cachedPreview) {
          setPreviewData(cachedPreview)
          setIsGenerating(false)
          return
        }

        setIsGenerating(true)

        const smallImage = createSmallImage(sourceImage)
        if (!smallImage || cancelled) {
          setIsGenerating(false)
          return
        }

        const simulation = getSimulation(recipe.filmSimulation)
        if (!simulation || cancelled) {
          setIsGenerating(false)
          return
        }

        const processed = ImageProcessor.process(smallImage, {
          simulation,
          settings: recipe.settings
        })

        if (!cancelled) {
          // Сохраняем в кэш
          if (processedPreviewCache.size >= PREVIEW_CACHE_MAX_SIZE) {
            const firstKey = processedPreviewCache.keys().next().value
            if (firstKey) processedPreviewCache.delete(firstKey)
          }
          processedPreviewCache.set(cacheKey, processed)
          
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
    const timeoutId = setTimeout(generatePreview, PREVIEW_GENERATION_DELAY)

    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [recipe, sourceImage])

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
      className={`cursor-pointer transition-all hover:ring-2 hover:ring-primary overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
        isActive ? 'ring-2 ring-primary' : ''
      }`}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      tabIndex={0}
      role="button"
      aria-pressed={isActive}
      aria-label={`Применить рецепт ${recipe.name}${isActive ? ', выбран' : ''}`}
    >
      <div className="aspect-square bg-black relative">
        {previewData ? (
          <canvas
            ref={canvasRef}
            className="w-full h-full object-cover"
            aria-hidden="true"
          />
        ) : (
          <div 
            className="w-full h-full flex items-center justify-center"
            role="status"
            aria-label="Загрузка превью"
          >
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
          </div>
        )}
        {isGenerating && previewData && (
          <div 
            className="absolute inset-0 bg-black/30 flex items-center justify-center"
            role="status"
            aria-label="Обновление превью"
          >
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
          </div>
        )}
        
        {/* Favorite heart button */}
        <button
          type="button"
          onClick={handleFavoriteClick}
          className={`
            absolute top-1.5 right-1.5 p-1 rounded-full
            transition-all duration-200
            ${isFavorite 
              ? 'bg-red-500 text-white shadow-lg' 
              : 'bg-black/40 text-white/70 hover:bg-black/60 hover:text-white'
            }
          `}
          aria-label={isFavorite ? 'Удалить из избранного' : 'Добавить в избранное'}
          aria-pressed={isFavorite}
        >
          <Heart 
            className={`w-3 h-3 ${isFavorite ? 'fill-current' : ''}`} 
          />
        </button>
      </div>
      <div className="p-2">
        <h3 className="font-medium text-xs truncate">{recipe.name}</h3>
      </div>
    </Card>
  )
}

// Мемоизируем компонент для предотвращения лишних ререндеров
export const RecipeCard = memo(RecipeCardComponent, (prevProps, nextProps) => {
  // Перерисовываем только если изменились важные пропсы
  return (
    prevProps.recipe.id === nextProps.recipe.id &&
    prevProps.isActive === nextProps.isActive &&
    prevProps.isFavorite === nextProps.isFavorite &&
    prevProps.sourceImage === nextProps.sourceImage
  )
})
