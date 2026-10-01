import { useEffect, useRef, useState, memo } from 'react'
import { Heart } from 'lucide-react'
import { Spinner } from './ui/spinner'
import { Card } from './ui/card'
import { Recipe } from '../engine/types'
import { ImageProcessor } from '../engine/processor'
import { usePreviewVisibility } from '../hooks/usePreviewVisibility'
import { resizePreviewImage, processedPreviewCache } from '../engine/preview-image'
import { getImageKey } from '../engine/image-identity'
import { prepareProcessingPlan } from '../engine/processing-plan'
import { 
  RECIPE_CARD_PREVIEW_SIZE, 
  PREVIEW_GENERATION_DELAY,
  PREVIEW_CACHE_MAX_SIZE
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
  const cardRef = useRef<HTMLDivElement>(null)
  const visible = usePreviewVisibility(cardRef)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [previewData, setPreviewData] = useState<ImageData | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation() // Предотвращаем клик по карточке
    onFavoriteToggle?.(recipe.id)
  }

  useEffect(() => {
    setPreviewData(null)
    setIsGenerating(false)
    if (!visible) return
    let cancelled = false
    const controller = new AbortController()

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

        const smallImage = resizePreviewImage(sourceImage, RECIPE_CARD_PREVIEW_SIZE)
        if (!smallImage || cancelled) {
          setIsGenerating(false)
          return
        }

        const plan = await prepareProcessingPlan(recipe, smallImage, {}, { signal: controller.signal })
        if (cancelled) return

        const processed = ImageProcessor.process(
          smallImage,
          plan
        )

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
        if (!cancelled) console.error('Ошибка генерации превью:', err)
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
      controller.abort()
      clearTimeout(timeoutId)
    }
  }, [recipe, sourceImage, visible])

  useEffect(() => {
    if (!previewData || !canvasRef.current) return

    const canvas = canvasRef.current
    canvas.width = previewData.width
    canvas.height = previewData.height

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.putImageData(previewData, 0, 0)
    return () => { canvas.width = canvas.height = 0 }
  }, [previewData])

  return (
    <Card
      ref={cardRef}
      data-recipe-card
      className={`relative cursor-pointer overflow-hidden transition-all hover:ring-2 hover:ring-primary focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 ${
        isActive ? 'ring-2 ring-primary' : ''
      }`}
    >
      <button
        type="button"
        className="absolute inset-0 z-10 rounded-lg focus-visible:outline-none"
        onClick={onClick}
        aria-pressed={isActive}
        aria-label={`Apply preset ${recipe.name}${isActive ? ', selected' : ''}`}
      />
      <div className={`bg-black relative ${largeTouchTargets ? 'aspect-[4/3]' : 'aspect-square'}`}>
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
            {visible && <Spinner className="size-4" randomColor />}
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
              absolute z-20 rounded-full transition-all duration-200
              ${largeTouchTargets 
                ? 'top-0 right-0 size-11 flex items-center justify-center bg-transparent'
                : 'top-1.5 right-1.5 p-1'
              }
              ${largeTouchTargets ? 'text-white/80 hover:text-white' : isFavorite
                ? 'bg-zinc-700 text-white shadow-lg'
                : 'bg-black/40 text-white/70 hover:bg-black/60 hover:text-white'
              }
            `}
            aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
            aria-pressed={isFavorite}
          >
            <span className={largeTouchTargets ? `flex size-7 items-center justify-center rounded-full ${isFavorite ? 'bg-zinc-700 text-white' : 'bg-black/50'}` : undefined}>
              <Heart
                className={`${largeTouchTargets ? 'w-4 h-4' : 'w-3 h-3'} ${isFavorite ? 'fill-current' : ''}`}
                aria-hidden="true"
              />
            </span>
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
export const RecipeCard = memo(RecipeCardComponent)
