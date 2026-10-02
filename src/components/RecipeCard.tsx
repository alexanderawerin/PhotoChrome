import { useEffect, useRef, useState, memo } from 'react'
import { Circle, Heart } from 'lucide-react'
import { Spinner } from './ui/spinner'
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
  isFavorite: boolean
  onFavoriteToggle: (recipeId: string) => void
  onClick: () => void
  compact?: boolean
}

function RecipeCardComponent({ 
  recipe, 
  sourceImage, 
  isActive, 
  isFavorite,
  onFavoriteToggle,
  onClick,
  compact = false,
}: RecipeCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const visible = usePreviewVisibility(cardRef)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [previewData, setPreviewData] = useState<ImageData | null>(null)
  const [previewError, setPreviewError] = useState(false)

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.stopPropagation() // Предотвращаем клик по карточке
    onFavoriteToggle(recipe.id)
  }

  useEffect(() => {
    setPreviewData(null)
    setPreviewError(false)
    if (!visible) return
    let cancelled = false
    const controller = new AbortController()

    const generatePreview = async () => {
      if (cancelled) return

      try {
        const imageKey = getImageKey(sourceImage)
        const size = compact
          ? Math.round(92 * Math.min(2, Math.max(1, window.devicePixelRatio || 1)))
          : RECIPE_CARD_PREVIEW_SIZE
        const cacheKey = `recipes/${recipe.id}/${imageKey}/${size}`

        // Проверяем кэш обработанных превью
        const cachedPreview = processedPreviewCache.get(cacheKey)
        if (cachedPreview) {
          setPreviewData(cachedPreview)
          return
        }

        const smallImage = resizePreviewImage(sourceImage, size)
        if (!smallImage || cancelled) {
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
      } catch {
        if (!cancelled) setPreviewError(true)
      }
    }

    // Небольшая задержка для приоритизации UI
    const timeoutId = setTimeout(generatePreview, PREVIEW_GENERATION_DELAY)

    return () => {
      cancelled = true
      controller.abort()
      clearTimeout(timeoutId)
    }
  }, [recipe, sourceImage, visible, compact])

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

  if (compact) {
    return (
      <div ref={cardRef} data-recipe-card className="editor-recipe-option">
        <button type="button" className="film-option" onClick={onClick}
          aria-pressed={isActive} aria-label={`Apply preset ${recipe.name}${isActive ? ', selected' : ''}`}>
          {isActive && <Circle className="film-selected-marker" aria-hidden="true" fill="currentColor" />}
          <span className="film-thumbnail" data-preview-state={previewError ? 'error' : previewData ? 'ready' : visible ? 'loading' : 'idle'}>
            {previewData && <canvas ref={canvasRef} className="film-thumbnail-canvas" aria-hidden="true" />}
            {!previewData && <span className="film-thumbnail-state" aria-hidden={previewError ? undefined : true}>
              {previewError ? 'Preview unavailable' : visible && <Spinner className="size-3" />}
            </span>}
          </span>
          <span className="film-label">{recipe.name}</span>
        </button>
        <button type="button" onClick={handleFavoriteClick}
          className="editor-recipe-favorite grid size-11 place-items-center rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'} aria-pressed={isFavorite}>
          <Heart className={`size-4 ${isFavorite ? 'fill-current' : ''}`} aria-hidden="true" />
        </button>
      </div>
    )
  }

  return (
    <div
      ref={cardRef}
      data-recipe-card
      className={`relative overflow-hidden rounded-lg bg-zinc-900 text-white focus-within:ring-2 focus-within:ring-primary ${
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
      <div className="relative aspect-[4/3] bg-black">
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
            aria-label={previewError ? 'Preview unavailable' : 'Loading preview'}
          >
            {previewError ? 'Preview unavailable' : visible && <Spinner className="size-4" />}
          </div>
        )}
        <button type="button" onClick={handleFavoriteClick}
          className="absolute right-0 top-0 z-20 grid size-11 place-items-center rounded-lg bg-black/60 text-white hover:bg-black/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white"
          aria-label={isFavorite ? 'Remove from favorites' : 'Add to favorites'} aria-pressed={isFavorite}>
          <Heart className={`size-4 ${isFavorite ? 'fill-current' : ''}`} aria-hidden="true" />
        </button>
      </div>
      <div className="p-2">
        <h3 className="font-medium text-xs truncate">{recipe.name}</h3>
      </div>
    </div>
  )
}

// Мемоизируем компонент для предотвращения лишних ререндеров
export const RecipeCard = memo(RecipeCardComponent)
