import { useState, useCallback, useRef, useEffect, useLayoutEffect } from 'react'
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
import { ExportCompletion, type ExportCompletionState } from './ExportCompletion'
import { ThumbnailStrip } from './ThumbnailStrip'
import { ImageCounter } from './ImageCounter'
import { Recipe, RecipeSettings, ImageItem } from '../engine/types'
import { ImageProcessor } from '../engine/processor'
import { loadSimulationLUT } from '../presets/simulations'
import { createProcessingPlan } from '../engine/processing-plan'
import { getAllRecipes } from '../presets/recipes'
import { useFavorites } from '../hooks/useFavorites'
import { useEditorSession } from '../hooks/useEditorSession'
import { useIsMdUp } from '../hooks/useIsMdUp'
import { useIsWideDesktop } from '../hooks/useIsWideDesktop'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { useViewportHeight, getViewportHeightStyle } from '../hooks/useViewportHeight'
import { useRecipeRecommendations } from '../hooks/useRecipeRecommendations'
import { createRandomRecipeSettings } from '../engine/editor-sessions'
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
  interactionDisabled?: boolean
  onMediaSelect?: (files: File[], type: 'image' | 'video') => Promise<void>
}

/**
 * Главный компонент редактора.
 * Использует композицию хуков для разделения ответственности:
 * - useEditorSession: черновики Adjust/Crop и сохранённые настройки
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
  interactionDisabled = false,
  onMediaSelect,
}: EditorProps) {
  // ============================================================================
  // State
  // ============================================================================

  const currentImage = images[currentIndex]
  const totalImages = images.length

  const [preview, setPreview] = useState({ imageId: currentImage.id, data: currentImage.transformedThumbnail })
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
  const [isCropControlActive, setIsCropControlActive] = useState(false)
  const [exportError, setExportError] = useState<Extract<PhotoExportResult, { status: 'error' }>['error'] | null>(null)
  const exportAbortControllerRef = useRef<AbortController | null>(null)
  const batchAbortControllerRef = useRef<AbortController | null>(null)
  const demoUploadRef = useRef<HTMLInputElement>(null)
  const editorStageRef = useRef<HTMLDivElement>(null)
  const workspaceRef = useRef<HTMLDivElement>(null)
  const [batchProgress, setBatchProgress] = useState<BatchExportProgress | null>(null)
  const [completion, setCompletion] = useState<ExportCompletionState | null>(null)
  const exportFocusRef = useRef<HTMLElement | null>(null)
  const exportKindRef = useRef<'single' | 'batch'>('single')

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

  // Let the grid reserve real header/dock space for Crop while the photo layer
  // spans the viewport. Cover mode ignores these insets, so tab changes keep it still.
  useLayoutEffect(() => {
    if (isMdUp) return
    const stage = editorStageRef.current
    const workspace = workspaceRef.current
    if (!stage || !workspace) return
    const updateInsets = () => {
      const stageRect = stage.getBoundingClientRect()
      const workspaceRect = workspace.getBoundingClientRect()
      stage.style.setProperty('--workspace-top', `${workspaceRect.top - stageRect.top}px`)
      stage.style.setProperty('--workspace-bottom', `${stageRect.bottom - workspaceRect.bottom}px`)
    }
    updateInsets()
    const observer = new ResizeObserver(updateInsets)
    observer.observe(stage)
    observer.observe(workspace)
    return () => observer.disconnect()
  }, [isMdUp])

  const edit = useEditorSession(currentImage, onImageUpdate)
  const adjustSession = edit.session?.kind === 'adjust' ? edit.session : null
  const isCropping = edit.session?.kind === 'crop'
  const isTuning = edit.session?.kind === 'tuning'
  const { settings, transformedThumbnail } = edit

  // Both committed edits and the active draft feed the same preview path.
  useEffect(() => {
    let cancelled = false
    const loadAndPreview = async () => {
      setIsProcessing(true)
      try {
        if (currentImage.recipe) await loadSimulationLUT(currentImage.recipe.filmSimulation)
        if (!cancelled) {
          const data = currentImage.recipe
            ? ImageProcessor.process(transformedThumbnail, createProcessingPlan(currentImage.recipe, transformedThumbnail, settings))
            : transformedThumbnail
          setPreview({ imageId: currentImage.id, data })
        }
      } finally {
        if (!cancelled) setIsProcessing(false)
      }
    }
    void loadAndPreview()
    return () => { cancelled = true }
  }, [currentImage.id, currentImage.recipe, transformedThumbnail, settings])

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
    edit.cancel()
  }, [currentImage.id, onImageUpdate, edit])

  /**
   * Применить текущий рецепт и настройки ко всем изображениям
   */
  const handleApplyToAll = useCallback(async () => {
    if (!currentImage.recipe) return

    setIsApplyingToAll(true)

    try {
      const { recipe } = currentImage
      const customSettings = settings
      edit.commit()

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
  }, [currentImage, images, onImageUpdate, settings, edit])

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
      edit.cancel()
    }
  }, [currentImage.id, currentImage.recipe, onImageUpdate, edit])

  // ============================================================================
  // Panel & UI
  // ============================================================================

  /**
   * Переключение видимости панели
   */
  const handlePanelToggle = useCallback(() => {
    if (isWideDesktop) return
    setIsPanelOpen(prev => !prev)
    if (isTuning) edit.commit()
  }, [isWideDesktop, isTuning, edit])

  const handleTuningOpen = useCallback(() => {
    if (isWideDesktop) return
    if (isPanelOpen) {
      if (isTuning) edit.commit()
      setIsPanelOpen(false)
    } else {
      edit.openTuning()
      setIsPanelOpen(true)
    }
  }, [isWideDesktop, isPanelOpen, isTuning, edit])

  const handleCropClick = useCallback(() => {
    if (demoMode) return
    if (!isMdUp) setMobileMode('crop')
    // Desktop Apply preserves its established panel behavior. A mobile tool
    // is canceled when leaving it; openCrop replaces that draft atomically.
    if (isTuning) edit.commit()
    edit.openCrop()
  }, [demoMode, isMdUp, isTuning, edit])

  const changeMobileMode = (mode: 'presets' | 'adjust' | 'crop') => {
    edit.cancel()
    setMobileMode(mode)
  }

  // ============================================================================
  // Export
  // ============================================================================

  const handleExport = useCallback(async () => {
    if (!currentImage.recipe || exportAbortControllerRef.current || batchAbortControllerRef.current) return

    exportKindRef.current = 'single'
    exportFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const controller = new AbortController()
    exportAbortControllerRef.current = controller
    setExportError(null)
    setIsExporting(true)
    try {
      const exportImage = edit.exportImage()
      const mergedSettings = { ...currentImage.recipe.settings, ...exportImage.customSettings }
      const plan = createProcessingPlan(
        currentImage.recipe,
        exportImage.transformedOriginal,
        mergedSettings
      )

      const baseName = currentImage.fileName.replace(/\.[^.]+$/, '')
      const result = await exportPhoto({
        imageData: exportImage.transformedOriginal,
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
      if (controller.signal.aborted) return
      if (result.status === 'error') setExportError(result.error)
      if (result.status === 'success') setCompletion({ kind: 'single', exported: 1, skipped: 0, errors: 0, previews: result.preview ? [result.preview] : [] })
    } finally {
      if (exportAbortControllerRef.current === controller) {
        exportAbortControllerRef.current = null
      }
      setIsExporting(false)
    }
  }, [currentImage, edit])

  const handleExportAll = useCallback(async () => {
    if (exportAbortControllerRef.current || batchAbortControllerRef.current) return
    exportKindRef.current = 'batch'
    exportFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setExportError(null)
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
      const currentExportImage = edit.exportImage()
      result = await exportPhotoBatch(images.map(image => image.id === currentExportImage.id ? currentExportImage : image), {
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

    if (controller.signal.aborted) return
    if (result.status === 'error') {
      setExportError({ code: 'processing-failed', message: result.message })
    }
    if (result.status === 'success') {
      let url: string | null = null
      try {
        url = URL.createObjectURL(result.blob)
        const anchor = document.createElement('a')
        anchor.href = url
        anchor.download = result.archiveName
        document.body.appendChild(anchor)
        try { anchor.click() } finally { anchor.remove() }
        setCompletion({
          kind: 'batch',
          exported: result.exported,
          skipped: result.skipped,
          errors: result.errors,
          previews: result.previews,
        })
      } catch (error) {
        setExportError({ code: 'download-failed', message: error instanceof Error ? error.message : 'Failed to download archive' })
      } finally {
        if (url) URL.revokeObjectURL(url)
      }
    }
  }, [images, edit])

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
      isCropping: isCropping,
      isTuning: isTuning,
      activeRecipe: currentImage.recipe,
      totalImages,
    },
    {
      onRotateClockwise: () => edit.rotate(90),
      onRotateCounterClockwise: () => edit.rotate(270),
      onFlipHorizontal: edit.flip,
      onCropOpen: handleCropClick,
      onCropCancel: edit.cancel,
      onCropApply: edit.commit,
      onTuningToggle: handleTuningOpen,
      onTuningCancel: edit.cancel,
      onTuningApply: edit.commit,
      onPanelToggle: handlePanelToggle,
      onExport: handleExport,
      onCompareStart: handleCompareStart,
      onCompareEnd: handleCompareEnd,
      onNextImage,
      onPreviousImage,
    },
    !interactionDisabled && !completion && !isExporting && !isBatchExporting
  )

  // ============================================================================
  // Render
  // ============================================================================

  const displayImage = showOriginal || preview.imageId !== currentImage.id ? transformedThumbnail : preview.data
  const mobileCover = !isMdUp && mobileMode !== 'crop' && !isCropping

  return (
    <div 
      className="flex flex-col md:flex-row overflow-hidden"
      style={{ height: getViewportHeightStyle(viewportHeight) }}
    >
      <DesktopPresetPanel
        activeRecipe={currentImage.recipe}
        transformedThumbnail={transformedThumbnail}
        favoriteIds={getFavoriteIds()}
        onRecipeSelect={handleRecipeSelect}
        onRandomRecipe={handleRandomRecipe}
        onFavoriteToggle={toggleFavorite}
        smartPicksIds={smartPicksIds}
      />

      {/* Главный блок: фото + toolbar */}
      <div ref={editorStageRef} className="mobile-editor-stage relative isolate flex-1 bg-zinc-950 min-w-0 min-h-0 overflow-hidden md:flex md:flex-col">
        <div className="mobile-editor-header mobile-editor-surface relative z-20 flex-shrink-0">
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
            <Button size="sm" variant="outline" onClick={() => exportKindRef.current === 'batch' ? handleExportAll() : handleExport()} disabled={isExporting || isBatchExporting}>
              Retry
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setExportError(null)}>
              Dismiss
            </Button>
          </div>
        )}

        </div>

        <div ref={workspaceRef} className="mobile-editor-workspace pointer-events-none min-h-0 md:hidden" aria-hidden="true" />
        <div className="mobile-editor-status pointer-events-none relative z-10 h-0 md:hidden">
          <ImageCounter currentIndex={currentIndex} totalImages={totalImages} />
          {isProcessing && (
            <div className={`absolute left-1/2 -translate-x-1/2 ${totalImages > 1 ? 'top-11' : 'top-2'}`}>
              <p className="rounded-full bg-black/70 px-3 py-1 text-xs text-white">Processing...</p>
            </div>
          )}
        </div>

        {/* A single photo layer stays behind the mobile chrome. */}
        <div className="mobile-photo-stage flex flex-1 min-h-0 flex-col overflow-hidden md:px-6" data-preview-fit={mobileCover ? 'cover' : 'contain'}>
          <div className="relative min-h-0 flex-1">
          {isProcessing && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 hidden md:block">
              <p className="text-sm text-zinc-400 bg-zinc-900/80 px-3 py-1 rounded">Processing...</p>
            </div>
          )}
          <Preview
            imageData={displayImage}
            cropMode={isCropping}
            cropRatio={edit.transformState.cropRatio}
            cropOffset={edit.transformState.cropOffset}
            onCropOffsetChange={cropOffset => edit.changeCrop({ cropOffset })}
            cropRect={edit.transformState.cropRect}
            onCropRectChange={cropRect => edit.changeCrop({ cropRect })}
            cropScale={edit.transformState.cropScale}
            onCropScaleChange={cropScale => edit.changeCrop({ cropScale })}
            cropGridActive={isCropControlActive}
            cover={mobileCover}
            onMouseDown={handleCompareStart}
            onMouseUp={handleCompareEnd}
            onMouseLeave={handleCompareEnd}
            enableSwipe={totalImages > 1 && !isCropping}
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
          <div className={`flex-shrink-0 items-center justify-center gap-3 border-t border-zinc-800 bg-black px-4 py-3 ${isCropping ? 'hidden' : 'hidden md:flex'}`} role="toolbar" aria-label="Desktop editor actions">
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

        <div className={`hidden flex-shrink-0 border-t border-zinc-800 bg-black md:block ${isCropping ? '' : 'md:hidden'}`}>
          <div className="flex justify-center gap-2 border-b border-zinc-800 px-4 py-2">
            <Button variant="outline" size="sm" onClick={() => edit.rotate(90)} aria-label="Rotate 90 degrees clockwise">
              <RotateCw className="size-4" aria-hidden="true" /> Rotate
            </Button>
            <Button variant="outline" size="sm" onClick={edit.flip} aria-label="Flip horizontally">
              <FlipHorizontal2 className="size-4" aria-hidden="true" /> Flip
            </Button>
          </div>
          <CropPanel
            cropRatio={edit.transformState.cropRatio}
            fineAngle={edit.transformState.fineAngle}
            cropScale={edit.transformState.cropScale}
            onCropRatioChange={cropRatio => edit.changeCrop({ cropRatio })}
            onFineAngleChange={fineAngle => edit.changeCrop({ fineAngle })}
            onCropScaleChange={cropScale => edit.changeCrop({ cropScale })}
            onInteractionChange={setIsCropControlActive}
            onApply={edit.commit}
            onCancel={edit.cancel}
          />
        </div>

        <div className="mobile-editor-dock mobile-editor-surface relative z-20 min-w-0 md:hidden">
        {/* Mobile: contextual controls */}
        <div className="flex-shrink-0 md:hidden">
          {mobileMode === 'presets' && (
            <RecipePanel
              sourceImage={transformedThumbnail}
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
              settings={settings}
              session={adjustSession}
              onOpen={edit.openAdjust}
              onChange={edit.changeAdjust}
              onReset={edit.resetAdjust}
            />
          )}
          {mobileMode === 'crop' && !isCropping && (
            <div className="flex h-28 items-center gap-2 border-t border-white/10 bg-transparent p-3" aria-label="Crop tools">
              <Button variant="outline" onClick={handleCropClick} className="min-h-20 flex-1" aria-label="Open crop session">Crop</Button>
              <Button variant="outline" onClick={() => edit.rotate(90)} className="min-h-20 flex-1" aria-label="Rotate 90 degrees clockwise">Rotate</Button>
              <Button variant="outline" onClick={edit.flip} className="min-h-20 flex-1" aria-label="Flip horizontally">Flip</Button>
            </div>
          )}
          {!isMdUp && isCropping && (
            <section className="border-t border-white/10" aria-label="Crop image">
              <CropPanel
                cropRatio={edit.transformState.cropRatio}
                fineAngle={edit.transformState.fineAngle}
                cropScale={edit.transformState.cropScale}
                onCropRatioChange={cropRatio => edit.changeCrop({ cropRatio })}
                onFineAngleChange={fineAngle => edit.changeCrop({ fineAngle })}
                onCropScaleChange={cropScale => edit.changeCrop({ cropScale })}
                onInteractionChange={setIsCropControlActive}
                onApply={edit.commit}
                onCancel={edit.cancel}
                showActions={false}
              />
            </section>
          )}
        </div>

        <nav className={`mobile-editor-modes grid min-h-12 flex-shrink-0 ${demoMode ? 'grid-cols-1' : 'grid-cols-3'} md:hidden`} aria-label="Editor modes">
          {(demoMode ? ['presets'] as const : ['presets', 'adjust', 'crop'] as const).map(mode => (
            <button
              key={mode}
              type="button"
              onClick={() => changeMobileMode(mode)}
              className={`relative flex min-h-11 flex-wrap items-center justify-center gap-x-1.5 gap-y-1 rounded-full px-1 py-2 text-sm capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${mobileMode === mode ? 'text-white' : 'text-zinc-400'}`}
              aria-current={mobileMode === mode ? 'page' : undefined}
            >
              {mode === 'presets' ? <Layers className="size-4 shrink-0" aria-hidden="true" /> : mode === 'adjust' ? <Settings2 className="size-4 shrink-0" aria-hidden="true" /> : <Crop className="size-4 shrink-0" aria-hidden="true" />}
              <span className="min-w-0 break-words">{mode}</span>
            </button>
          ))}
        </nav>

        {/* Mobile: Action buttons (Apply to all + Export) */}
        <div
          className="mobile-editor-actions flex-shrink-0 p-3 md:hidden"
          onKeyDown={event => {
            // Native button activation must take precedence over editor shortcuts.
            if (event.key === 'Enter' || event.key === ' ') event.stopPropagation()
          }}
        >
          <div className="flex h-11 gap-2 [&>button]:h-11">
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
            ) : isCropping ? (
              <>
                <Button variant="outline" onClick={edit.cancel} className="flex-1">Cancel</Button>
                <Button onClick={edit.commit} className="flex-1">Done</Button>
              </>
            ) : adjustSession ? (
              <>
                <Button variant="outline" onClick={edit.cancel} className="flex-1">Cancel</Button>
                <Button onClick={edit.commit} className="flex-1">Done</Button>
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
      </div>

      {/* Desktop: Recipe panel */}
      <DesktopSidePanel
        isOpen={isAdjustPanelVisible}
        enabled={!demoMode}
        activeRecipe={currentImage.recipe}
        customSettings={settings}
        onSettingsChange={edit.changeSettings}
        onTuningApply={edit.commit}
        onTuningCancel={edit.cancel}
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
            <div className="h-2 overflow-hidden rounded-full bg-zinc-800" role="progressbar" aria-label="Photos processed" aria-valuemin={0} aria-valuemax={batchProgress.total} aria-valuenow={batchProgress.current}>
              <div
                className="h-full bg-white transition-[width] duration-200 motion-reduce:transition-none"
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
        <ExportCompletion
          result={completion}
          onClose={() => setCompletion(null)}
          onNewEdit={() => {
            setCompletion(null)
            edit.cancel()
            setMobileMode('presets')
            onBack()
          }}
          onRestoreFocus={() => {
            if (exportFocusRef.current?.isConnected) exportFocusRef.current.focus({ preventScroll: true })
          }}
        />
      )}

    </div>
  )
}

// ============================================================================
// Sub-components
// ============================================================================

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
    <header className="mobile-editor-header-content flex-shrink-0 px-3 py-2 md:p-4">
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
          className="mobile-glass-control h-11 min-w-11 gap-1 rounded-full px-2 text-zinc-300"
          aria-label="Add photos"
        >
          <Plus className="size-4" aria-hidden="true" />
          Add
        </Button>
        <div className="mobile-editor-file min-w-0 flex-1 px-2 text-center">
          <p className="mobile-glass-control truncate rounded-xl px-2 py-2 text-sm font-medium text-white">{fileName}</p>
          {totalImages > 1 && (
            <p className="mobile-glass-control mx-auto -mt-1 w-fit rounded-b-lg px-2 pb-1 text-[11px] text-zinc-400">{currentIndex + 1} of {totalImages}</p>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onHelp}
          className="mobile-glass-control relative h-11 min-w-11 gap-1 rounded-full px-2 text-zinc-300"
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
          <p className="text-[10px] uppercase tracking-[0.18em] text-zinc-400">
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
              <p className="mt-2 text-xs leading-5 text-zinc-400">Adjustments inherit their starting values from the selected preset.</p>
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
