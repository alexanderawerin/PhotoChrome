import { useEffect, useRef, useState } from 'react'
import { Card } from './ui/card'
import { Recipe } from '../engine/types'
import { ImageProcessor } from '../engine/processor'
import { getSimulation } from '../presets/simulations'

interface RecipeCardProps {
  recipe: Recipe
  sourceImage: ImageData
  isActive?: boolean
  onClick: () => void
}

export function RecipeCard({ recipe, sourceImage, isActive, onClick }: RecipeCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [previewData, setPreviewData] = useState<ImageData | null>(null)

  useEffect(() => {
    // Генерируем превью для этого рецепта
    const generatePreview = async () => {
      try {
        const simulation = getSimulation(recipe.filmSimulation)
        if (!simulation) return

        // Создаём очень маленький thumbnail для быстрого рендера
        const scale = Math.min(200 / sourceImage.width, 200 / sourceImage.height)
        const width = Math.round(sourceImage.width * scale)
        const height = Math.round(sourceImage.height * scale)

        // Создаём уменьшенную версию
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        // Рисуем исходное изображение
        const tempCanvas = document.createElement('canvas')
        tempCanvas.width = sourceImage.width
        tempCanvas.height = sourceImage.height
        const tempCtx = tempCanvas.getContext('2d')
        if (!tempCtx) return
        tempCtx.putImageData(sourceImage, 0, 0)

        ctx.drawImage(tempCanvas, 0, 0, width, height)
        const smallImage = ctx.getImageData(0, 0, width, height)

        // Применяем обработку
        const processed = ImageProcessor.process(smallImage, {
          simulation,
          settings: recipe.settings
        })

        setPreviewData(processed)
      } catch (err) {
        console.error('Failed to generate preview:', err)
      }
    }

    generatePreview()
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
      className={`cursor-pointer transition-all hover:ring-2 hover:ring-primary overflow-hidden ${
        isActive ? 'ring-2 ring-primary' : ''
      }`}
      onClick={onClick}
    >
      <div className="aspect-square bg-black">
        {previewData ? (
          <canvas
            ref={canvasRef}
            className="w-full h-full object-cover"
            aria-label={recipe.name}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="font-medium text-sm truncate">{recipe.name}</h3>
        {recipe.author && (
          <p className="text-xs text-muted-foreground truncate">{recipe.author}</p>
        )}
      </div>
    </Card>
  )
}

