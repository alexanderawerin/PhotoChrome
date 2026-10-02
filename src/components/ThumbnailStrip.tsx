import { useRef, useEffect } from 'react'
import { Film } from 'lucide-react'
import { ImageItem, Recipe, RecipeSettings } from '../engine/types'
import { ImageProcessor } from '../engine/processor'
import { usePreviewVisibility } from '../hooks/usePreviewVisibility'
import { resizePreviewImage } from '../engine/preview-image'
import { prepareProcessingPlan } from '../engine/processing-plan'

interface ThumbnailStripProps {
  images: ImageItem[]
  currentIndex: number
  onSelectImage: (index: number) => void
}

/**
 * Горизонтальная полоса миниатюр для навигации между изображениями (десктоп)
 */
export function ThumbnailStrip({ images, currentIndex, onSelectImage }: ThumbnailStripProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // Авто-скролл к текущей миниатюре
  useEffect(() => {
    if (!scrollContainerRef.current) return

    const container = scrollContainerRef.current
    const thumbnail = container.children[currentIndex] as HTMLElement

    if (thumbnail && container.clientWidth > 0) {
      const bounds = thumbnail.getBoundingClientRect()
      const viewport = container.getBoundingClientRect()
      if (bounds.left < viewport.left || bounds.right > viewport.right) container.scrollBy({
        left: bounds.left - viewport.left - (container.clientWidth - bounds.width) / 2,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      })
    }
  }, [currentIndex])

  if (images.length <= 1) {
    return null
  }

  return (
    <div className="w-full bg-transparent p-2">
      <div
        ref={scrollContainerRef}
        className="flex gap-2 overflow-x-auto scrollbar-hide"
        role="tablist"
        aria-label="Image thumbnails"
      >
        {images.map((image, index) => (
          <button
            key={image.id}
            role="tab"
            aria-selected={index === currentIndex}
            aria-label={`Image ${index + 1} of ${images.length}: ${image.fileName}`}
            onClick={() => onSelectImage(index)}
            className={`
              relative flex-shrink-0 w-11 h-11 rounded-lg overflow-hidden
              border-2 transition-all
              ${index === currentIndex
                ? 'border-white scale-105'
                : 'border-zinc-700 opacity-60 hover:opacity-100'
              }
            `}
          >
            {/* Рендерим миниатюру с применённым рецептом, если есть */}
            <ThumbnailPreview
              imageData={image.transformedThumbnail}
              recipe={image.recipe}
              customSettings={image.customSettings}
            />

            {/* Индикатор применённого рецепта */}
            {image.recipe && (
              <div className="absolute bottom-0 left-0 right-0 bg-zinc-900/80 px-0.5 py-0.5 flex items-center justify-center">
                <Film className="w-2 h-2 text-white" />
              </div>
            )}
          </button>
        ))}
      </div>

    </div>
  )
}

/**
 * Компонент для отображения миниатюры ImageData с применённым рецептом
 */
function ThumbnailPreview({
  imageData,
  recipe,
  customSettings
}: {
  imageData: ImageData
  recipe: Recipe | null
  customSettings: RecipeSettings
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const visible = usePreviewVisibility(canvasRef)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    canvas.width = canvas.height = 1
    if (!visible) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const controller = new AbortController()
    // An empty thumbnail while waiting cannot be mistaken for an applied film.
    const render = async () => {
      try {
        const smallImage = resizePreviewImage(imageData, Math.round(44 * Math.min(2, Math.max(1, window.devicePixelRatio))))
        const plan = recipe
          ? await prepareProcessingPlan(recipe, smallImage, customSettings, { signal: controller.signal })
          : null
        if (controller.signal.aborted) return
        const processedData = plan ? ImageProcessor.process(smallImage, plan) : smallImage
        canvas.width = processedData.width
        canvas.height = processedData.height
        ctx.putImageData(processedData, 0, 0)
      } catch {
        // Main preview owns actionable resource errors and Retry.
      }
    }
    void render()
    return () => { controller.abort(); canvas.width = canvas.height = 0 }
  }, [imageData, recipe, customSettings, visible])

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full object-cover"
      style={{ imageRendering: 'auto' }}
      aria-hidden="true"
    />
  )
}
