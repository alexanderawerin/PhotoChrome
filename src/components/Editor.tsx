import { useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Button } from './ui/button'
import { Preview } from './Preview'
import { RecipePanel } from './RecipePanel'
import { ExportButton } from './ExportButton'
import { Toolbar } from './Toolbar'
import { CropTool } from './CropTool'
import { Recipe } from '../engine/types'
import { ImageProcessor } from '../engine/processor'
import { getSimulation } from '../presets/simulations'
import { rotateImage, cropImage, calculateCropArea, RotationAngle, AspectRatio } from '../engine/transform'

interface EditorProps {
  originalImage: ImageData
  thumbnail: ImageData
  fileName: string
  onBack: () => void
}

export function Editor({ originalImage, thumbnail, fileName, onBack }: EditorProps) {
  const [previewImage, setPreviewImage] = useState<ImageData>(thumbnail)
  const [activeRecipe, setActiveRecipe] = useState<Recipe | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [rotation, setRotation] = useState<RotationAngle>(0)
  const [isCropping, setIsCropping] = useState(false)
  
  // Трансформированные изображения
  const [transformedOriginal, setTransformedOriginal] = useState<ImageData>(originalImage)
  const [transformedThumbnail, setTransformedThumbnail] = useState<ImageData>(thumbnail)

  const handleRecipeSelect = async (recipe: Recipe) => {
    setActiveRecipe(recipe)
    setIsProcessing(true)

    try {
      const simulation = getSimulation(recipe.filmSimulation)
      if (!simulation) {
        console.error(`Simulation ${recipe.filmSimulation} not found`)
        return
      }

      // Обрабатываем трансформированный thumbnail для быстрого preview
      const processed = ImageProcessor.process(transformedThumbnail, {
        simulation,
        settings: recipe.settings
      })

      setPreviewImage(processed)
    } catch (err) {
      console.error('Failed to process image:', err)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRotateClockwise = () => {
    const newRotation = ((rotation + 90) % 360) as RotationAngle
    setRotation(newRotation)
    
    const rotatedOriginal = rotateImage(transformedOriginal, 90)
    const rotatedThumbnail = rotateImage(transformedThumbnail, 90)
    
    setTransformedOriginal(rotatedOriginal)
    setTransformedThumbnail(rotatedThumbnail)
    
    // Переприменяем рецепт если активен
    if (activeRecipe) {
      const simulation = getSimulation(activeRecipe.filmSimulation)
      if (simulation) {
        const processed = ImageProcessor.process(rotatedThumbnail, {
          simulation,
          settings: activeRecipe.settings
        })
        setPreviewImage(processed)
      }
    } else {
      setPreviewImage(rotatedThumbnail)
    }
  }

  const handleRotateCounterClockwise = () => {
    const newRotation = ((rotation - 90 + 360) % 360) as RotationAngle
    setRotation(newRotation)
    
    const rotatedOriginal = rotateImage(transformedOriginal, 270)
    const rotatedThumbnail = rotateImage(transformedThumbnail, 270)
    
    setTransformedOriginal(rotatedOriginal)
    setTransformedThumbnail(rotatedThumbnail)
    
    // Переприменяем рецепт если активен
    if (activeRecipe) {
      const simulation = getSimulation(activeRecipe.filmSimulation)
      if (simulation) {
        const processed = ImageProcessor.process(rotatedThumbnail, {
          simulation,
          settings: activeRecipe.settings
        })
        setPreviewImage(processed)
      }
    } else {
      setPreviewImage(rotatedThumbnail)
    }
  }

  const handleCropClick = () => {
    setIsCropping(true)
  }

  const handleCropApply = (aspectRatio: AspectRatio) => {
    if (aspectRatio === 'free') {
      setIsCropping(false)
      return
    }

    const cropArea = calculateCropArea(
      transformedOriginal.width,
      transformedOriginal.height,
      aspectRatio
    )

    const croppedOriginal = cropImage(transformedOriginal, cropArea)
    const croppedThumbnail = cropImage(transformedThumbnail, cropArea)

    setTransformedOriginal(croppedOriginal)
    setTransformedThumbnail(croppedThumbnail)

    // Переприменяем рецепт если активен
    if (activeRecipe) {
      const simulation = getSimulation(activeRecipe.filmSimulation)
      if (simulation) {
        const processed = ImageProcessor.process(croppedThumbnail, {
          simulation,
          settings: activeRecipe.settings
        })
        setPreviewImage(processed)
      }
    } else {
      setPreviewImage(croppedThumbnail)
    }

    setIsCropping(false)
  }

  const handleCropCancel = () => {
    setIsCropping(false)
  }

  const handleExport = async () => {
    if (!activeRecipe) return

    try {
      const simulation = getSimulation(activeRecipe.filmSimulation)
      if (!simulation) return

      // Обрабатываем трансформированное полное изображение
      const processed = ImageProcessor.process(transformedOriginal, {
        simulation,
        settings: activeRecipe.settings
      })

      // Экспортируем
      const blob = await ImageProcessor.imageDataToBlob(processed)
      const url = URL.createObjectURL(blob)

      const a = document.createElement('a')
      a.href = url
      a.download = `photochrome_${activeRecipe.id}_${fileName}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to export:', err)
    }
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">Photochrome</h1>
              <p className="text-sm text-muted-foreground">{fileName}</p>
            </div>
          </div>
          <ExportButton onExport={handleExport} disabled={!activeRecipe} />
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 flex overflow-hidden">
          {/* Preview area */}
          <div className="flex-1 p-4 flex items-center justify-center bg-zinc-950 relative">
            {isCropping && (
              <CropTool onApply={handleCropApply} onCancel={handleCropCancel} />
            )}
            <div className="max-w-4xl w-full">
              {isProcessing && (
                <div className="text-center mb-4">
                  <p className="text-sm text-muted-foreground">Обработка...</p>
                </div>
              )}
              <Preview imageData={previewImage} />
              {activeRecipe && (
                <div className="mt-4 text-center">
                  <p className="text-sm font-medium">{activeRecipe.name}</p>
                  {activeRecipe.author && (
                    <p className="text-xs text-muted-foreground">{activeRecipe.author}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Recipe panel */}
          <aside className="w-80 border-l border-border bg-background">
            <RecipePanel
              sourceImage={transformedThumbnail}
              activeRecipeId={activeRecipe?.id ?? null}
              onRecipeSelect={handleRecipeSelect}
            />
          </aside>
        </div>

        {/* Toolbar */}
        <Toolbar
          onRotateClockwise={handleRotateClockwise}
          onRotateCounterClockwise={handleRotateCounterClockwise}
          onCropClick={handleCropClick}
        />
      </div>
    </div>
  )
}

