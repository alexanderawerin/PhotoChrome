import { useState, useCallback, useEffect } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Button } from './ui/button'
import { Preview } from './Preview'
import { RecipePanel } from './RecipePanel'
import { Toolbar } from './Toolbar'
import { Recipe } from '../engine/types'
import { ImageProcessor } from '../engine/processor'
import { getSimulation } from '../presets/simulations'
import { getAllRecipes } from '../presets/recipes'
import { rotateImage, cropImage, calculateCropArea, AspectRatio } from '../engine/transform'
import { useFavorites } from '../hooks/useFavorites'

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
  const [isExporting, setIsExporting] = useState(false)
  const [isCropping, setIsCropping] = useState(false)
  const [cropRatio, setCropRatio] = useState<AspectRatio>('1:1')
  const [showOriginal, setShowOriginal] = useState(false)
  
  // Трансформированные изображения
  const [transformedOriginal, setTransformedOriginal] = useState<ImageData>(originalImage)
  const [transformedThumbnail, setTransformedThumbnail] = useState<ImageData>(thumbnail)

  // Избранные рецепты
  const { getFavoriteIds, toggleFavorite } = useFavorites()

  // Проверка, были ли изменения (для кнопки сброса)
  const hasChanges = transformedOriginal !== originalImage || transformedThumbnail !== thumbnail || activeRecipe !== null

  /**
   * Применяет текущий рецепт к изображению
   */
  const applyRecipeToImage = useCallback((
    imageData: ImageData,
    recipe: Recipe | null
  ): ImageData => {
    if (!recipe) return imageData

    const simulation = getSimulation(recipe.filmSimulation)
    if (!simulation) {
      console.error(`Simulation ${recipe.filmSimulation} not found`)
      return imageData
    }

    return ImageProcessor.process(imageData, {
      simulation,
      settings: recipe.settings
    })
  }, [])

  /**
   * Обновляет превью с текущим рецептом
   */
  const updatePreview = useCallback((thumbData: ImageData, recipe: Recipe | null = activeRecipe) => {
    if (recipe) {
      const processed = applyRecipeToImage(thumbData, recipe)
      setPreviewImage(processed)
    } else {
      setPreviewImage(thumbData)
    }
  }, [activeRecipe, applyRecipeToImage])

  /**
   * Выбор рецепта
   */
  const handleRecipeSelect = useCallback(async (recipe: Recipe) => {
    setActiveRecipe(recipe)
    setIsProcessing(true)

    try {
      updatePreview(transformedThumbnail, recipe)
    } finally {
      setIsProcessing(false)
    }
  }, [transformedThumbnail, updatePreview])

  /**
   * Случайный рецепт
   */
  const handleRandomRecipe = useCallback(() => {
    const recipes = getAllRecipes()
    const availableRecipes = activeRecipe 
      ? recipes.filter(r => r.id !== activeRecipe.id)
      : recipes
    
    if (availableRecipes.length > 0) {
      const randomIndex = Math.floor(Math.random() * availableRecipes.length)
      handleRecipeSelect(availableRecipes[randomIndex])
    }
  }, [activeRecipe, handleRecipeSelect])

  /**
   * Поворот изображения
   */
  const handleRotate = useCallback((angle: 90 | 270) => {
    const rotatedOriginal = rotateImage(transformedOriginal, angle)
    const rotatedThumbnail = rotateImage(transformedThumbnail, angle)
    
    setTransformedOriginal(rotatedOriginal)
    setTransformedThumbnail(rotatedThumbnail)
    updatePreview(rotatedThumbnail)
  }, [transformedOriginal, transformedThumbnail, updatePreview])

  const handleRotateClockwise = useCallback(() => handleRotate(90), [handleRotate])
  const handleRotateCounterClockwise = useCallback(() => handleRotate(270), [handleRotate])

  /**
   * Crop
   */
  const handleCropClick = useCallback(() => {
    setCropRatio('1:1')
    setIsCropping(true)
  }, [])

  const handleCropCancel = useCallback(() => {
    setIsCropping(false)
  }, [])

  const handleCropRatioChange = useCallback((ratio: AspectRatio) => {
    setCropRatio(ratio)
  }, [])

  const handleCropApply = useCallback(() => {
    if (cropRatio === 'free') {
      setIsCropping(false)
      return
    }

    // Вычисляем crop area отдельно для оригинала и thumbnail
    const cropAreaOriginal = calculateCropArea(
      transformedOriginal.width,
      transformedOriginal.height,
      cropRatio
    )
    const cropAreaThumbnail = calculateCropArea(
      transformedThumbnail.width,
      transformedThumbnail.height,
      cropRatio
    )

    const croppedOriginal = cropImage(transformedOriginal, cropAreaOriginal)
    const croppedThumbnail = cropImage(transformedThumbnail, cropAreaThumbnail)

    setTransformedOriginal(croppedOriginal)
    setTransformedThumbnail(croppedThumbnail)
    updatePreview(croppedThumbnail)
    setIsCropping(false)
  }, [cropRatio, transformedOriginal, transformedThumbnail, updatePreview])

  /**
   * Сброс к исходному изображению
   */
  const handleReset = useCallback(() => {
    setTransformedOriginal(originalImage)
    setTransformedThumbnail(thumbnail)
    setActiveRecipe(null)
    setPreviewImage(thumbnail)
  }, [originalImage, thumbnail])

  /**
   * Экспорт
   */
  const handleExport = useCallback(async () => {
    if (!activeRecipe) return

    setIsExporting(true)
    try {
      const processed = applyRecipeToImage(transformedOriginal, activeRecipe)
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
    } finally {
      setIsExporting(false)
    }
  }, [activeRecipe, transformedOriginal, fileName, applyRecipeToImage])

  /**
   * Сравнение до/после
   */
  const handleCompareStart = useCallback(() => setShowOriginal(true), [])
  const handleCompareEnd = useCallback(() => setShowOriginal(false), [])

  /**
   * Keyboard shortcuts
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      switch (e.key.toLowerCase()) {
        case 'r':
          if (!isCropping) {
            if (e.shiftKey) {
              handleRotateCounterClockwise()
            } else {
              handleRotateClockwise()
            }
          }
          break
        case 'c':
          if (!e.metaKey && !e.ctrlKey && !isCropping) {
            handleCropClick()
          }
          break
        case 'escape':
          if (isCropping) {
            handleCropCancel()
          }
          break
        case 'enter':
          if (isCropping && cropRatio !== 'free') {
            handleCropApply()
          }
          break
        case ' ':
          if (activeRecipe && !isCropping) {
            e.preventDefault()
            setShowOriginal(true)
          }
          break
        case 's':
          if ((e.metaKey || e.ctrlKey) && activeRecipe) {
            e.preventDefault()
            handleExport()
          }
          break
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        setShowOriginal(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [
    isCropping,
    cropRatio,
    activeRecipe,
    handleRotateClockwise,
    handleRotateCounterClockwise,
    handleCropClick,
    handleCropCancel,
    handleCropApply,
    handleExport
  ])

  const displayImage = showOriginal ? transformedThumbnail : previewImage

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Левый блок: фото + toolbar */}
      <div className="flex-1 flex flex-col bg-zinc-950 min-w-0">
        {/* Header внутри левого блока */}
        <header className="flex-shrink-0 p-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack} className="text-zinc-400 hover:text-white">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-lg font-semibold text-white">Photochrome</h1>
              <p className="text-xs text-zinc-500">{fileName}</p>
            </div>
          </div>
        </header>

        {/* Preview area */}
        <div className="flex-1 min-h-0 px-4 sm:px-6 relative">
          {isProcessing && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
              <p className="text-sm text-zinc-400 bg-zinc-900/80 px-3 py-1 rounded">Обработка...</p>
            </div>
          )}
          <Preview 
            imageData={displayImage}
            cropMode={isCropping}
            cropRatio={cropRatio}
            onMouseDown={handleCompareStart}
            onMouseUp={handleCompareEnd}
            onMouseLeave={handleCompareEnd}
          />
        </div>

        {/* Toolbar внутри левого блока */}
        <div className="flex-shrink-0 p-4">
          <Toolbar
            onRotateClockwise={handleRotateClockwise}
            onRotateCounterClockwise={handleRotateCounterClockwise}
            onCropClick={handleCropClick}
            onExport={handleExport}
            onReset={handleReset}
            canExport={!!activeRecipe}
            canReset={hasChanges}
            isExporting={isExporting}
            cropMode={isCropping}
            cropRatio={cropRatio}
            onCropRatioChange={handleCropRatioChange}
            onCropApply={handleCropApply}
            onCropCancel={handleCropCancel}
          />
        </div>
      </div>

      {/* Правый блок: пресеты */}
      <aside className="w-72 flex-shrink-0 border-l border-zinc-800 bg-zinc-900 overflow-hidden">
        <RecipePanel
          sourceImage={transformedThumbnail}
          activeRecipeId={activeRecipe?.id ?? null}
          favoriteIds={getFavoriteIds()}
          onRecipeSelect={handleRecipeSelect}
          onRandomRecipe={handleRandomRecipe}
          onFavoriteToggle={toggleFavorite}
        />
      </aside>
    </div>
  )
}
