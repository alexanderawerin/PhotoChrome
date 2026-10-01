import { useState, useCallback, useRef, useEffect, useLayoutEffect, useMemo } from 'react'
import { Crop, FlipHorizontal2, Layers, Plus, RotateCw, Settings2, Share, HelpCircle } from 'lucide-react'
import { APP_VERSION, APP_URL } from '../constants'
import { Button } from './ui/button'
import { Spinner } from './ui/spinner'
import { Preview } from './Preview'
import { FilmSelector } from './FilmSelector'
import { getBaseFilm, hasModifiedSettings, isBaseProfile } from '../engine/film-profiles'
import { AdvancedPanel } from './AdvancedPanel'
import { CropPanel } from './CropPanel'
import { HelpDialog } from './HelpDialog'
import { ExportCompletion, type ExportCompletionState } from './ExportCompletion'
import { ThumbnailStrip } from './ThumbnailStrip'
import { ImageCounter } from './ImageCounter'
import { Recipe, ImageItem } from '../engine/types'
import { ImageProcessor } from '../engine/processor'
import { prepareProcessingPlan } from '../engine/processing-plan'
import { editorCommands } from '../engine/editor-commands'
import { useEditorSession } from '../hooks/useEditorSession'
import { useIsMdUp } from '../hooks/useIsMdUp'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import { useViewportHeight, getViewportHeightStyle } from '../hooks/useViewportHeight'
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

  const [preview, setPreview] = useState<{ imageId: string; data: ImageData; owner: object | null }>({ imageId: currentImage.id, data: currentImage.transformedThumbnail, owner: null })
  const [isProcessing, setIsProcessing] = useState(false)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewRetry, setPreviewRetry] = useState(0)
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
  const exportSnapshotRef = useRef<{ kind: 'single'; image: ImageItem } | { kind: 'batch'; images: ImageItem[] } | null>(null)

  // ============================================================================
  // Custom Hooks
  // ============================================================================

  const viewportHeight = useViewportHeight()
  const isMdUp = useIsMdUp()
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
  const isCropping = edit.session?.kind === 'crop'
  const isTuning = edit.session?.kind === 'tuning'
  const { settings, profile, transformedThumbnail } = edit
  const previewOwner = useMemo(() => ({ profile, transformedThumbnail, settings }), [profile, transformedThumbnail, settings])
  const isPreviewReady = preview.owner === previewOwner && !previewError
  const commands = editorCommands({
    demo: demoMode,
    loading: interactionDisabled,
    processing: !isPreviewReady,
    modal: isHelpOpen || completion !== null,
    exporting: isExporting || batchProgress !== null,
    applying: isApplyingToAll,
    session: edit.session?.kind,
    hasColor: !!currentImage.recipe,
    multiplePhotos: totalImages > 1,
  })

  // Both committed edits and the active draft feed the same preview path.
  useEffect(() => {
    const controller = new AbortController()
    const loadAndPreview = async () => {
      setIsProcessing(true)
      setPreviewError(null)
      try {
        const plan = profile
          ? await prepareProcessingPlan(profile, transformedThumbnail, settings, { signal: controller.signal })
          : null
        if (!controller.signal.aborted) {
          const data = plan ? ImageProcessor.process(transformedThumbnail, plan) : transformedThumbnail
          setPreview({ imageId: currentImage.id, data, owner: previewOwner })
        }
      } catch (error) {
        if (!controller.signal.aborted) setPreviewError(error instanceof Error ? error.message : 'Film processing failed')
      } finally {
        if (!controller.signal.aborted) setIsProcessing(false)
      }
    }
    void loadAndPreview()
    return () => controller.abort()
  }, [currentImage.id, profile, transformedThumbnail, settings, previewRetry, previewOwner])

  // ============================================================================
  // Recipe Processing
  // ============================================================================

  /**
   * Выбор рецепта (обновляет только текущее изображение)
   */
  const handleRecipeSelect = useCallback((recipe: Recipe | null) => {
    if (!commands.selectColor) return
    onImageUpdate(currentImage.id, {
      recipe,
      customSettings: {} // Сброс настроек при смене рецепта
    })
    edit.cancel()
    setIsPanelOpen(false)
    setMobileMode('presets')
  }, [currentImage.id, onImageUpdate, edit, commands.selectColor])

  /**
   * Применить текущий рецепт и настройки ко всем изображениям
   */
  const handleApplyToAll = useCallback(async () => {
    if (!commands.applyToAll) return

    setIsApplyingToAll(true)

    try {
      const recipe = currentImage.recipe ? structuredClone(currentImage.recipe) : null
      const customSettings = structuredClone(currentImage.customSettings)

      images.forEach(img => {
        if (img.id !== currentImage.id) {
          onImageUpdate(img.id, { recipe, customSettings: structuredClone(customSettings) })
        }
      })

    } finally {
      setIsApplyingToAll(false)
    }
  }, [currentImage, images, onImageUpdate, commands.applyToAll])

  // ============================================================================
  // Panel & UI
  // ============================================================================

  /**
   * Переключение видимости панели
   */
  const advancedFocusRef = useRef<HTMLElement | null>(null)
  const closeAdvanced = useCallback((apply: boolean) => {
    if (apply && !isPreviewReady) return
    if (apply) edit.commit()
    else edit.cancel()
    setIsPanelOpen(false)
    setMobileMode('presets')
    const trigger = advancedFocusRef.current
    requestAnimationFrame(() => { if (trigger?.isConnected) trigger.focus({ preventScroll: true }) })
  }, [edit, isPreviewReady])

  const handleTuningOpen = useCallback(() => {
    if (isTuning) {
      closeAdvanced(false)
      return
    }
    if (!commands.advanced) return
    advancedFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    edit.openTuning()
    setIsPanelOpen(true)
    if (!isMdUp) setMobileMode('adjust')
  }, [isTuning, commands.advanced, edit, isMdUp, closeAdvanced])

  const handleCropClick = useCallback(() => {
    if (!commands.geometry) return
    setIsPanelOpen(false)
    if (!isMdUp) setMobileMode('crop')
    // Desktop Apply preserves its established panel behavior. A mobile tool
    // is canceled when leaving it; openCrop replaces that draft atomically.
    edit.openCrop()
  }, [isMdUp, edit, commands.geometry])

  const changeMobileMode = (mode: 'presets' | 'adjust' | 'crop') => {
    if (mode === 'adjust') {
      if (!isTuning) handleTuningOpen()
      return
    }
    if (!commands.selectColor || (demoMode && mode !== 'presets')) return
    edit.cancel()
    setIsPanelOpen(false)
    setMobileMode(mode)
  }

  useEffect(() => {
    if (!isTuning) setIsPanelOpen(false)
  }, [isTuning])

  useEffect(() => {
    setIsPanelOpen(false)
    setMobileMode('presets')
  }, [currentImage.id])

  // ============================================================================
  // Export
  // ============================================================================

  const handleExport = useCallback(async (retry = false) => {
    if (!commands.export || exportAbortControllerRef.current || batchAbortControllerRef.current) return

    if (!retry || exportSnapshotRef.current?.kind !== 'single') {
      exportSnapshotRef.current = { kind: 'single', image: snapshotPhoto(currentImage) }
    }
    const exportImage = exportSnapshotRef.current.image
    exportKindRef.current = 'single'
    exportFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const controller = new AbortController()
    exportAbortControllerRef.current = controller
    setExportError(null)
    setIsExporting(true)
    try {
      const mergedSettings = { ...exportImage.recipe?.settings, ...exportImage.customSettings }
      const plan = await prepareProcessingPlan(
        exportImage.recipe,
        exportImage.transformedOriginal,
        mergedSettings,
        { signal: controller.signal }
      )

      const baseName = exportImage.fileName.replace(/\.[^.]+$/, '')
      const result = await exportPhoto({
        imageData: exportImage.transformedOriginal,
        plan,
        fileName: `photochrome_${exportImage.recipe?.id ?? 'original'}_${baseName}.jpg`,
        watermarkText: APP_URL,
        exifInfo: {
          recipeName: exportImage.recipe?.name ?? 'Original',
          recipeId: exportImage.recipe?.id ?? 'original',
          settings: mergedSettings,
        },
        signal: controller.signal,
      })
      if (controller.signal.aborted) return
      if (result.status === 'error') setExportError(result.error)
      if (result.status === 'success') setCompletion({ kind: 'single', exported: 1, skipped: 0, errors: 0, previews: result.preview ? [result.preview] : [] })
    } catch (error) {
      if (!controller.signal.aborted) setExportError({ code: 'processing-failed', message: error instanceof Error ? error.message : 'Film processing failed' })
    } finally {
      if (exportAbortControllerRef.current === controller) {
        exportAbortControllerRef.current = null
      }
      setIsExporting(false)
    }
  }, [currentImage, commands.export])

  const handleExportAll = useCallback(async (retry = false) => {
    if (!commands.export || exportAbortControllerRef.current || batchAbortControllerRef.current) return
    if (!retry || exportSnapshotRef.current?.kind !== 'batch') {
      exportSnapshotRef.current = { kind: 'batch', images: images.map(snapshotPhoto) }
    }
    const exportImages = exportSnapshotRef.current.images
    exportKindRef.current = 'batch'
    exportFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setExportError(null)
    const controller = new AbortController()
    batchAbortControllerRef.current = controller
    setCompletion(null)
    setBatchProgress({
      current: 0,
      total: exportImages.length,
      fileName: null,
      exported: 0,
      skipped: 0,
      errors: 0,
    })

    let result: BatchExportResult
    try {
      result = await exportPhotoBatch(exportImages, {
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
  }, [images, commands.export])

  const isBatchExporting = batchProgress !== null
  const canExportAll = images.length > 0

  useEffect(() => () => {
    exportAbortControllerRef.current?.abort()
    batchAbortControllerRef.current?.abort()
  }, [])

  // ============================================================================
  // Compare (before/after)
  // ============================================================================

  const handleCompareStart = useCallback(() => { if (commands.compare) setShowOriginal(true) }, [commands.compare])
  const handleCompareEnd = useCallback(() => setShowOriginal(false), [])
  useEffect(() => setShowOriginal(false), [currentImage.id, currentImage.recipe, commands.compare])

  // ============================================================================
  // Keyboard Shortcuts
  // ============================================================================

  useKeyboardShortcuts(
    {
      commands,
      isCropping: isCropping,
      isTuning: isTuning,
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
      onTuningCancel: () => closeAdvanced(false),
      onTuningApply: () => closeAdvanced(true),
      onPanelToggle: handleTuningOpen,
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
  const mobileCover = !isMdUp && mobileMode !== 'crop' && !isCropping && !isTuning

  return (
    <div 
      className="flex flex-col md:flex-row overflow-hidden"
      style={{ height: getViewportHeightStyle(viewportHeight) }}
    >
      {isMdUp && (
        <aside className="flex h-full w-[208px] shrink-0 flex-col overflow-y-auto border-r border-zinc-800 bg-black p-3 xl:w-[224px]" aria-label="Film browser">
          <FilmSelector activeRecipe={currentImage.recipe} onSelect={handleRecipeSelect} disabled={!commands.selectColor} />
        </aside>
      )}

      {/* Главный блок: фото + toolbar */}
      <div ref={editorStageRef} className="mobile-editor-stage relative isolate flex-1 bg-zinc-950 min-w-0 min-h-0 overflow-hidden md:flex md:flex-col">
        <div className="mobile-editor-header mobile-editor-surface relative z-20 flex-shrink-0">
        {/* Header */}
        <Header 
          compact={isTuning && !isMdUp}
          fileName={currentImage.fileName}
          currentIndex={currentIndex}
          totalImages={totalImages}
          onAddImages={onAddImages}
          onHelp={() => { if (commands.help) setIsHelpOpen(true) }}
          hasUnreadHelp={hasUnreadHelp}
          actionsDisabled={!commands.add}
          demoMode={demoMode}
          onDemoUpload={() => demoUploadRef.current?.click()}
        />

        <div className="mx-3 mb-2 flex items-center gap-2 text-xs text-zinc-400" aria-label="Applied color">
          {(isProcessing || previewError) && <span>{previewError ? 'Unavailable:' : 'Preparing:'}</span>}
          <span>{currentImage.recipe ? getBaseFilm(currentImage.recipe.filmSimulation)?.name : 'Original'}</span>
          {currentImage.recipe && !isBaseProfile(currentImage.recipe) && <span>· {currentImage.recipe.name}</span>}
          {hasModifiedSettings(currentImage.recipe, currentImage.customSettings) && <span>· Modified</span>}
          {currentImage.recipe && !demoMode && !edit.session && (
            <button type="button" disabled={!commands.selectColor || !!edit.session} className="ml-auto min-h-9 shrink-0 underline disabled:opacity-40"
              onClick={() => handleRecipeSelect(getBaseFilm(currentImage.recipe!.filmSimulation) ?? null)}>Restore base film</button>
          )}
        </div>

        {previewError && (
          <div role="alert" className="mx-3 mb-2 flex items-center gap-3 rounded-lg bg-rose-950 px-3 py-2 text-sm text-rose-100">
            <p className="min-w-0 flex-1">Film unavailable: {previewError}</p>
            <Button size="sm" variant="outline" onClick={() => setPreviewRetry(value => value + 1)}>Retry film</Button>
          </div>
        )}

        {exportError && (
          <div
            role="alert"
            className="mx-3 md:mx-6 mb-2 flex items-center gap-3 rounded-lg border border-rose-900/70 bg-rose-950/80 px-3 py-2 text-sm text-rose-100"
          >
            <p className="min-w-0 flex-1">
              Export failed: {exportError.message}
            </p>
            <Button size="sm" variant="outline" onClick={() => exportKindRef.current === 'batch' ? handleExportAll(true) : handleExport(true)} disabled={!commands.export}>
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
            gestureContextKey={`${currentImage.id}:${currentImage.recipe?.id ?? 'original'}`}
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
            enableSwipe={totalImages > 1 && commands.navigate}
            onSwipeLeft={onNextImage}
            onSwipeRight={onPreviousImage}
          />
          </div>

          {/* Desktop: Thumbnail Strip below preview */}
          {isMdUp && totalImages > 1 && !demoMode && (
            <div className="hidden md:block">
              <ThumbnailStrip
                images={images}
                currentIndex={currentIndex}
                onSelectImage={index => { if (commands.navigate) onIndexChange(index) }}
              />
            </div>
          )}
        </div>

        {!demoMode && (
          <div className={`flex-shrink-0 flex-wrap items-center justify-center gap-3 border-t border-zinc-800 bg-black px-4 py-3 ${isCropping ? 'hidden' : 'hidden md:flex'}`} role="toolbar" aria-label="Desktop editor actions">
              <Button variant="outline" onClick={handleTuningOpen} disabled={!commands.advanced} aria-label={isPanelOpen ? 'Close Advanced settings' : 'Open Advanced settings'} aria-expanded={isPanelOpen}>
                <Settings2 className="size-4" aria-hidden="true" /> Advanced
              </Button>
            <Button variant="outline" onClick={handleCropClick} disabled={!commands.geometry} aria-label="Open Crop inspector">
              <Crop className="size-4" aria-hidden="true" /> Crop
            </Button>
            {totalImages > 1 && (
              <Button variant="outline" onClick={handleApplyToAll} disabled={!commands.applyToAll} aria-label={`Apply current color to all ${totalImages} images`}>
                <Layers className="size-4" aria-hidden="true" /> Apply to all
              </Button>
            )}
            {totalImages > 1 && (
              <Button variant="outline" onClick={() => handleExportAll()} disabled={!canExportAll || !commands.export} aria-label="Export all photos">
                <Layers className="size-4" aria-hidden="true" /> Export all
              </Button>
            )}
            <Button onClick={() => handleExport()} disabled={!commands.export} aria-label="Export processed image (Ctrl+S)">
              {isExporting ? <Spinner className="size-4" randomColor /> : <Share className="size-4" aria-hidden="true" />}
              {isExporting ? 'Exporting…' : 'Export'}
            </Button>
          </div>
        )}

        <div className={`hidden flex-shrink-0 border-t border-zinc-800 bg-black md:block ${isCropping ? '' : 'md:hidden'}`}>
          <div className="flex justify-center gap-2 border-b border-zinc-800 px-4 py-2">
            <Button variant="outline" size="sm" onClick={() => { if (commands.cropGeometry) edit.rotate(90) }} disabled={!commands.cropGeometry} aria-label="Rotate 90 degrees clockwise">
              <RotateCw className="size-4" aria-hidden="true" /> Rotate
            </Button>
            <Button variant="outline" size="sm" onClick={() => { if (commands.cropGeometry) edit.flip() }} disabled={!commands.cropGeometry} aria-label="Flip horizontally">
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
          {!isMdUp && mobileMode === 'presets' && (
            <FilmSelector
              activeRecipe={currentImage.recipe}
              onSelect={handleRecipeSelect}
              disabled={!commands.selectColor}
              horizontal
              className="px-3 py-3"
            />
          )}
          {!isMdUp && isTuning && profile && (
            <div className="h-[58dvh] min-h-0">
              <AdvancedPanel profile={profile} settings={settings} sourceImage={transformedThumbnail}
                onProfileSelect={edit.selectDraftProfile} onSettingsChange={edit.changeSettings}
                onRestoreBase={edit.restoreDraftBase} onApply={() => closeAdvanced(true)} onCancel={() => closeAdvanced(false)}
                disabled={interactionDisabled || isExporting || isBatchExporting} applyDisabled={!isPreviewReady} />
            </div>
          )}
          {!isMdUp && mobileMode === 'crop' && !isCropping && (
            <div className="flex h-28 items-center gap-2 border-t border-white/10 bg-transparent p-3" aria-label="Crop tools">
              <Button variant="outline" onClick={handleCropClick} disabled={!commands.geometry} className="min-h-20 flex-1" aria-label="Open crop session">Crop</Button>
              <Button variant="outline" onClick={() => { if (commands.geometry) edit.rotate(90) }} disabled={!commands.geometry} className="min-h-20 flex-1" aria-label="Rotate 90 degrees clockwise">Rotate</Button>
              <Button variant="outline" onClick={() => { if (commands.geometry) edit.flip() }} disabled={!commands.geometry} className="min-h-20 flex-1" aria-label="Flip horizontally">Flip</Button>
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
              <span className="min-w-0 break-words">{mode === 'presets' ? 'Films' : mode === 'adjust' ? 'Advanced' : 'Crop'}</span>
            </button>
          ))}
        </nav>

        {/* Mobile: Action buttons (Apply to all + Export) */}
        <div
          className={`mobile-editor-actions flex-shrink-0 p-3 md:hidden ${isTuning ? 'hidden' : ''}`}
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
            ) : (
              <>
                {totalImages > 1 ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={handleApplyToAll}
                      disabled={!commands.applyToAll}
                      aria-label={`Apply current color to all ${totalImages} images`}
                      className="flex-1"
                    >
                      <Layers className="size-4" aria-hidden="true" />
                      Apply to all
                    </Button>
                    <Button
                      onClick={() => handleExportAll()}
                      disabled={!canExportAll || !commands.export}
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
                    onClick={() => handleExport()}
                    disabled={!commands.export}
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

      {isMdUp && isTuning && profile && !demoMode && (
        <aside className="h-full w-[320px] shrink-0 overflow-hidden border-l border-zinc-800 bg-black xl:w-[384px]" aria-label="Editing inspector">
          <AdvancedPanel profile={profile} settings={settings} sourceImage={transformedThumbnail}
            onProfileSelect={edit.selectDraftProfile} onSettingsChange={edit.changeSettings}
            onRestoreBase={edit.restoreDraftBase} onApply={() => closeAdvanced(true)} onCancel={() => closeAdvanced(false)}
            disabled={interactionDisabled || isExporting || isBatchExporting} applyDisabled={!isPreviewReady} />
        </aside>
      )}

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

function snapshotPhoto(image: ImageItem): ImageItem {
  return { ...image, recipe: image.recipe ? structuredClone(image.recipe) : null,
    customSettings: structuredClone(image.customSettings), transform: structuredClone(image.transform) }
}

// ============================================================================
// Sub-components
// ============================================================================

interface HeaderProps {
  compact?: boolean
  actionsDisabled: boolean
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
  compact = false,
  actionsDisabled,
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
      {compact && <p className="truncate text-sm text-zinc-300">{fileName}</p>}
      <div className={`flex items-center justify-between md:hidden min-h-11 ${compact ? 'hidden' : ''}`}>
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
          onClick={() => inputRef.current?.click()} disabled={actionsDisabled}
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
          onClick={onHelp} disabled={actionsDisabled}
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
          <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={actionsDisabled} className="gap-2" aria-label="Add photos">
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
          <Button onClick={onDemoUpload} disabled={actionsDisabled} aria-label="Upload photos">Upload photos</Button>
        ) : (
          <Button variant="ghost" size="sm" onClick={onHelp} disabled={actionsDisabled} className="relative text-zinc-400" aria-label="Help">
            <HelpCircle className="size-4" aria-hidden="true" /> Help
            {hasUnreadHelp && <span className="absolute right-1 top-1 size-1.5 rounded-full bg-white" aria-hidden="true" />}
          </Button>
        )}
      </div>
    </header>
  )
}
