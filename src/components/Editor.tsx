import { useState, useCallback, useRef, useEffect } from 'react'
import { Crop, FlipHorizontal2, Layers, Plus, RotateCw, Settings2, Share, HelpCircle } from 'lucide-react'
import { APP_VERSION, APP_URL } from '../constants'
import { Button } from './ui/button'
import { Spinner } from './ui/spinner'
import { Preview } from './Preview'
import { RecipePanel } from './RecipePanel'
import { MobileAdjustControls } from './MobileAdjustControls'
import { TuningPanel } from './TuningPanel'
import { CropPanel } from './CropPanel'
import { HelpDialog } from './HelpDialog'
import { ThumbnailStrip } from './ThumbnailStrip'
import { ImageCounter } from './ImageCounter'
import { Recipe, RecipeSettings, ImageItem } from '../engine/types'
import { ImageProcessor } from '../engine/processor'
import { loadSimulationLUT } from '../presets/simulations'
import { createProcessingPlan } from '../engine/processing-plan'
import { getAllRecipes } from '../presets/recipes'
import { AspectRatio, type ImageTransformState } from '../engine/transform'
import { useFavorites } from '../hooks/useFavorites'
import { useTransform } from '../hooks/useTransform'
import { useIsMdUp } from '../hooks/useIsMdUp'
import { useIsWideDesktop } from '../hooks/useIsWideDesktop'
import { useTuning } from '../hooks/useTuning'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { useViewportHeight, getViewportHeightStyle } from '../hooks/useViewportHeight'
import { useRecipeRecommendations } from '../hooks/useRecipeRecommendations'
import {
  beginAdjustSession,
  createRandomRecipeSettings,
  resetAdjustSession,
  updateAdjustSession,
  type AdjustSession,
  type AdjustTool,
} from '../engine/editor-sessions'
import { exportPhoto, type PhotoExportResult } from '../engine/photo-export'
import {
  exportPhotoBatch,
  type BatchExportProgress,
  type BatchExportResult,
} from '../engine/batch-export'

interface EditorProps {
  images: ImageItem[]
  currentIndex: number
  onIndexChange: (index: number) => void
  onImageUpdate: (id: string, updates: Partial<ImageItem>) => void
  onNextImage?: () => void
  onPreviousImage?: () => void
  onBack: () => void
  onAddImages: (files: File[]) => Promise<void>
  demoMode?: boolean
  onMediaSelect?: (files: File[], type: 'image' | 'video') => Promise<void>
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
  onBack,
  onAddImages,
  demoMode = false,
  onMediaSelect,
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
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [isHelpOpen, setIsHelpOpen] = useState(false)
  const [hasUnreadHelp, setHasUnreadHelp] = useState(() => {
    try {
      return localStorage.getItem('photochrome-help-version') !== APP_VERSION
    } catch {
      return true
    }
  })
  const [mobileMode, setMobileMode] = useState<'presets' | 'adjust' | 'crop'>('presets')
  const [adjustSession, setAdjustSession] = useState<AdjustSession | null>(null)
  const [isCropControlActive, setIsCropControlActive] = useState(false)
  const [exportError, setExportError] = useState<Extract<PhotoExportResult, { status: 'error' }>['error'] | null>(null)
  const exportAbortControllerRef = useRef<AbortController | null>(null)
  const batchAbortControllerRef = useRef<AbortController | null>(null)
  const demoUploadRef = useRef<HTMLInputElement>(null)
  const [batchProgress, setBatchProgress] = useState<BatchExportProgress | null>(null)
  const [completion, setCompletion] = useState<{
    kind: 'single' | 'batch'
    exported: number
    skipped: number
    errors: number
  } | null>(null)

  // ============================================================================
  // Custom Hooks
  // ============================================================================

  const viewportHeight = useViewportHeight()
  const isMdUp = useIsMdUp()
  const isWideDesktop = useIsWideDesktop()
  const isAdjustPanelVisible = isWideDesktop || isPanelOpen
  const { getFavoriteIds, toggleFavorite } = useFavorites()

  const { recipeIds: smartPicksIds } = useRecipeRecommendations(
    currentImage?.id ?? null,
    currentImage?.thumbnail ?? null,
    currentImage?.exif
  )

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
      const plan = createProcessingPlan(recipe, thumbData, settings)
      setPreviewImage(ImageProcessor.process(thumbData, plan))
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
    externalTransformState: currentImage.transform,
    onTransformPreview: useCallback((newThumbnail: ImageData) => {
      transformedThumbnailRef.current = newThumbnail
      updatePreview(newThumbnail, currentImage.recipe, customSettingsRef.current)
    }, [currentImage.recipe, updatePreview]),
    onTransformChange: useCallback((newOriginal: ImageData, newThumbnail: ImageData, transformState: ImageTransformState) => {
      transformedThumbnailRef.current = newThumbnail
      onImageUpdate(currentImage.id, {
        transformedOriginal: newOriginal,
        transformedThumbnail: newThumbnail,
        transform: transformState,
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
    let cancelled = false

    const loadAndPreview = async () => {
      setIsProcessing(true)
      try {
        if (currentImage.recipe) {
          await loadSimulationLUT(currentImage.recipe.filmSimulation)
        }
        if (!cancelled) {
          updatePreview(
            currentImage.transformedThumbnail,
            currentImage.recipe,
            currentImage.customSettings
          )
        }
      } finally {
        if (!cancelled) setIsProcessing(false)
      }
    }
    loadAndPreview()

    return () => {
      cancelled = true
    }
  }, [currentImage.id, currentImage.transformedThumbnail, currentImage.recipe, currentImage.customSettings, updatePreview])

  // ============================================================================
  // Recipe Processing
  // ============================================================================

  /**
   * Выбор рецепта (обновляет только текущее изображение)
   */
  const handleRecipeSelect = useCallback((recipe: Recipe) => {
    onImageUpdate(currentImage.id, {
      recipe,
      customSettings: {} // Сброс настроек при смене рецепта
    })
    tuning.resetSettings()
  }, [currentImage.id, onImageUpdate, tuning])

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
      const recipe = availableRecipes[randomIndex]
      const customSettings = createRandomRecipeSettings()
      onImageUpdate(currentImage.id, { recipe, customSettings })
      tuning.updateSettings(customSettings)
    }
  }, [currentImage.id, currentImage.recipe, onImageUpdate, tuning])

  // ============================================================================
  // Panel & UI
  // ============================================================================

  /**
   * Переключение видимости панели
   */
  const handlePanelToggle = useCallback(() => {
    if (isWideDesktop) return
    setIsPanelOpen(prev => !prev)
    if (tuning.isTuning) {
      tuning.applyTuning()
    }
  }, [isWideDesktop, tuning])

  /**
   * Открытие тюнинга с проверкой панели
   */
  const handleTuningOpen = useCallback(() => {
    if (isWideDesktop) return
    if (isPanelOpen) {
      if (tuning.isTuning) tuning.applyTuning()
      setIsPanelOpen(false)
    } else {
      if (!tuning.isTuning) {
      tuning.toggleTuning()
      }
      setIsPanelOpen(true)
    }
  }, [isWideDesktop, tuning, isPanelOpen])

  /**
   * Открытие crop с закрытием tuning
   */
  const handleCropClick = useCallback(() => {
    if (tuning.isTuning) {
      tuning.applyTuning()
    }
    transform.openCrop()
  }, [tuning, transform])

  const openAdjustTool = useCallback((tool: AdjustTool) => {
    setAdjustSession(beginAdjustSession(tool, tuning.customSettings))
  }, [tuning.customSettings])

  const changeAdjustValue = useCallback((value: RecipeSettings[AdjustTool]) => {
    if (!adjustSession) return
    const next = updateAdjustSession(adjustSession, value)
    setAdjustSession(next)
    tuning.updateSettings(next.draft)
  }, [adjustSession, tuning])

  const resetAdjustValue = useCallback(() => {
    if (!currentImage.recipe) return
    if (!adjustSession) return
    const next = resetAdjustSession(adjustSession, currentImage.recipe)
    setAdjustSession(next)
    tuning.updateSettings(next.draft)
  }, [adjustSession, currentImage.recipe, tuning])

  const cancelAdjustSession = useCallback(() => {
    if (adjustSession) tuning.updateSettings(adjustSession.before)
    setAdjustSession(null)
  }, [adjustSession, tuning])

  const changeMobileMode = useCallback((mode: 'presets' | 'adjust' | 'crop') => {
    if (adjustSession) {
      tuning.updateSettings(adjustSession.before)
      setAdjustSession(null)
    }
    if (transform.isCropping) transform.cancelCrop()
    setMobileMode(mode)
  }, [adjustSession, transform, tuning])

  // ============================================================================
  // Export
  // ============================================================================

  const handleExport = useCallback(async () => {
    if (!currentImage.recipe) return

    exportAbortControllerRef.current?.abort()
    const controller = new AbortController()
    exportAbortControllerRef.current = controller
    setExportError(null)
    setIsExporting(true)
    try {
      const mergedSettings = tuning.getMergedSettings(currentImage.recipe)
      const plan = createProcessingPlan(
        currentImage.recipe,
        transform.transformedOriginal,
        mergedSettings
      )

      const baseName = currentImage.fileName.replace(/\.[^.]+$/, '')
      const result = await exportPhoto({
        imageData: transform.transformedOriginal,
        plan,
        fileName: `photochrome_${currentImage.recipe.id}_${baseName}.jpg`,
        watermarkText: APP_URL,
        exifInfo: {
          recipeName: currentImage.recipe.name,
          recipeId: currentImage.recipe.id,
          settings: mergedSettings,
        },
        signal: controller.signal,
      })
      if (result.status === 'error') setExportError(result.error)
      if (result.status === 'success') setCompletion({ kind: 'single', exported: 1, skipped: 0, errors: 0 })
    } finally {
      if (exportAbortControllerRef.current === controller) {
        exportAbortControllerRef.current = null
      }
      setIsExporting(false)
    }
  }, [currentImage, transform.transformedOriginal, tuning])

  const handleExportAll = useCallback(async () => {
    batchAbortControllerRef.current?.abort()
    const controller = new AbortController()
    batchAbortControllerRef.current = controller
    setCompletion(null)
    setBatchProgress({
      current: 0,
      total: images.length,
      fileName: null,
      exported: 0,
      skipped: 0,
      errors: 0,
    })

    let result: BatchExportResult
    try {
      result = await exportPhotoBatch(images, {
        signal: controller.signal,
        onProgress: setBatchProgress,
      })
    } catch (error) {
      result = {
        status: 'error',
        message: error instanceof Error ? error.message : 'Failed to load ZIP exporter',
        exported: 0,
        skipped: 0,
        errors: 0,
      }
    } finally {
      if (batchAbortControllerRef.current === controller) batchAbortControllerRef.current = null
      setBatchProgress(null)
    }

    if (result.status === 'success') {
      const url = URL.createObjectURL(result.blob)
      try {
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = result.archiveName
        document.body.appendChild(anchor)
        anchor.click()
        anchor.remove()
      } finally {
        URL.revokeObjectURL(url)
      }
    }
    if (result.status === 'success') {
      setCompletion({
        kind: 'batch',
        exported: result.exported,
        skipped: result.skipped,
        errors: result.errors,
      })
    }
  }, [images])

  const isBatchExporting = batchProgress !== null
  const canExportAll = images.some((image) => Boolean(image.recipe))

  useEffect(() => () => {
    exportAbortControllerRef.current?.abort()
    batchAbortControllerRef.current?.abort()
  }, [])

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
      onFlipHorizontal: transform.flipHorizontal,
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
      <DesktopPresetPanel
        activeRecipe={currentImage.recipe}
        transformedThumbnail={transform.transformedThumbnail}
        favoriteIds={getFavoriteIds()}
        onRecipeSelect={handleRecipeSelect}
        onRandomRecipe={handleRandomRecipe}
        onFavoriteToggle={toggleFavorite}
        smartPicksIds={smartPicksIds}
      />

      {/* Главный блок: фото + toolbar */}
      <div className="flex-1 flex flex-col bg-zinc-950 min-w-0 min-h-0 overflow-hidden">
        {/* Header */}
        <Header 
          fileName={currentImage.fileName}
          currentIndex={currentIndex}
          totalImages={totalImages}
          onAddImages={onAddImages}
          onHelp={() => setIsHelpOpen(true)}
          hasUnreadHelp={hasUnreadHelp}
          demoMode={demoMode}
          onDemoUpload={() => demoUploadRef.current?.click()}
        />

        {exportError && (
          <div
            role="alert"
            className="mx-3 md:mx-6 mb-2 flex items-center gap-3 rounded-lg border border-rose-900/70 bg-rose-950/80 px-3 py-2 text-sm text-rose-100"
          >
            <p className="min-w-0 flex-1">
              Export failed: {exportError.message}
            </p>
            <Button size="sm" variant="outline" onClick={handleExport} disabled={isExporting}>
              Retry
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setExportError(null)}>
              Dismiss
            </Button>
          </div>
        )}

        {/* Preview area */}
        <div className={`flex flex-1 min-h-0 flex-col px-3 md:px-6 overflow-hidden transition-[padding] duration-300 motion-reduce:transition-none ${transform.isCropping ? 'pb-72 md:pb-0' : ''}`}>
          <div className="relative min-h-0 flex-1">
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
            cropRect={transform.transformState.cropRect}
            onCropRectChange={transform.setFreeCropRect}
            cropScale={transform.transformState.cropScale}
            onCropScaleChange={transform.setCropScale}
            cropGridActive={isCropControlActive}
            cover={!isMdUp && !transform.isCropping}
            onMouseDown={handleCompareStart}
            onMouseUp={handleCompareEnd}
            onMouseLeave={handleCompareEnd}
            enableSwipe={totalImages > 1 && !transform.isCropping}
            onSwipeLeft={onNextImage}
            onSwipeRight={onPreviousImage}
          />
          </div>

          {/* Desktop: Thumbnail Strip below preview */}
          {totalImages > 1 && !demoMode && (
            <div className="hidden md:block">
              <ThumbnailStrip
                images={images}
                currentIndex={currentIndex}
                onSelectImage={onIndexChange}
              />
            </div>
          )}
        </div>

        {!demoMode && (
          <div className={`flex-shrink-0 items-center justify-center gap-3 border-t border-zinc-800 bg-black px-4 py-3 ${transform.isCropping ? 'hidden' : 'hidden md:flex'}`} role="toolbar" aria-label="Desktop editor actions">
            {!isWideDesktop && (
              <Button variant="outline" onClick={handleTuningOpen} disabled={!currentImage.recipe} aria-label={isPanelOpen ? 'Close Adjust inspector' : 'Open Adjust inspector'} aria-expanded={isPanelOpen}>
                <Settings2 className="size-4" aria-hidden="true" /> Adjust
              </Button>
            )}
            <Button variant="outline" onClick={handleCropClick} aria-label="Open Crop inspector">
              <Crop className="size-4" aria-hidden="true" /> Crop
            </Button>
            {totalImages > 1 && currentImage.recipe && (
              <Button variant="outline" onClick={handleApplyToAll} aria-label={`Apply current preset to all ${totalImages} images`}>
                <Layers className="size-4" aria-hidden="true" /> Apply to all
              </Button>
            )}
            {totalImages > 1 && (
              <Button variant="outline" onClick={handleExportAll} disabled={!canExportAll || isBatchExporting || isExporting} aria-label="Export all photos">
                <Layers className="size-4" aria-hidden="true" /> Export all
              </Button>
            )}
            <Button onClick={handleExport} disabled={!currentImage.recipe || isExporting || isBatchExporting} aria-label="Export processed image (Ctrl+S)">
              {isExporting ? <Spinner className="size-4" randomColor /> : <Share className="size-4" aria-hidden="true" />}
              {isExporting ? 'Exporting…' : 'Export'}
            </Button>
          </div>
        )}

        <div className={`hidden flex-shrink-0 border-t border-zinc-800 bg-black md:block ${transform.isCropping ? '' : 'md:hidden'}`}>
          <div className="flex justify-center gap-2 border-b border-zinc-800 px-4 py-2">
            <Button variant="outline" size="sm" onClick={transform.rotateClockwise} aria-label="Rotate 90 degrees clockwise">
              <RotateCw className="size-4" aria-hidden="true" /> Rotate
            </Button>
            <Button variant="outline" size="sm" onClick={transform.flipHorizontal} aria-label="Flip horizontally">
              <FlipHorizontal2 className="size-4" aria-hidden="true" /> Flip
            </Button>
          </div>
          <CropPanel
            cropRatio={transform.cropRatio}
            fineAngle={transform.transformState.fineAngle}
            cropScale={transform.transformState.cropScale}
            onCropRatioChange={transform.setCropRatio}
            onFineAngleChange={transform.setFineAngle}
            onCropScaleChange={transform.setCropScale}
            onInteractionChange={setIsCropControlActive}
            onApply={transform.applyCrop}
            onCancel={transform.cancelCrop}
          />
        </div>

        {/* Mobile: contextual controls */}
        <div className={`flex-shrink-0 md:hidden ${transform.isCropping ? 'hidden' : ''}`}>
          {mobileMode === 'presets' && (
            <RecipePanel
              sourceImage={transform.transformedThumbnail}
              activeRecipeId={currentImage.recipe?.id ?? null}
              favoriteIds={getFavoriteIds()}
              onRecipeSelect={handleRecipeSelect}
              onRandomRecipe={handleRandomRecipe}
              onFavoriteToggle={toggleFavorite}
              horizontal
              smartPicksIds={smartPicksIds}
            />
          )}
          {mobileMode === 'adjust' && (
            <MobileAdjustControls
              recipe={currentImage.recipe}
              settings={tuning.customSettings}
              session={adjustSession}
              onOpen={openAdjustTool}
              onChange={changeAdjustValue}
              onReset={resetAdjustValue}
            />
          )}
          {mobileMode === 'crop' && (
            <div className="flex h-28 items-center gap-2 border-t border-zinc-800 bg-black p-3" aria-label="Crop tools">
              <Button variant="outline" onClick={handleCropClick} className="min-h-20 flex-1" aria-label="Open crop session">Crop</Button>
              <Button variant="outline" onClick={transform.rotateClockwise} className="min-h-20 flex-1" aria-label="Rotate 90 degrees clockwise">Rotate</Button>
              <Button variant="outline" onClick={transform.flipHorizontal} className="min-h-20 flex-1" aria-label="Flip horizontally">Flip</Button>
            </div>
          )}
        </div>

        <nav className={`grid h-12 flex-shrink-0 ${demoMode ? 'grid-cols-1' : 'grid-cols-3'} border-t border-zinc-800 bg-black md:hidden ${transform.isCropping ? 'hidden' : ''}`} aria-label="Editor modes">
          {(demoMode ? ['presets'] as const : ['presets', 'adjust', 'crop'] as const).map(mode => (
            <button
              key={mode}
              type="button"
              onClick={() => changeMobileMode(mode)}
              className={`min-h-11 text-sm capitalize ${mobileMode === mode ? 'text-white' : 'text-zinc-500'}`}
              aria-current={mobileMode === mode ? 'page' : undefined}
            >
              {mode}
            </button>
          ))}
        </nav>

        {/* Mobile: Action buttons (Apply to all + Export) */}
        <div className={`flex-shrink-0 p-3 md:hidden ${transform.isCropping ? 'hidden' : ''}`}>
          <div className="flex h-11 gap-2">
            {demoMode ? (
              <>
                <input
                  ref={demoUploadRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
                  multiple
                  className="sr-only"
                  aria-label="Choose photos or video to edit"
                  onChange={(event) => {
                    const files = Array.from(event.target.files ?? [])
                    event.target.value = ''
                    const type = files.length === 1 && files[0].type.startsWith('video/') ? 'video' : 'image'
                    if (onMediaSelect) void onMediaSelect(files, type)
                    else void onAddImages(files)
                  }}
                />
                <Button onClick={() => demoUploadRef.current?.click()} className="w-full" aria-label="Upload photos">
                  Upload photos
                </Button>
              </>
            ) : adjustSession ? (
              <>
                <Button variant="outline" onClick={cancelAdjustSession} className="flex-1">Cancel</Button>
                <Button onClick={() => setAdjustSession(null)} className="flex-1">Done</Button>
              </>
            ) : (
              <>
                {!currentImage.recipe ? (
                  <Button disabled className="w-full" aria-label="Choose a preset to export">
                    Choose a preset to export
                  </Button>
                ) : totalImages > 1 ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={handleApplyToAll}
                      aria-label={`Apply current preset to all ${totalImages} images`}
                      className="flex-1"
                    >
                      <Layers className="size-4" aria-hidden="true" />
                      Apply to all
                    </Button>
                    <Button
                      onClick={handleExportAll}
                      disabled={!canExportAll || isBatchExporting || isExporting}
                      aria-label="Export all photos"
                      aria-busy={isBatchExporting}
                      className="flex-1"
                    >
                      <Layers className="size-4" aria-hidden="true" />
                      Export all
                    </Button>
                  </>
                ) : (
                  <Button
                    onClick={handleExport}
                    disabled={isExporting || isBatchExporting}
                    aria-label={isExporting ? 'Exporting...' : 'Export processed image'}
                    aria-busy={isExporting}
                    className="w-full"
                  >
                    {isExporting ? <Spinner className="size-4" randomColor /> : <Share className="size-4" aria-hidden="true" />}
                    {isExporting ? 'Exporting...' : 'Export'}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Desktop: Recipe panel */}
      <DesktopSidePanel
        isOpen={isAdjustPanelVisible}
        enabled={!demoMode}
        activeRecipe={currentImage.recipe}
        customSettings={tuning.customSettings}
        onSettingsChange={tuning.updateSettings}
        onTuningApply={tuning.applyTuning}
        onTuningCancel={tuning.cancelTuning}
      />

      {/* Mobile: CropPanel */}
      <MobileCropPanel
        isOpen={transform.isCropping}
        cropRatio={transform.cropRatio}
        fineAngle={transform.transformState.fineAngle}
        cropScale={transform.transformState.cropScale}
        onCropRatioChange={transform.setCropRatio}
        onFineAngleChange={transform.setFineAngle}
        onCropScaleChange={transform.setCropScale}
        onInteractionChange={setIsCropControlActive}
        onApply={transform.applyCrop}
        onCancel={transform.cancelCrop}
      />

      {/* Help dialog */}
      <HelpDialog
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        totalImages={totalImages}
        mobile={!isMdUp}
        hasUnreadUpdate={hasUnreadHelp}
        onUpdateViewed={() => {
          try {
            localStorage.setItem('photochrome-help-version', APP_VERSION)
          } catch {
            // The read state is optional when storage is unavailable.
          }
          setHasUnreadHelp(false)
        }}
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

      {batchProgress && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[200] p-4"
          role="status"
          aria-label="Batch export progress"
          aria-live="polite"
        >
          <div className="w-full max-w-sm space-y-4 rounded-2xl bg-zinc-900 p-6">
            <div>
              <p className="font-medium text-white">Exporting all photos</p>
              <p className="mt-1 truncate text-xs text-zinc-400">
                {batchProgress.fileName ?? 'Preparing archive...'}
              </p>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full bg-white transition-[width] duration-200"
                style={{ width: `${batchProgress.total === 0 ? 100 : (batchProgress.current / batchProgress.total) * 100}%` }}
              />
            </div>
            <p className="text-xs text-zinc-400">
              {batchProgress.current}/{batchProgress.total} · {batchProgress.exported} exported · {batchProgress.skipped} skipped · {batchProgress.errors} errors
            </p>
            <Button variant="outline" className="w-full" onClick={() => batchAbortControllerRef.current?.abort()}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {completion && (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Export complete">
          <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-center">
            <div className="mx-auto mb-4 grid size-24 grid-cols-2 gap-1 overflow-hidden rounded-xl" aria-hidden="true">
              {images.slice(0, 4).map(image => (
                <CompletionThumbnail key={image.id} imageData={image.transformedThumbnail} />
              ))}
            </div>
            <h2 className="text-xl font-semibold text-white">Export complete</h2>
            <p className="mt-2 text-sm text-zinc-400">
              {completion.kind === 'single'
                ? 'Your photo has been saved.'
                : `${completion.exported} exported${completion.skipped ? ` · ${completion.skipped} skipped` : ''}${completion.errors ? ` · ${completion.errors} errors` : ''}`}
            </p>
            <div className="mt-6 flex gap-2">
              <Button variant="outline" onClick={onBack} className="flex-1">New edit</Button>
              <Button onClick={() => setCompletion(null)} className="flex-1">Back to editor</Button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

// ============================================================================
// Sub-components
// ============================================================================

function CompletionThumbnail({ imageData }: { imageData: ImageData }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    canvas.width = imageData.width
    canvas.height = imageData.height
    canvas.getContext('2d')?.putImageData(imageData, 0, 0)
  }, [imageData])
  return <canvas ref={ref} className="size-full object-cover" />
}

interface HeaderProps {
  fileName: string
  currentIndex: number
  totalImages: number
  onAddImages: (files: File[]) => Promise<void>
  onHelp: () => void
  hasUnreadHelp: boolean
  demoMode: boolean
  onDemoUpload: () => void
}

function Header({
  fileName,
  currentIndex,
  totalImages,
  onAddImages,
  onHelp,
  hasUnreadHelp,
  demoMode,
  onDemoUpload,
}: HeaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  return (
    <header className="flex-shrink-0 px-3 py-2 md:p-4">
      <div className="flex items-center justify-between md:hidden min-h-11">
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          className="sr-only"
          aria-label="Add photos to current batch"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? [])
            event.target.value = ''
            void onAddImages(files)
          }}
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => inputRef.current?.click()}
          className="h-11 min-w-11 gap-1 px-2 text-zinc-300"
          aria-label="Add photos"
        >
          <Plus className="size-4" aria-hidden="true" />
          Add
        </Button>
        <div className="min-w-0 flex-1 px-2 text-center">
          <p className="truncate text-sm font-medium text-white">{fileName}</p>
          {totalImages > 1 && (
            <p className="text-[11px] text-zinc-500">{currentIndex + 1} of {totalImages}</p>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onHelp}
          className="relative h-11 min-w-11 gap-1 px-2 text-zinc-300"
          aria-label="Help"
        >
          <HelpCircle className="size-4" aria-hidden="true" />
          Help
          {hasUnreadHelp && (
            <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-white" aria-hidden="true" />
          )}
        </Button>
      </div>
      <div className="hidden min-h-12 items-center gap-3 md:flex">
        {!demoMode && (
          <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} className="gap-2" aria-label="Add photos">
            <Plus className="size-4" aria-hidden="true" /> Add
          </Button>
        )}
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-sm font-medium text-zinc-100">{fileName}</p>
          <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-600">
            Photochrome {APP_VERSION}{totalImages > 1 ? ` · ${currentIndex + 1} of ${totalImages}` : ''}
          </p>
        </div>
        {demoMode ? (
          <Button onClick={onDemoUpload} aria-label="Upload photos">Upload photos</Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={onHelp} className="relative text-zinc-400" aria-label="Help">
            <HelpCircle className="size-4" aria-hidden="true" /> Help
            {hasUnreadHelp && <span className="absolute right-1 top-1 size-1.5 rounded-full bg-white" aria-hidden="true" />}
          </Button>
        )}
      </div>
    </header>
  )
}

interface DesktopSidePanelProps {
  isOpen: boolean
  enabled: boolean
  activeRecipe: Recipe | null
  customSettings: RecipeSettings
  onSettingsChange: (settings: RecipeSettings) => void
  onTuningApply: () => void
  onTuningCancel: () => void
}

function DesktopSidePanel({
  isOpen,
  enabled,
  activeRecipe,
  customSettings,
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
        ${isOpen && enabled ? 'w-60 xl:w-64' : 'w-0 border-l-0'}
      `}
      aria-label="Editing inspector"
    >
      <div className="flex h-full w-60 flex-col xl:w-64">
        <div className="min-h-0 flex-1 overflow-hidden">
          {activeRecipe ? (
            <TuningPanel
              recipe={activeRecipe}
              customSettings={customSettings}
              onSettingsChange={onSettingsChange}
              onApply={onTuningApply}
              onCancel={onTuningCancel}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-6 text-center">
              <Settings2 className="mb-4 size-8 text-zinc-700" aria-hidden="true" />
              <h2 className="text-sm font-medium text-zinc-200">Choose a film first</h2>
              <p className="mt-2 text-xs leading-5 text-zinc-500">Adjustments inherit their starting values from the selected preset.</p>
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}

interface DesktopPresetPanelProps {
  activeRecipe: Recipe | null
  transformedThumbnail: ImageData
  favoriteIds: string[]
  onRecipeSelect: (recipe: Recipe) => void
  onRandomRecipe: () => void
  onFavoriteToggle: (id: string) => void
  smartPicksIds: string[]
}

function DesktopPresetPanel({ activeRecipe, transformedThumbnail, favoriteIds, onRecipeSelect, onRandomRecipe, onFavoriteToggle, smartPicksIds }: DesktopPresetPanelProps) {
  return (
    <aside className="hidden h-full w-52 flex-shrink-0 overflow-hidden border-r border-zinc-800 bg-black md:block xl:w-56" aria-label="Preset browser">
      <div className="h-full w-52 xl:w-56">
        <RecipePanel sourceImage={transformedThumbnail} activeRecipeId={activeRecipe?.id ?? null} favoriteIds={favoriteIds} onRecipeSelect={onRecipeSelect} onRandomRecipe={onRandomRecipe} onFavoriteToggle={onFavoriteToggle} smartPicksIds={smartPicksIds} />
      </div>
    </aside>
  )
}

interface MobileCropPanelProps {
  isOpen: boolean
  cropRatio: AspectRatio
  fineAngle: number
  cropScale: number
  onCropRatioChange: (ratio: AspectRatio) => void
  onFineAngleChange: (angle: number) => void
  onCropScaleChange: (scale: number) => void
  onInteractionChange: (active: boolean) => void
  onApply: () => void
  onCancel: () => void
}

function MobileCropPanel({
  isOpen,
  cropRatio,
  fineAngle,
  cropScale,
  onCropRatioChange,
  onFineAngleChange,
  onCropScaleChange,
  onInteractionChange,
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
        fineAngle={fineAngle}
        cropScale={cropScale}
        onCropRatioChange={onCropRatioChange}
        onFineAngleChange={onFineAngleChange}
        onCropScaleChange={onCropScaleChange}
        onInteractionChange={onInteractionChange}
        onApply={onApply}
        onCancel={onCancel}
      />
    </div>
  )
}
