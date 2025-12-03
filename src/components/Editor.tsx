import { useState, useCallback, useRef } from 'react'
import { ArrowLeft, PanelRightClose, PanelRightOpen } from 'lucide-react'
import { APP_VERSION, APP_URL } from '../constants'
import { Button } from './ui/button'
import { Preview } from './Preview'
import { RecipePanel } from './RecipePanel'
import { TuningPanel } from './TuningPanel'
import { CropPanel } from './CropPanel'
import { Toolbar } from './Toolbar'
import { HelpDialog } from './HelpDialog'
import { Recipe, RecipeSettings } from '../engine/types'
import { ImageProcessor } from '../engine/processor'
import { getSimulation } from '../presets/simulations'
import { getAllRecipes } from '../presets/recipes'
import { AspectRatio } from '../engine/transform'
import { useFavorites } from '../hooks/useFavorites'
import { useTransform } from '../hooks/useTransform'
import { useTuning } from '../hooks/useTuning'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { useViewportHeight, getViewportHeightStyle } from '../hooks/useViewportHeight'

interface EditorProps {
  originalImage: ImageData
  thumbnail: ImageData
  fileName: string
  onBack: () => void
}

/**
 * Главный компонент редактора.
 * Использует композицию хуков для разделения ответственности:
 * - useTransform: повороты и обрезка
 * - useTuning: режим тонкой настройки
 * - useKeyboardShortcuts: горячие клавиши
 * - useViewportHeight: корректная высота на мобильных
 */
export function Editor({ originalImage, thumbnail, fileName, onBack }: EditorProps) {
  // ============================================================================
  // State
  // ============================================================================
  
  const [activeRecipe, setActiveRecipe] = useState<Recipe | null>(null)
  const [previewImage, setPreviewImage] = useState<ImageData>(thumbnail)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [showOriginal, setShowOriginal] = useState(false)
  const [isPanelOpen, setIsPanelOpen] = useState(true)
  const [isHelpOpen, setIsHelpOpen] = useState(false)

  // ============================================================================
  // Custom Hooks
  // ============================================================================

  const viewportHeight = useViewportHeight()
  const { getFavoriteIds, toggleFavorite } = useFavorites()

  // Refs для доступа к актуальным значениям из callbacks (избегаем stale closures)
  const customSettingsRef = useRef<RecipeSettings>({})
  const transformedThumbnailRef = useRef<ImageData>(thumbnail)

  /**
   * Обновляет превью с заданными параметрами
   */
  const updatePreview = useCallback((
    thumbData: ImageData,
    recipe: Recipe | null,
    settings: RecipeSettings
  ) => {
    if (recipe) {
      const simulation = getSimulation(recipe.filmSimulation)
      if (simulation) {
        const mergedSettings = { ...recipe.settings, ...settings }
        const processed = ImageProcessor.process(thumbData, {
          simulation,
          settings: mergedSettings
        })
        setPreviewImage(processed)
      }
    } else {
      setPreviewImage(thumbData)
    }
  }, [])

  // Transform hook (rotation, crop)
  const transform = useTransform({
    originalImage,
    thumbnail,
    onTransformChange: useCallback((_original: ImageData, newThumbnail: ImageData) => {
      transformedThumbnailRef.current = newThumbnail
      updatePreview(newThumbnail, activeRecipe, customSettingsRef.current)
    }, [activeRecipe, updatePreview])
  })

  // Синхронизируем ref с актуальным состоянием transform
  transformedThumbnailRef.current = transform.transformedThumbnail

  // Tuning hook (fine-tune settings)
  const tuning = useTuning({
    onSettingsChange: useCallback((newSettings: RecipeSettings) => {
      customSettingsRef.current = newSettings
      updatePreview(transformedThumbnailRef.current, activeRecipe, newSettings)
    }, [activeRecipe, updatePreview])
  })

  // Синхронизируем ref с актуальным состоянием tuning
  customSettingsRef.current = tuning.customSettings

  // ============================================================================
  // Recipe Processing
  // ============================================================================

  /**
   * Применяет рецепт к изображению
   */
  const applyRecipeToImage = useCallback((
    imageData: ImageData,
    recipe: Recipe,
    settings?: RecipeSettings
  ): ImageData => {
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
   * Выбор рецепта
   */
  const handleRecipeSelect = useCallback((recipe: Recipe) => {
    setActiveRecipe(recipe)
    tuning.resetSettings()
    setIsProcessing(true)

    try {
      const processed = applyRecipeToImage(transform.transformedThumbnail, recipe, recipe.settings)
      setPreviewImage(processed)
    } finally {
      setIsProcessing(false)
    }
  }, [transform.transformedThumbnail, applyRecipeToImage, tuning])

  /**
   * Случайный рецепт
   */
  const handleRandomRecipe = useCallback(() => {
    const recipes = getAllRecipes()
    const availableRecipes = activeRecipe 
      ? recipes.filter((r: Recipe) => r.id !== activeRecipe.id)
      : recipes
    
    if (availableRecipes.length > 0) {
      const randomIndex = Math.floor(Math.random() * availableRecipes.length)
      handleRecipeSelect(availableRecipes[randomIndex])
    }
  }, [activeRecipe, handleRecipeSelect])

  // ============================================================================
  // Panel & UI
  // ============================================================================

  /**
   * Переключение видимости панели
   */
  const handlePanelToggle = useCallback(() => {
    setIsPanelOpen(prev => !prev)
    if (tuning.isTuning) {
      tuning.applyTuning()
    }
  }, [tuning])

  /**
   * Открытие тюнинга с проверкой панели
   */
  const handleTuningOpen = useCallback(() => {
    if (tuning.isTuning) {
      tuning.applyTuning()
    } else {
      tuning.toggleTuning()
      if (!isPanelOpen) {
        setIsPanelOpen(true)
      }
    }
  }, [tuning, isPanelOpen])

  /**
   * Открытие crop с закрытием tuning
   */
  const handleCropClick = useCallback(() => {
    if (tuning.isTuning) {
      tuning.applyTuning()
    }
    transform.openCrop()
  }, [tuning, transform])

  // ============================================================================
  // Export
  // ============================================================================

  const handleExport = useCallback(async () => {
    if (!activeRecipe) return

    setIsExporting(true)
    try {
      const mergedSettings = tuning.getMergedSettings(activeRecipe)
      const processed = applyRecipeToImage(transform.transformedOriginal, activeRecipe, mergedSettings)
      
      // Добавляем водяной знак
      const withWatermark = ImageProcessor.addWatermark(processed, APP_URL)
      
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
  }, [activeRecipe, transform.transformedOriginal, fileName, tuning, applyRecipeToImage])

  // ============================================================================
  // Compare (before/after)
  // ============================================================================

  const handleCompareStart = useCallback(() => setShowOriginal(true), [])
  const handleCompareEnd = useCallback(() => setShowOriginal(false), [])

  // ============================================================================
  // Keyboard Shortcuts
  // ============================================================================

  useKeyboardShortcuts(
    {
      isCropping: transform.isCropping,
      isTuning: tuning.isTuning,
      cropRatio: transform.cropRatio,
      activeRecipe,
    },
    {
      onRotateClockwise: transform.rotateClockwise,
      onRotateCounterClockwise: transform.rotateCounterClockwise,
      onCropOpen: handleCropClick,
      onCropCancel: transform.cancelCrop,
      onCropApply: transform.applyCrop,
      onTuningToggle: handleTuningOpen,
      onTuningCancel: tuning.cancelTuning,
      onTuningApply: tuning.applyTuning,
      onPanelToggle: handlePanelToggle,
      onExport: handleExport,
      onCompareStart: handleCompareStart,
      onCompareEnd: handleCompareEnd,
    }
  )

  // ============================================================================
  // Render
  // ============================================================================

  const displayImage = showOriginal ? transform.transformedThumbnail : previewImage

  return (
    <div 
      className="flex flex-col md:flex-row overflow-hidden"
      style={{ height: getViewportHeightStyle(viewportHeight) }}
    >
      {/* Главный блок: фото + toolbar */}
      <div className="flex-1 flex flex-col bg-zinc-950 min-w-0 min-h-0 overflow-hidden">
        {/* Header */}
        <Header 
          fileName={fileName}
          isPanelOpen={isPanelOpen}
          onBack={onBack}
          onPanelToggle={handlePanelToggle}
        />

        {/* Preview area */}
        <div className={`flex-1 min-h-0 px-3 md:px-6 relative overflow-hidden transition-[padding] duration-300 ${transform.isCropping ? 'pb-48 md:pb-0' : ''}`}>
          {isProcessing && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10">
              <p className="text-sm text-zinc-400 bg-zinc-900/80 px-3 py-1 rounded">Processing...</p>
            </div>
          )}
          <Preview 
            imageData={displayImage}
            cropMode={transform.isCropping}
            cropRatio={transform.cropRatio}
            onMouseDown={handleCompareStart}
            onMouseUp={handleCompareEnd}
            onMouseLeave={handleCompareEnd}
          />
        </div>

        {/* Desktop Toolbar */}
        <div className="flex-shrink-0 p-3 md:p-4 hidden md:block">
          <Toolbar
            onRotateClockwise={transform.rotateClockwise}
            onRotateCounterClockwise={transform.rotateCounterClockwise}
            onCropClick={handleCropClick}
            onExport={handleExport}
            canExport={!!activeRecipe}
            isExporting={isExporting}
            cropMode={transform.isCropping}
            cropRatio={transform.cropRatio}
            onCropRatioChange={transform.setCropRatio}
            onCropApply={transform.applyCrop}
            onCropCancel={transform.cancelCrop}
            activeRecipe={activeRecipe}
            tuningMode={tuning.isTuning}
            onTuningOpen={handleTuningOpen}
            onHelpClick={() => setIsHelpOpen(true)}
          />
        </div>

        {/* Mobile: Toolbar */}
        <div className={`flex-shrink-0 p-3 md:hidden ${transform.isCropping ? 'hidden' : ''}`}>
          <Toolbar
            onRotateClockwise={transform.rotateClockwise}
            onRotateCounterClockwise={transform.rotateCounterClockwise}
            onCropClick={handleCropClick}
            onExport={handleExport}
            canExport={!!activeRecipe}
            isExporting={isExporting}
            activeRecipe={activeRecipe}
            tuningMode={tuning.isTuning}
            onTuningOpen={handleTuningOpen}
            onHelpClick={() => setIsHelpOpen(true)}
            mobileMode
          />
        </div>

        {/* Mobile: Horizontal recipe panel */}
        <div className={`flex-shrink-0 md:hidden ${transform.isCropping ? 'hidden' : ''}`}>
          <RecipePanel
            sourceImage={transform.transformedThumbnail}
            activeRecipeId={activeRecipe?.id ?? null}
            favoriteIds={getFavoriteIds()}
            onRecipeSelect={handleRecipeSelect}
            onRandomRecipe={handleRandomRecipe}
            onFavoriteToggle={toggleFavorite}
            horizontal
          />
        </div>

        {/* Mobile: Download button */}
        <div className={`flex-shrink-0 p-3 md:hidden ${transform.isCropping ? 'hidden' : ''}`}>
          <Toolbar
            onRotateClockwise={transform.rotateClockwise}
            onRotateCounterClockwise={transform.rotateCounterClockwise}
            onCropClick={handleCropClick}
            onExport={handleExport}
            canExport={!!activeRecipe}
            isExporting={isExporting}
            cropMode={transform.isCropping}
            cropRatio={transform.cropRatio}
            onCropRatioChange={transform.setCropRatio}
            onCropApply={transform.applyCrop}
            onCropCancel={transform.cancelCrop}
            activeRecipe={activeRecipe}
            tuningMode={tuning.isTuning}
            onTuningOpen={handleTuningOpen}
            downloadOnly
          />
        </div>
      </div>

      {/* Desktop: Recipe panel */}
      <DesktopSidePanel
        isOpen={isPanelOpen}
        isTuning={tuning.isTuning}
        activeRecipe={activeRecipe}
        transformedThumbnail={transform.transformedThumbnail}
        customSettings={tuning.customSettings}
        favoriteIds={getFavoriteIds()}
        onRecipeSelect={handleRecipeSelect}
        onRandomRecipe={handleRandomRecipe}
        onFavoriteToggle={toggleFavorite}
        onSettingsChange={tuning.updateSettings}
        onTuningApply={tuning.applyTuning}
        onTuningCancel={tuning.cancelTuning}
      />

      {/* Mobile: TuningPanel */}
      <MobileTuningPanel
        isOpen={tuning.isTuning && !!activeRecipe}
        activeRecipe={activeRecipe}
        customSettings={tuning.customSettings}
        onSettingsChange={tuning.updateSettings}
        onApply={tuning.applyTuning}
        onCancel={tuning.cancelTuning}
      />

      {/* Mobile: CropPanel */}
      <MobileCropPanel
        isOpen={transform.isCropping}
        cropRatio={transform.cropRatio}
        onCropRatioChange={transform.setCropRatio}
        onApply={transform.applyCrop}
        onCancel={transform.cancelCrop}
      />

      {/* Help dialog */}
      <HelpDialog
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />
    </div>
  )
}

// ============================================================================
// Sub-components
// ============================================================================

interface HeaderProps {
  fileName: string
  isPanelOpen: boolean
  onBack: () => void
  onPanelToggle: () => void
}

function Header({ fileName, isPanelOpen, onBack, onPanelToggle }: HeaderProps) {
  return (
    <header className="flex-shrink-0 px-3 py-2 md:p-4">
      <div className="relative flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-zinc-400 hover:text-white h-8 w-8 p-0" aria-label="Back">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        
        <div className="absolute left-1/2 -translate-x-1/2 text-center">
          <h1 className="text-sm md:text-lg font-semibold text-white">
            Photochrome<sup className="text-[8px] md:text-[10px] text-zinc-500 ml-0.5">{APP_VERSION}</sup>
          </h1>
          <p className="text-[10px] md:text-xs text-zinc-500 truncate max-w-[140px] md:max-w-none">{fileName}</p>
        </div>
        
        {/* Desktop: Panel toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onPanelToggle}
          className="text-zinc-500 hover:text-white hidden md:flex"
          aria-label={isPanelOpen ? 'Hide panel' : 'Show panel'}
          aria-expanded={isPanelOpen}
        >
          {isPanelOpen ? <PanelRightClose className="w-5 h-5" /> : <PanelRightOpen className="w-5 h-5" />}
        </Button>
        {/* Spacer for mobile */}
        <div className="w-8 h-8 md:hidden" />
      </div>
    </header>
  )
}

interface DesktopSidePanelProps {
  isOpen: boolean
  isTuning: boolean
  activeRecipe: Recipe | null
  transformedThumbnail: ImageData
  customSettings: RecipeSettings
  favoriteIds: string[]
  onRecipeSelect: (recipe: Recipe) => void
  onRandomRecipe: () => void
  onFavoriteToggle: (id: string) => void
  onSettingsChange: (settings: RecipeSettings) => void
  onTuningApply: () => void
  onTuningCancel: () => void
}

function DesktopSidePanel({
  isOpen,
  isTuning,
  activeRecipe,
  transformedThumbnail,
  customSettings,
  favoriteIds,
  onRecipeSelect,
  onRandomRecipe,
  onFavoriteToggle,
  onSettingsChange,
  onTuningApply,
  onTuningCancel,
}: DesktopSidePanelProps) {
  return (
    <aside 
      className={`
        hidden md:block flex-shrink-0 h-full overflow-hidden
        bg-black border-l border-zinc-800
        transition-[width] duration-300 ease-out
        ${isOpen ? 'w-72' : 'w-0 border-l-0'}
      `}
    >
      <div className="w-72 h-full relative">
        <RecipePanel
          sourceImage={transformedThumbnail}
          activeRecipeId={activeRecipe?.id ?? null}
          favoriteIds={favoriteIds}
          onRecipeSelect={onRecipeSelect}
          onRandomRecipe={onRandomRecipe}
          onFavoriteToggle={onFavoriteToggle}
        />
        
        <div className={`tuning-panel-overlay ${isTuning && activeRecipe ? 'tuning-panel-open' : 'tuning-panel-closed'}`}>
          {activeRecipe && (
            <TuningPanel
              recipe={activeRecipe}
              customSettings={customSettings}
              onSettingsChange={onSettingsChange}
              onApply={onTuningApply}
              onCancel={onTuningCancel}
            />
          )}
        </div>
      </div>
    </aside>
  )
}

interface MobileTuningPanelProps {
  isOpen: boolean
  activeRecipe: Recipe | null
  customSettings: RecipeSettings
  onSettingsChange: (settings: RecipeSettings) => void
  onApply: () => void
  onCancel: () => void
}

function MobileTuningPanel({
  isOpen,
  activeRecipe,
  customSettings,
  onSettingsChange,
  onApply,
  onCancel,
}: MobileTuningPanelProps) {
  return (
    <div 
      className={`
        md:hidden fixed inset-0 z-50
        bg-black
        transition-transform duration-300 ease-out
        ${isOpen ? 'translate-y-0' : 'translate-y-full'}
      `}
    >
      {activeRecipe && (
        <TuningPanel
          recipe={activeRecipe}
          customSettings={customSettings}
          onSettingsChange={onSettingsChange}
          onApply={onApply}
          onCancel={onCancel}
        />
      )}
    </div>
  )
}

interface MobileCropPanelProps {
  isOpen: boolean
  cropRatio: AspectRatio
  onCropRatioChange: (ratio: AspectRatio) => void
  onApply: () => void
  onCancel: () => void
}

function MobileCropPanel({
  isOpen,
  cropRatio,
  onCropRatioChange,
  onApply,
  onCancel,
}: MobileCropPanelProps) {
  return (
    <div 
      className={`
        md:hidden fixed inset-x-0 bottom-0 z-50
        bg-black border-t border-zinc-800
        transition-transform duration-300 ease-out
        ${isOpen ? 'translate-y-0' : 'translate-y-full'}
      `}
    >
      <CropPanel
        cropRatio={cropRatio}
        onCropRatioChange={onCropRatioChange}
        onApply={onApply}
        onCancel={onCancel}
      />
    </div>
  )
}
