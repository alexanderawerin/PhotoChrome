import { useState, useCallback, useRef, useEffect } from 'react'
import { ArrowLeft, PanelRightClose, PanelRightOpen, Layers, Share } from 'lucide-react'
import { APP_VERSION, APP_URL } from '../constants'
import { Button } from './ui/button'
import { Spinner } from './ui/spinner'
import { Preview } from './Preview'
import { RecipePanel } from './RecipePanel'
import { TuningPanel } from './TuningPanel'
import { CropPanel } from './CropPanel'
import { Toolbar } from './Toolbar'
import { HelpDialog } from './HelpDialog'
import { ThumbnailStrip } from './ThumbnailStrip'
import { ImageCounter } from './ImageCounter'
import { Recipe, RecipeSettings, ImageItem } from '../engine/types'
import { ImageProcessor, ExifInfo } from '../engine/processor'
import { getSimulation } from '../presets/simulations'
import { getAllRecipes } from '../presets/recipes'
import { AspectRatio } from '../engine/transform'
import { useFavorites } from '../hooks/useFavorites'
import { useTransform } from '../hooks/useTransform'
import { useIsMdUp } from '../hooks/useIsMdUp'
import { DEFAULT_CROP_RATIO_DESKTOP, DEFAULT_CROP_RATIO_MOBILE } from '../constants/cropRatios'
import { useTuning } from '../hooks/useTuning'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { useViewportHeight, getViewportHeightStyle } from '../hooks/useViewportHeight'

interface EditorProps {
  images: ImageItem[]
  currentIndex: number
  onIndexChange: (index: number) => void
  onImageUpdate: (id: string, updates: Partial<ImageItem>) => void
  onNextImage?: () => void
  onPreviousImage?: () => void
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
export function Editor({
  images,
  currentIndex,
  onIndexChange,
  onImageUpdate,
  onNextImage,
  onPreviousImage,
  fileName,
  onBack
}: EditorProps) {
  // ============================================================================
  // State
  // ============================================================================

  const currentImage = images[currentIndex]
  const totalImages = images.length

  const [previewImage, setPreviewImage] = useState<ImageData>(currentImage.transformedThumbnail)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [isApplyingToAll, setIsApplyingToAll] = useState(false)
  const [showOriginal, setShowOriginal] = useState(false)
  const [isPanelOpen, setIsPanelOpen] = useState(true)
  const [isHelpOpen, setIsHelpOpen] = useState(false)

  // ============================================================================
  // Custom Hooks
  // ============================================================================

  const viewportHeight = useViewportHeight()
  const isMdUp = useIsMdUp()
  const defaultCropRatio = isMdUp ? DEFAULT_CROP_RATIO_DESKTOP : DEFAULT_CROP_RATIO_MOBILE
  const { getFavoriteIds, toggleFavorite } = useFavorites()

  // Refs для доступа к актуальным значениям из callbacks (избегаем stale closures)
  const customSettingsRef = useRef<RecipeSettings>(currentImage.customSettings)
  const transformedThumbnailRef = useRef<ImageData>(currentImage.transformedThumbnail)

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
    originalImage: currentImage.original,
    thumbnail: currentImage.thumbnail,
    transformedOriginal: currentImage.transformedOriginal,
    transformedThumbnail: currentImage.transformedThumbnail,
    defaultCropRatio,
    onTransformChange: useCallback((newOriginal: ImageData, newThumbnail: ImageData) => {
      transformedThumbnailRef.current = newThumbnail
      onImageUpdate(currentImage.id, {
        transformedOriginal: newOriginal,
        transformedThumbnail: newThumbnail
      })
      updatePreview(newThumbnail, currentImage.recipe, customSettingsRef.current)
    }, [currentImage, onImageUpdate, updatePreview])
  })

  // Синхронизируем ref с актуальным состоянием transform
  transformedThumbnailRef.current = transform.transformedThumbnail

  // Tuning hook (fine-tune settings)
  const tuning = useTuning({
    initialSettings: currentImage.customSettings,
    onSettingsChange: useCallback((newSettings: RecipeSettings) => {
      customSettingsRef.current = newSettings
      onImageUpdate(currentImage.id, { customSettings: newSettings })
      updatePreview(transformedThumbnailRef.current, currentImage.recipe, newSettings)
    }, [currentImage, onImageUpdate, updatePreview])
  })

  // Синхронизируем ref с актуальным состоянием tuning
  customSettingsRef.current = tuning.customSettings

  // ============================================================================
  // Sync preview when switching images
  // ============================================================================

  useEffect(() => {
    // При смене изображения обновляем превью
    updatePreview(
      currentImage.transformedThumbnail,
      currentImage.recipe,
      currentImage.customSettings
    )
  }, [currentIndex, currentImage.transformedThumbnail, currentImage.recipe, currentImage.customSettings, updatePreview])

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
   * Выбор рецепта (обновляет только текущее изображение)
   */
  const handleRecipeSelect = useCallback((recipe: Recipe) => {
    onImageUpdate(currentImage.id, {
      recipe,
      customSettings: {} // Сброс настроек при смене рецепта
    })
    tuning.resetSettings()
    setIsProcessing(true)

    try {
      const processed = applyRecipeToImage(transform.transformedThumbnail, recipe, recipe.settings)
      setPreviewImage(processed)
    } finally {
      setIsProcessing(false)
    }
  }, [currentImage, onImageUpdate, transform.transformedThumbnail, applyRecipeToImage, tuning])

  /**
   * Применить текущий рецепт и настройки ко всем изображениям
   */
  const handleApplyToAll = useCallback(async () => {
    if (!currentImage.recipe) return

    setIsApplyingToAll(true)

    try {
      const { recipe, customSettings } = currentImage

      // Используем setTimeout для показа индикатора загрузки
      await new Promise(resolve => setTimeout(resolve, 100))

      images.forEach(img => {
        if (img.id !== currentImage.id) {
          onImageUpdate(img.id, { recipe, customSettings })
        }
      })

      // Даем время на обновление миниатюр
      await new Promise(resolve => setTimeout(resolve, 300))
    } finally {
      setIsApplyingToAll(false)
    }
  }, [currentImage, images, onImageUpdate])

  /**
   * Случайный рецепт (применяется к текущему изображению)
   */
  const handleRandomRecipe = useCallback(() => {
    const recipes = getAllRecipes()
    const availableRecipes = currentImage.recipe
      ? recipes.filter((r: Recipe) => r.id !== currentImage.recipe?.id)
      : recipes

    if (availableRecipes.length > 0) {
      const randomIndex = Math.floor(Math.random() * availableRecipes.length)
      handleRecipeSelect(availableRecipes[randomIndex])
    }
  }, [currentImage.recipe, handleRecipeSelect])

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
    if (!currentImage.recipe) return

    setIsExporting(true)
    try {
      const simulation = getSimulation(currentImage.recipe.filmSimulation)
      if (!simulation) return

      const mergedSettings = tuning.getMergedSettings(currentImage.recipe)

      // Используем async Worker для полноразмерного экспорта (не блокирует UI)
      const processed = await ImageProcessor.processAsync(
        transform.transformedOriginal,
        { simulation, settings: mergedSettings }
      )

      const withWatermark = ImageProcessor.addWatermark(processed, APP_URL)

      const exifInfo: ExifInfo = {
        recipeName: currentImage.recipe.name,
        recipeId: currentImage.recipe.id,
        settings: mergedSettings,
      }

      const blob = await ImageProcessor.imageDataToBlob(withWatermark, 0.95, exifInfo)
      const url = URL.createObjectURL(blob)

      const a = document.createElement('a')
      a.href = url
      a.download = `photochrome_${currentImage.recipe.id}_${currentImage.fileName}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to export:', err)
    } finally {
      setIsExporting(false)
    }
  }, [currentImage, transform.transformedOriginal, tuning])

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
      activeRecipe: currentImage.recipe,
      totalImages,
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
      onNextImage,
      onPreviousImage,
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
          <ImageCounter currentIndex={currentIndex} totalImages={totalImages} />
          <Preview
            imageData={displayImage}
            cropMode={transform.isCropping}
            cropRatio={transform.cropRatio}
            cropOffset={transform.cropOffset}
            onCropOffsetChange={transform.setCropOffset}
            onMouseDown={handleCompareStart}
            onMouseUp={handleCompareEnd}
            onMouseLeave={handleCompareEnd}
            enableSwipe={totalImages > 1 && !transform.isCropping}
            onSwipeLeft={onNextImage}
            onSwipeRight={onPreviousImage}
          />

          {/* Desktop: Thumbnail Strip below preview */}
          {totalImages > 1 && (
            <div className="hidden md:block">
              <ThumbnailStrip
                images={images}
                currentIndex={currentIndex}
                onSelectImage={onIndexChange}
              />
            </div>
          )}
        </div>

        {/* Desktop Toolbar */}
        <div className="flex-shrink-0 p-3 md:p-4 hidden md:block">
          <Toolbar
            onRotateClockwise={transform.rotateClockwise}
            onRotateCounterClockwise={transform.rotateCounterClockwise}
            onCropClick={handleCropClick}
            onExport={handleExport}
            canExport={!!currentImage.recipe}
            isExporting={isExporting}
            cropMode={transform.isCropping}
            cropRatio={transform.cropRatio}
            onCropRatioChange={transform.setCropRatio}
            onCropApply={transform.applyCrop}
            onCropCancel={transform.cancelCrop}
            activeRecipe={currentImage.recipe}
            tuningMode={tuning.isTuning}
            onTuningOpen={handleTuningOpen}
            totalImages={totalImages}
            onApplyToAll={handleApplyToAll}
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
            canExport={!!currentImage.recipe}
            isExporting={isExporting}
            activeRecipe={currentImage.recipe}
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
            activeRecipeId={currentImage.recipe?.id ?? null}
            favoriteIds={getFavoriteIds()}
            onRecipeSelect={handleRecipeSelect}
            onRandomRecipe={handleRandomRecipe}
            onFavoriteToggle={toggleFavorite}
            horizontal
          />
        </div>

        {/* Mobile: Action buttons (Apply to all + Export) */}
        <div className={`flex-shrink-0 p-3 md:hidden ${transform.isCropping ? 'hidden' : ''}`}>
          <div className="flex gap-2">
            {/* Apply to all button (multi-image mode) */}
            {totalImages > 1 && currentImage.recipe && (
              <Button
                variant="outline"
                size="default"
                onClick={handleApplyToAll}
                aria-label={`Apply current preset to all ${totalImages} images`}
                className="flex-1"
              >
                <Layers className="w-4 h-4" aria-hidden="true" />
                Apply to all {totalImages}
              </Button>
            )}

            {/* Export button */}
            <Button
              variant="default"
              size="default"
              onClick={handleExport}
              disabled={!currentImage.recipe || isExporting}
              aria-label={isExporting ? 'Exporting...' : 'Export processed image'}
              aria-busy={isExporting}
              className={totalImages > 1 && currentImage.recipe ? 'flex-1' : 'w-full'}
            >
              {isExporting ? (
                <Spinner className="size-4" randomColor />
              ) : (
                <Share className="w-4 h-4" aria-hidden="true" />
              )}
              {isExporting ? 'Exporting...' : 'Export'}
            </Button>
          </div>
        </div>
      </div>

      {/* Desktop: Recipe panel */}
      <DesktopSidePanel
        isOpen={isPanelOpen}
        isTuning={tuning.isTuning}
        activeRecipe={currentImage.recipe}
        transformedThumbnail={transform.transformedThumbnail}
        customSettings={tuning.customSettings}
        favoriteIds={getFavoriteIds()}
        totalImages={totalImages}
        onRecipeSelect={handleRecipeSelect}
        onRandomRecipe={handleRandomRecipe}
        onFavoriteToggle={toggleFavorite}
        onApplyToAll={handleApplyToAll}
        onSettingsChange={tuning.updateSettings}
        onTuningApply={tuning.applyTuning}
        onTuningCancel={tuning.cancelTuning}
      />

      {/* Mobile: TuningPanel */}
      <MobileTuningPanel
        isOpen={tuning.isTuning && !!currentImage.recipe}
        activeRecipe={currentImage.recipe}
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
        totalImages={totalImages}
      />

      {/* Loading overlay for applying preset to all images */}
      {isApplyingToAll && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[200] p-4"
          role="status"
          aria-label="Applying preset to all images"
          aria-live="polite"
        >
          <div className="flex items-center gap-3 pl-4 pr-4 py-3 rounded-xl bg-zinc-800/80">
            <Spinner className="size-5 text-zinc-400 flex-shrink-0" />
            <p className="text-sm text-zinc-300 whitespace-nowrap">
              Applying preset to {totalImages} images...
            </p>
          </div>
        </div>
      )}
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
  totalImages: number
  onRecipeSelect: (recipe: Recipe) => void
  onRandomRecipe: () => void
  onFavoriteToggle: (id: string) => void
  onApplyToAll: () => void
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
  totalImages,
  onRecipeSelect,
  onRandomRecipe,
  onFavoriteToggle,
  onApplyToAll,
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
          totalImages={totalImages}
          onRecipeSelect={onRecipeSelect}
          onRandomRecipe={onRandomRecipe}
          onFavoriteToggle={onFavoriteToggle}
          onApplyToAll={onApplyToAll}
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
      role="dialog"
      aria-modal="true"
      aria-label="Fine-tune settings"
      aria-hidden={!isOpen}
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
      role="dialog"
      aria-modal="true"
      aria-label="Crop image"
      aria-hidden={!isOpen}
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
