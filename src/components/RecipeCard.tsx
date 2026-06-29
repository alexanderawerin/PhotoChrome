import { useEffect, useRef, useState, memo } from 'react'
import { Heart } from 'lucide-react'
import { Spinner } from './ui/spinner'
import { Card } from './ui/card'
import { Recipe } from '../engine/types'
import { ImageProcessor } from '../engine/processor'
import { getSimulation, loadSimulationLUT } from '../presets/simulations'
import { 
  RECIPE_CARD_PREVIEW_SIZE, 
  PREVIEW_GENERATION_DELAY,
  PREVIEW_CACHE_MAX_SIZE,
  SMALL_IMAGE_CACHE_MAX_SIZE,
  IMAGE_HASH_SAMPLE_COUNT
} from '../constants'

interface RecipeCardProps {
  recipe: Recipe
  sourceImage: ImageData
  isActive?: boolean
  isFavorite?: boolean
  onFavoriteToggle?: (recipeId: string) => void
  onClick: () => void
  hideFavoriteButton?: boolean
  /** Use larger touch targets for mobile */
  largeTouchTargets?: boolean
}

/**
 * Кэш для уменьшенных изображений.
 * Ключ: строка вида "width_height_hash"
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
 * Переиспользуемые canvas элементы для уменьшения аллокаций памяти.
 * Создаются лениво при первом использовании.
 */
let reusableSourceCanvas: HTMLCanvasElement | null = null
let reusableSourceCtx: CanvasRenderingContext2D | null = null
let reusableTargetCanvas: HTMLCanvasElement | null = null
let reusableTargetCtx: CanvasRenderingContext2D | null = null

/**
 * Создаёт уникальный ключ для кэширования на основе imageData.
 * Использует размеры и множественные сэмплы пикселей для надёжного хэша.
 * 
 * Алгоритм: берём IMAGE_HASH_SAMPLE_COUNT точек равномерно распределённых
 * по данным изображения и комбинируем их в строку.
 */
function getImageKey(imageData: ImageData): string {
  const data = imageData.data
  const len = data.length
  
  // Равномерно распределённые точки для сэмплирования
  const samples: number[] = []
  const step = Math.max(1, Math.floor(len / IMAGE_HASH_SAMPLE_COUNT))
  
  for (let i = 0; i < IMAGE_HASH_SAMPLE_COUNT; i++) {
    const idx = Math.min(i * step, len - 1)
    samples.push(data[idx])
  }
  
  return `${imageData.width}x${imageData.height}_${samples.join(',')}`
}

/**
 * Инициализирует переиспользуемые canvas элементы.
 * Вызывается лениво при первой необходимости.
 */
function ensureCanvasElements(): boolean {
  if (!reusableSourceCanvas) {
    reusableSourceCanvas = document.createElement('canvas')
    reusableSourceCtx = reusableSourceCanvas.getContext('2d', { willReadFrequently: true })
  }
  if (!reusableTargetCanvas) {
    reusableTargetCanvas = document.createElement('canvas')
    reusableTargetCtx = reusableTargetCanvas.getContext('2d', { willReadFrequently: true })
  }
  return !!(reusableSourceCtx && reusableTargetCtx)
}

/**
 * Создаёт уменьшенное изображение для превью с кэшированием.
 * Переиспользует canvas элементы для уменьшения аллокаций памяти.
 */
function createSmallImage(sourceImage: ImageData): ImageData | null {
  const cacheKey = getImageKey(sourceImage)
  
  // Проверяем кэш
  const cached = smallImageCache.get(cacheKey)
  if (cached) return cached

  // Инициализируем canvas элементы при необходимости
  if (!ensureCanvasElements()) return null

  const scale = Math.min(
    RECIPE_CARD_PREVIEW_SIZE / sourceImage.width,
    RECIPE_CARD_PREVIEW_SIZE / sourceImage.height
  )
  const width = Math.round(sourceImage.width * scale)
  const height = Math.round(sourceImage.height * scale)

  // Устанавливаем размеры source canvas и рисуем исходное изображение
  reusableSourceCanvas!.width = sourceImage.width
  reusableSourceCanvas!.height = sourceImage.height
  reusableSourceCtx!.putImageData(sourceImage, 0, 0)

  // Устанавливаем размеры target canvas и масштабируем
  reusableTargetCanvas!.width = width
  reusableTargetCanvas!.height = height
  reusableTargetCtx!.drawImage(reusableSourceCanvas!, 0, 0, width, height)
  
  const result = reusableTargetCtx!.getImageData(0, 0, width, height)

  // Сохраняем в кэш с FIFO-вытеснением
  if (smallImageCache.size >= SMALL_IMAGE_CACHE_MAX_SIZE) {
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
  onClick,
  hideFavoriteButton = false,
  largeTouchTargets = false
}: RecipeCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [previewData, setPreviewData] = useState<ImageData | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation() // Предотвращаем клик по карточке
    onFavoriteToggle?.(recipe.id)
  }

  useEffect(() => {
    let cancelled = false

    const generatePreview = async () => {
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

        await loadSimulationLUT(recipe.filmSimulation)
        if (cancelled) return

        const processed = ImageProcessor.process(smallImage, {
          simulation,
          settings: recipe.settings
        })

        if (!cancelled) {
          // Сохраняем в кэш с FIFO-вытеснением
          if (processedPreviewCache.size >= PREVIEW_CACHE_MAX_SIZE) {
            const firstKey = processedPreviewCache.keys().next().value
            if (firstKey) processedPreviewCache.delete(firstKey)
          }
          processedPreviewCache.set(cacheKey, processed)
          
          setPreviewData(processed)
        }
      } catch (err) {
        console.error('Ошибка генерации превью:', err)
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
      aria-label={`Apply preset ${recipe.name}${isActive ? ', selected' : ''}`}
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
            aria-label="Loading preview"
          >
            <Spinner className="size-4" randomColor />
          </div>
        )}
        {isGenerating && previewData && (
          <div 
            className="absolute inset-0 bg-black/30 flex items-center justify-center"
            role="status"
            aria-label="Updating preview"
          >
            <Spinner className="size-3" randomColor />
          </div>
        )}
        
        {/* Кнопка избранного */}
        {!hideFavoriteButton && (
          <button
            type="button"
            onClick={handleFavoriteClick}
            className={`
              absolute rounded-full transition-all duration-200
              ${largeTouchTargets 
                ? 'top-1 right-1 p-1.5' 
                : 'top-1.5 right-1.5 p-1'
              }
              ${isFavorite 
                ? 'bg-zinc-700 text-white shadow-lg' 
                : 'bg-black/40 text-white/70 hover:bg-black/60 hover:text-white'
              }
            `}
            aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            aria-pressed={isFavorite}
          >
            <Heart
              className={`${largeTouchTargets ? 'w-4 h-4' : 'w-3 h-3'} ${isFavorite ? 'fill-current' : ''}`}
              aria-hidden="true"
            />
          </button>
        )}
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
    prevProps.sourceImage === nextProps.sourceImage &&
    prevProps.hideFavoriteButton === nextProps.hideFavoriteButton &&
    prevProps.largeTouchTargets === nextProps.largeTouchTargets
  )
})
