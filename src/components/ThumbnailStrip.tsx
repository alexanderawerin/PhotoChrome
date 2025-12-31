import { useRef, useEffect } from 'react'
import { Film } from 'lucide-react'
import { ImageItem, Recipe, RecipeSettings } from '../engine/types'
import { ImageProcessor } from '../engine/processor'
import { getSimulation } from '../presets/simulations'

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

    if (thumbnail) {
      thumbnail.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
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
        className="flex gap-2 overflow-x-auto scrollbar-hide justify-center"
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
              relative flex-shrink-0 w-10 h-10 rounded-lg overflow-hidden
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

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Применяем рецепт, если он есть
    let processedData = imageData
    if (recipe) {
      const simulation = getSimulation(recipe.filmSimulation)
      if (simulation) {
        const mergedSettings = { ...recipe.settings, ...customSettings }
        processedData = ImageProcessor.process(imageData, {
          simulation,
          settings: mergedSettings
        })
      }
    }

    canvas.width = processedData.width
    canvas.height = processedData.height
    ctx.putImageData(processedData, 0, 0)
  }, [imageData, recipe, customSettings])

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full object-cover"
      style={{ imageRendering: 'auto' }}
    />
  )
}
