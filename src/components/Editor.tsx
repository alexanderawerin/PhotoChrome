import { useState, useCallback, useEffect, useLayoutEffect } from 'react'
import { ArrowLeft, PanelRightClose, PanelRightOpen } from 'lucide-react'
import { APP_VERSION, APP_URL } from '../constants'
import { Button } from './ui/button'
import { Preview } from './Preview'
import { RecipePanel } from './RecipePanel'
import { TuningPanel } from './TuningPanel'
import { CropPanel } from './CropPanel'
import { Toolbar } from './Toolbar'
import { Recipe, RecipeSettings } from '../engine/types'
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
  const [customSettings, setCustomSettings] = useState<RecipeSettings>({})
  const [isProcessing, setIsProcessing] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isCropping, setIsCropping] = useState(false)
  const [isTuning, setIsTuning] = useState(false)
  const [cropRatio, setCropRatio] = useState<AspectRatio>('1:1')
  const [showOriginal, setShowOriginal] = useState(false)
  const [isPanelOpen, setIsPanelOpen] = useState(true)
  
  // Трансформированные изображения
  const [transformedOriginal, setTransformedOriginal] = useState<ImageData>(originalImage)
  const [transformedThumbnail, setTransformedThumbnail] = useState<ImageData>(thumbnail)

  // Избранные рецепты
  const { getFavoriteIds, toggleFavorite } = useFavorites()

  // Track actual viewport height for mobile browsers
  const [viewportHeight, setViewportHeight] = useState<number | null>(null)
  
  useLayoutEffect(() => {
    const updateHeight = () => {
      setViewportHeight(window.innerHeight)
    }
    
    updateHeight()
    window.addEventListener('resize', updateHeight)
    // Also update on orientation change
    window.addEventListener('orientationchange', () => {
      setTimeout(updateHeight, 100)
    })
    
    return () => {
      window.removeEventListener('resize', updateHeight)
    }
  }, [])

  /**
   * Объединяет настройки рецепта с пользовательскими настройками
   */
  const getMergedSettings = useCallback((recipe: Recipe | null): RecipeSettings => {
    if (!recipe) return {}
    return {
      ...recipe.settings,
      ...customSettings
    }
  }, [customSettings])

  /**
   * Применяет текущий рецепт к изображению
   */
  const applyRecipeToImage = useCallback((
    imageData: ImageData,
    recipe: Recipe | null,
    settings?: RecipeSettings
  ): ImageData => {
    if (!recipe) return imageData

    const simulation = getSimulation(recipe.filmSimulation)
    if (!simulation) {
      console.error(`Simulation ${recipe.filmSimulation} not found`)
      return imageData
    }

    return ImageProcessor.process(imageData, {
      simulation,
      settings: settings ?? recipe.settings
    })
  }, [])

  /**
   * Обновляет превью с текущим рецептом и настройками
   */
  const updatePreview = useCallback((
    thumbData: ImageData, 
    recipe: Recipe | null = activeRecipe,
    settings?: RecipeSettings
  ) => {
    if (recipe) {
      const mergedSettings = settings ?? getMergedSettings(recipe)
      const processed = applyRecipeToImage(thumbData, recipe, mergedSettings)
      setPreviewImage(processed)
    } else {
      setPreviewImage(thumbData)
    }
  }, [activeRecipe, getMergedSettings, applyRecipeToImage])

  /**
   * Выбор рецепта
   */
  const handleRecipeSelect = useCallback(async (recipe: Recipe) => {
    setActiveRecipe(recipe)
    setCustomSettings({}) // Сбрасываем кастомные настройки при выборе нового рецепта
    setIsProcessing(true)

    try {
      updatePreview(transformedThumbnail, recipe, recipe.settings)
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
   * Обработка изменения настроек в режиме тюнинга
   */
  const handleSettingsChange = useCallback((newSettings: RecipeSettings) => {
    setCustomSettings(newSettings)
    if (activeRecipe) {
      const mergedSettings = { ...activeRecipe.settings, ...newSettings }
      updatePreview(transformedThumbnail, activeRecipe, mergedSettings)
    }
  }, [activeRecipe, transformedThumbnail, updatePreview])

  /**
   * Сохраняем настройки перед входом в режим тюнинга для возможности отмены
   */
  const [settingsBeforeTuning, setSettingsBeforeTuning] = useState<RecipeSettings>({})

  /**
   * Toggle режима тюнинга (открыть/закрыть)
   */
  const handleTuningOpen = useCallback(() => {
    if (isTuning) {
      // Если уже открыто — закрываем (применяем настройки), панель остаётся
      setIsTuning(false)
    } else {
      // Открываем — сохраняем настройки для возможности отмены
      setSettingsBeforeTuning(customSettings)
      setIsTuning(true)
      // Убеждаемся что панель открыта
      if (!isPanelOpen) {
        setIsPanelOpen(true)
      }
    }
  }, [isTuning, customSettings, isPanelOpen])

  /**
   * Применить настройки и закрыть тюнинг (панель остаётся открытой)
   */
  const handleTuningApply = useCallback(() => {
    setIsTuning(false)
  }, [])

  /**
   * Отменить настройки и закрыть тюнинг (панель остаётся открытой)
   */
  const handleTuningCancel = useCallback(() => {
    // Восстанавливаем настройки до входа в режим тюнинга
    setCustomSettings(settingsBeforeTuning)
    if (activeRecipe) {
      const mergedSettings = { ...activeRecipe.settings, ...settingsBeforeTuning }
      updatePreview(transformedThumbnail, activeRecipe, mergedSettings)
    }
    setIsTuning(false)
  }, [settingsBeforeTuning, activeRecipe, transformedThumbnail, updatePreview])

  /**
   * Переключение видимости панели
   */
  const handlePanelToggle = useCallback(() => {
    setIsPanelOpen(prev => !prev)
    if (isTuning) {
      setIsTuning(false)
    }
  }, [isTuning])

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
    setIsTuning(false) // Закрываем тюнинг при входе в crop
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
   * Экспорт
   */
  const handleExport = useCallback(async () => {
    if (!activeRecipe) return

    setIsExporting(true)
    try {
      const mergedSettings = getMergedSettings(activeRecipe)
      const processed = applyRecipeToImage(transformedOriginal, activeRecipe, mergedSettings)
      
      // Добавляем водяной знак
      const withWatermark = ImageProcessor.addWatermark(
        processed,
        'made by Photochrome',
        APP_URL
      )
      
      const blob = await ImageProcessor.imageDataToBlob(withWatermark)
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
  }, [activeRecipe, transformedOriginal, fileName, getMergedSettings, applyRecipeToImage])

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
          if (!isCropping && !isTuning) {
            if (e.shiftKey) {
              handleRotateCounterClockwise()
            } else {
              handleRotateClockwise()
            }
          }
          break
        case 'c':
          if (!e.metaKey && !e.ctrlKey && !isCropping && !isTuning) {
            handleCropClick()
          }
          break
        case 't':
          if (!e.metaKey && !e.ctrlKey && !isCropping && activeRecipe) {
            handleTuningOpen()
          }
          break
        case 'p':
          if (!e.metaKey && !e.ctrlKey) {
            handlePanelToggle()
          }
          break
        case 'escape':
          if (isCropping) {
            handleCropCancel()
          } else if (isTuning) {
            handleTuningCancel()
          }
          break
        case 'enter':
          if (isCropping && cropRatio !== 'free') {
            handleCropApply()
          } else if (isTuning) {
            setIsTuning(false) // Применяем
          }
          break
        case ' ':
          if (activeRecipe && !isCropping && !isTuning) {
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
    isTuning,
    cropRatio,
    activeRecipe,
    handleRotateClockwise,
    handleRotateCounterClockwise,
    handleCropClick,
    handleCropCancel,
    handleCropApply,
    handleTuningApply,
    handleTuningCancel,
    handlePanelToggle,
    handleExport
  ])

  const displayImage = showOriginal ? transformedThumbnail : previewImage

  return (
    <div 
      className="flex flex-col md:flex-row overflow-hidden"
      style={{ height: viewportHeight ? `${viewportHeight}px` : '100dvh' }}
    >
      {/* Главный блок: фото + toolbar */}
      <div className="flex-1 flex flex-col bg-zinc-950 min-w-0 min-h-0 overflow-hidden">
        {/* Header - компактный на мобильных */}
        <header className="flex-shrink-0 px-3 py-2 md:p-4">
          <div className="relative flex items-center justify-between">
            {/* Left: Back button */}
            <Button variant="ghost" size="sm" onClick={onBack} className="text-zinc-400 hover:text-white h-8 w-8 p-0" aria-label="Back">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            
            {/* Center: Title and filename */}
            <div className="absolute left-1/2 -translate-x-1/2 text-center">
              <h1 className="text-sm md:text-lg font-semibold text-white">Photochrome<sup className="text-[8px] md:text-[10px] text-zinc-500 ml-0.5">{APP_VERSION}</sup></h1>
              <p className="text-[10px] md:text-xs text-zinc-500 truncate max-w-[140px] md:max-w-none">{fileName}</p>
            </div>
            
            {/* Right: Panel toggle - desktop only */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePanelToggle}
              className="text-zinc-500 hover:text-white hidden md:flex"
              aria-label={isPanelOpen ? 'Hide panel' : 'Show panel'}
              aria-expanded={isPanelOpen}
            >
              {isPanelOpen ? (
                <PanelRightClose className="w-5 h-5" />
              ) : (
                <PanelRightOpen className="w-5 h-5" />
              )}
            </Button>
            {/* Spacer for mobile to keep title centered */}
            <div className="w-8 h-8 md:hidden" />
          </div>
        </header>

        {/* Preview area - shrinks to fit, add bottom padding on mobile when crop panel is open */}
        <div className={`flex-1 min-h-0 px-3 md:px-6 relative overflow-hidden transition-[padding] duration-300 ${isCropping ? 'pb-48 md:pb-0' : ''}`}>
          {isProcessing && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
              <p className="text-sm text-zinc-400 bg-zinc-900/80 px-3 py-1 rounded">Processing...</p>
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

        {/* Toolbar - desktop version */}
        <div className="flex-shrink-0 p-3 md:p-4 hidden md:block">
          <Toolbar
            onRotateClockwise={handleRotateClockwise}
            onRotateCounterClockwise={handleRotateCounterClockwise}
            onCropClick={handleCropClick}
            onExport={handleExport}
            canExport={!!activeRecipe}
            isExporting={isExporting}
            cropMode={isCropping}
            cropRatio={cropRatio}
            onCropRatioChange={handleCropRatioChange}
            onCropApply={handleCropApply}
            onCropCancel={handleCropCancel}
            activeRecipe={activeRecipe}
            tuningMode={isTuning}
            onTuningOpen={handleTuningOpen}
          />
        </div>

        {/* Mobile: Toolbar (без кнопки скачать, crop открывает шторку) */}
        <div className={`flex-shrink-0 p-3 md:hidden ${isCropping ? 'hidden' : ''}`}>
          <Toolbar
            onRotateClockwise={handleRotateClockwise}
            onRotateCounterClockwise={handleRotateCounterClockwise}
            onCropClick={handleCropClick}
            onExport={handleExport}
            canExport={!!activeRecipe}
            isExporting={isExporting}
            activeRecipe={activeRecipe}
            tuningMode={isTuning}
            onTuningOpen={handleTuningOpen}
            mobileMode
          />
        </div>

        {/* Mobile: Horizontal recipe panel */}
        <div className={`flex-shrink-0 md:hidden ${isCropping ? 'hidden' : ''}`}>
          <RecipePanel
            sourceImage={transformedThumbnail}
            activeRecipeId={activeRecipe?.id ?? null}
            favoriteIds={getFavoriteIds()}
            onRecipeSelect={handleRecipeSelect}
            onRandomRecipe={handleRandomRecipe}
            onFavoriteToggle={toggleFavorite}
            horizontal
          />
        </div>

        {/* Mobile: Download button */}
        <div className={`flex-shrink-0 p-3 md:hidden ${isCropping ? 'hidden' : ''}`}>
          <Toolbar
            onRotateClockwise={handleRotateClockwise}
            onRotateCounterClockwise={handleRotateCounterClockwise}
            onCropClick={handleCropClick}
            onExport={handleExport}
            canExport={!!activeRecipe}
            isExporting={isExporting}
            cropMode={isCropping}
            cropRatio={cropRatio}
            onCropRatioChange={handleCropRatioChange}
            onCropApply={handleCropApply}
            onCropCancel={handleCropCancel}
            activeRecipe={activeRecipe}
            tuningMode={isTuning}
            onTuningOpen={handleTuningOpen}
            downloadOnly
          />
        </div>
      </div>

      {/* Desktop: Правый блок с пресетами */}
      <aside 
        className={`
          hidden md:block flex-shrink-0 h-full overflow-hidden
          bg-black border-l border-zinc-800
          transition-[width] duration-300 ease-out
          ${isPanelOpen ? 'w-72' : 'w-0 border-l-0'}
        `}
      >
        <div className="w-72 h-full relative">
          {/* RecipePanel - vertical for desktop */}
          <RecipePanel
            sourceImage={transformedThumbnail}
            activeRecipeId={activeRecipe?.id ?? null}
            favoriteIds={getFavoriteIds()}
            onRecipeSelect={handleRecipeSelect}
            onRandomRecipe={handleRandomRecipe}
            onFavoriteToggle={toggleFavorite}
          />
          
          {/* TuningPanel - выезжает поверх */}
          <div 
            className={`tuning-panel-overlay ${isTuning && activeRecipe ? 'tuning-panel-open' : 'tuning-panel-closed'}`}
          >
            {activeRecipe && (
              <TuningPanel
                recipe={activeRecipe}
                customSettings={customSettings}
                onSettingsChange={handleSettingsChange}
                onApply={handleTuningApply}
                onCancel={handleTuningCancel}
              />
            )}
          </div>
        </div>
      </aside>

      {/* Mobile: TuningPanel - полноэкранный */}
      <div 
        className={`
          md:hidden fixed inset-0 z-50
          bg-black
          transition-transform duration-300 ease-out
          ${isTuning && activeRecipe ? 'translate-y-0' : 'translate-y-full'}
        `}
      >
        {activeRecipe && (
          <TuningPanel
            recipe={activeRecipe}
            customSettings={customSettings}
            onSettingsChange={handleSettingsChange}
            onApply={handleTuningApply}
            onCancel={handleTuningCancel}
          />
        )}
      </div>

      {/* Mobile: CropPanel - компактная шторка снизу */}
      <div 
        className={`
          md:hidden fixed inset-x-0 bottom-0 z-50
          bg-black border-t border-zinc-800
          transition-transform duration-300 ease-out
          ${isCropping ? 'translate-y-0' : 'translate-y-full'}
        `}
      >
        <CropPanel
          cropRatio={cropRatio}
          onCropRatioChange={handleCropRatioChange}
          onApply={handleCropApply}
          onCancel={handleCropCancel}
        />
      </div>
    </div>
  )
}
