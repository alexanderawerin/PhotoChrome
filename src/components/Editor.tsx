import { useState, useCallback, useRef, useEffect, useLayoutEffect, useMemo } from 'react'
import { Plus, HelpCircle } from 'lucide-react'
import { APP_VERSION, APP_URL } from '../constants'
import { Button } from './ui/button'
import { Spinner } from './ui/spinner'
import { Preview } from './Preview'
import { FilmSelector } from './FilmSelector'
import { getBaseFilm, hasModifiedSettings, isBaseProfile } from '../engine/film-profiles'
import { AdvancedPanel } from './AdvancedPanel'
import { EditorHeader, EditorModes, EditorActions, EditorControlDock, CropTools, CropSessionControls, type EditorMode, type EditorAction } from './EditorChrome'
import { HelpDialog } from './HelpDialog'
import { ExportCompletion, type ExportCompletionState } from './ExportCompletion'
import { ThumbnailStrip } from './ThumbnailStrip'
import { Recipe, ImageItem } from '../engine/types'
import { ImageProcessor } from '../engine/processor'
import { materializePhotoPixels } from '../engine/photo-source'
import { clearPreviewCaches } from '../engine/preview-image'
import { disposePhotoWebGLProcessor } from '../engine/webgl/processor'
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
 * - useEditorSession: черновики Advanced/Crop и сохранённые настройки
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
  const [isHelpOpen, setIsHelpOpen] = useState(false)
  const [hasUnreadHelp, setHasUnreadHelp] = useState(() => {
    try {
      return localStorage.getItem('photochrome-help-version') !== APP_VERSION
    } catch {
      return true
    }
  })
  const [mode, setMode] = useState<EditorMode>('films')
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
    setIsProcessing(true)
    setPreviewError(null)
    const loadAndPreview = async () => {
      try {
        const plan = profile
          ? await prepareProcessingPlan(profile, transformedThumbnail, settings, { signal: controller.signal })
          : null
        const data = plan
          ? await ImageProcessor.processAsync(transformedThumbnail, plan, { signal: controller.signal })
          : transformedThumbnail
        if (!controller.signal.aborted) {
          setPreview({ imageId: currentImage.id, data, owner: previewOwner })
        }
      } catch (error) {
        if (!controller.signal.aborted) setPreviewError(error instanceof Error ? error.message : 'Film processing failed')
      } finally {
        if (!controller.signal.aborted) setIsProcessing(false)
      }
    }
    // Combine rapid input changes before copying pixels into the existing
    // worker. Obsolete requests retain the same abort owner.
    const timer = profile ? setTimeout(() => { void loadAndPreview() }, 24) : null
    if (!profile) void loadAndPreview()
    return () => {
      if (timer !== null) clearTimeout(timer)
      controller.abort()
    }
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
    setMode('films')
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
  const restoreAdvancedFocus = useRef(false)
  const closeAdvanced = useCallback((apply: boolean) => {
    if (apply && !isPreviewReady) return
    if (apply) edit.commit()
    else edit.cancel()
    setMode('films')
    restoreAdvancedFocus.current = true
  }, [edit, isPreviewReady])

  useEffect(() => {
    if (isTuning || !isPreviewReady || !restoreAdvancedFocus.current) return
    const frame = requestAnimationFrame(() => {
      const trigger = advancedFocusRef.current
      if (trigger?.isConnected && !(trigger instanceof HTMLButtonElement && trigger.disabled)) {
        trigger.focus({ preventScroll: true })
        restoreAdvancedFocus.current = false
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [isTuning, isPreviewReady])

  const handleTuningOpen = useCallback(() => {
    if (isTuning) {
      closeAdvanced(false)
      return
    }
    if (!commands.advanced) return
    advancedFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    edit.openTuning()
    setMode('advanced')
  }, [isTuning, commands.advanced, edit, closeAdvanced])

  const handleCropClick = useCallback(() => {
    if (!commands.geometry) return
    setMode('crop')
    edit.openCrop()
  }, [edit, commands.geometry])

  const changeMode = (next: EditorMode) => {
    if (next === 'advanced') {
      handleTuningOpen()
      return
    }
    if (!commands.selectColor || (demoMode && next !== 'films')) return
    edit.cancel()
    setMode(next)
  }

  useEffect(() => {
    setMode('films')
    restoreAdvancedFocus.current = false
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
      const imageData = await materializePhotoPixels(exportImage, controller.signal)
      const plan = await prepareProcessingPlan(
        exportImage.recipe,
        imageData,
        mergedSettings,
        { signal: controller.signal }
      )

      const baseName = exportImage.fileName.replace(/\.[^.]+$/, '')
      const result = await exportPhoto({
        imageData,
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
      if (result.status === 'success') {
        exportSnapshotRef.current = null
        setCompletion({ kind: 'single', exported: 1, skipped: 0, errors: 0, previews: result.preview ? [result.preview] : [] })
      }
      if (result.status === 'cancelled') exportSnapshotRef.current = null
    } catch (error) {
      if (!controller.signal.aborted) setExportError({ code: 'processing-failed', message: error instanceof Error ? error.message : 'Film processing failed' })
    } finally {
      if (exportAbortControllerRef.current === controller) {
        exportAbortControllerRef.current = null
      }
      if (controller.signal.aborted) exportSnapshotRef.current = null
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

    if (controller.signal.aborted || result.status === 'cancelled') {
      exportSnapshotRef.current = null
      return
    }
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
        try {
          controller.signal.throwIfAborted()
          anchor.click()
        } finally { anchor.remove() }
        setCompletion({
          kind: 'batch',
          exported: result.exported,
          skipped: result.skipped,
          errors: result.errors,
          previews: result.previews,
        })
        exportSnapshotRef.current = null
      } catch (error) {
        if (controller.signal.aborted) exportSnapshotRef.current = null
        else setExportError({ code: 'download-failed', message: error instanceof Error ? error.message : 'Failed to download archive' })
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
    exportSnapshotRef.current = null
    ImageProcessor.disposeProcessingWorker()
    clearPreviewCaches()
    disposePhotoWebGLProcessor()
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
  const mobileCover = !isMdUp && mode !== 'crop' && !isCropping && !isTuning

  const actions: EditorAction[] = demoMode ? [{
    id: 'upload', label: 'Upload photos', ariaLabel: 'Upload photos',
    onClick: () => demoUploadRef.current?.click(), disabled: !commands.add,
  }] : isTuning ? [] : isCropping ? [{
    id: 'cancel-crop', label: 'Cancel', variant: 'outline', onClick: edit.cancel, disabled: !commands.cancelDraft,
  }, {
    id: 'apply-crop', label: 'Done', onClick: edit.commit, disabled: !commands.editDraft,
  }] : [
    ...(totalImages > 1 ? [{
      id: 'apply-all', label: 'Apply to all', ariaLabel: `Apply current color to all ${totalImages} images`,
      variant: 'outline' as const,
      onClick: handleApplyToAll, disabled: !commands.applyToAll,
    }, {
      id: 'export-all', label: 'Export all', ariaLabel: 'Export all photos',
      onClick: () => { void handleExportAll() },
      disabled: !canExportAll || !commands.export, busy: isBatchExporting,
    }] : []),
    {
      id: 'export', label: isExporting ? 'Exporting…' : 'Export', ariaLabel: 'Export processed image (Ctrl+S)',
      onClick: () => { void handleExport() }, disabled: !commands.export, busy: isExporting, desktopOnly: totalImages > 1,
    },
  ]

  return (
    <div 
      className="flex flex-col md:flex-row overflow-hidden"
      style={{ height: getViewportHeightStyle(viewportHeight) }}
    >
      {/* Главный блок: фото + toolbar */}
      <div ref={editorStageRef} className="editor-stage mobile-editor-stage relative isolate flex-1 bg-zinc-950 min-w-0 min-h-0 overflow-hidden">
        <div className="mobile-editor-header mobile-editor-surface relative z-20 flex-shrink-0">
        <input
          ref={demoUploadRef}
          type="file"
          accept={demoMode ? 'image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime' : 'image/jpeg,image/png,image/webp,image/gif'}
          multiple
          className="sr-only"
          aria-label={demoMode ? 'Choose photos or video to edit' : 'Add photos to current batch'}
          onChange={event => {
            const files = Array.from(event.target.files ?? [])
            event.target.value = ''
            if (!commands.add) return
            const type = files.length === 1 && files[0].type.startsWith('video/') ? 'video' : 'image'
            if (demoMode && onMediaSelect) void onMediaSelect(files, type)
            else void onAddImages(files)
          }}
        />
        <EditorHeader
          compact={isTuning}
          fileName={currentImage.fileName}
          details={totalImages > 1 ? `${currentIndex + 1} of ${totalImages}` : undefined}
          leading={!demoMode && (
            <Button variant="ghost" size="sm" onClick={() => demoUploadRef.current?.click()} disabled={!commands.add}
              className="editor-control h-11 min-w-11 gap-1 rounded-lg px-2 text-zinc-300" aria-label="Add photos">
              <Plus className="size-4" aria-hidden="true" /> Add
            </Button>
          )}
          trailing={(
            <Button variant="ghost" size="sm" onClick={() => { if (commands.help) setIsHelpOpen(true) }} disabled={!commands.help}
              className="editor-control relative h-11 min-w-11 gap-1 rounded-lg px-2 text-zinc-300" aria-label="Help">
              <HelpCircle className="size-4" aria-hidden="true" /> Help
              {hasUnreadHelp && <span className="absolute right-1.5 top-1.5 size-1.5 rounded-full bg-white" aria-hidden="true" />}
            </Button>
          )}
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
          {isProcessing && (
            <div className="absolute left-1/2 top-2 -translate-x-1/2">
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

        <EditorControlDock
          mode={mode}
          navigation={(
            <EditorModes mode={mode} onChange={changeMode} demoMode={demoMode} advancedOpen={isTuning}
              disabled={{ films: !commands.selectColor, advanced: isTuning ? !commands.cancelDraft : !commands.advanced, crop: !commands.selectColor }} />
          )}
          actions={<EditorActions actions={actions} />}
        >
          {mode === 'films' && (
            <FilmSelector activeRecipe={currentImage.recipe} onSelect={handleRecipeSelect} disabled={!commands.selectColor}
              className="px-3 py-3" />
          )}
          {mode === 'advanced' && isTuning && profile && (
            <AdvancedPanel profile={profile} settings={settings} sourceImage={transformedThumbnail}
              onProfileSelect={edit.selectDraftProfile} onSettingsChange={edit.changeSettings}
              onRestoreBase={edit.restoreDraftBase} onApply={() => closeAdvanced(true)} onCancel={() => closeAdvanced(false)}
              disabled={interactionDisabled || isExporting || isBatchExporting} applyDisabled={!isPreviewReady} />
          )}
          {mode === 'crop' && !isCropping && (
            <CropTools onOpen={handleCropClick} onRotate={() => { if (commands.geometry) edit.rotate(90) }}
              onFlip={() => { if (commands.geometry) edit.flip() }} disabled={!commands.geometry} />
          )}
          {mode === 'crop' && isCropping && (
            <CropSessionControls
              cropRatio={edit.transformState.cropRatio}
              fineAngle={edit.transformState.fineAngle}
              cropScale={edit.transformState.cropScale}
              onCropRatioChange={cropRatio => edit.changeCrop({ cropRatio })}
              onFineAngleChange={fineAngle => edit.changeCrop({ fineAngle })}
              onCropScaleChange={cropScale => edit.changeCrop({ cropScale })}
              onInteractionChange={setIsCropControlActive}
              onRotate={() => { if (commands.cropGeometry) edit.rotate(90) }}
              onFlip={() => { if (commands.cropGeometry) edit.flip() }}
              disabled={interactionDisabled || isExporting || isBatchExporting}
              geometryDisabled={!commands.cropGeometry}
            />
          )}
        </EditorControlDock>
      </div>

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
            setMode('films')
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
    sourceSize: { ...image.sourceSize }, customSettings: structuredClone(image.customSettings), transform: structuredClone(image.transform) }
}
