import { useState, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { ArrowLeft, PanelRightClose, PanelRightOpen, Film, X, HelpCircle } from 'lucide-react'
import { Button } from './ui/button'
import { VideoPreview } from './VideoPreview'
import { FilmSelector } from './FilmSelector'
import { getProfileName, hasModifiedSettings } from '../engine/film-profiles'
import { AdvancedPanel } from './AdvancedPanel'
import { EditorHeader, EditorModes, EditorActions, EditorControlDock, EditorCompare, EditorProcessing, CropSessionControls, type EditorMode, type EditorAction } from './EditorChrome'
import { activeEditorSession, beginTuningSession, beginCropSession, editorSessionChanges, selectTuningProfile, updateTuningSession, updateCropSession, setCropRatio, type EditorSession } from '../engine/editor-sessions'
import { createDefaultTransformState, nextQuarterTurn, renderImageTransform, type ImageTransformState } from '../engine/transform'
import { getVideoOutputSize } from '../engine/video/geometry'
import { HelpDialog } from './HelpDialog'
import { Recipe, RecipeSettings, ProcessingPlan } from '../engine/types'
import { prepareProcessingPlan } from '../engine/processing-plan'
import { clearPreviewCaches } from '../engine/preview-image'
import { disposePhotoWebGLProcessor } from '../engine/webgl/processor'
import { editorCommands } from '../engine/editor-commands'
import { Sheet, SheetContent, SheetTitle, SheetDescription } from './ui/sheet'
import type { VideoData } from '../engine/media-loading'
import type { VideoExportState } from '../hooks/useVideoExport'

interface VideoEditorProps {
  videoData: VideoData
  fileName: string
  onBack: () => void
  onExport: (plan: ProcessingPlan, options?: { allowSilentAudio?: boolean }) => Promise<Blob | null>
  exportState: VideoExportState
  onCancelExport: () => void
  onDismissExportError: () => void
  interactionDisabled?: boolean
}

/**
 * Video export progress overlay
 */
function ExportOverlay({
  progress,
  status,
  onCancel,
}: {
  progress: number
  status: string
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[200] p-4">
      <div className="bg-zinc-900 rounded-2xl p-6 max-w-sm w-full space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Film className="w-5 h-5 text-zinc-400" />
            <span className="text-sm font-medium text-white">Exporting Video</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onCancel}
            className="text-zinc-400 hover:text-white -mr-2"
            aria-label="Cancel export"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </Button>
        </div>

        {/* Progress bar */}
        <div className="space-y-2">
          <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-white transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-zinc-400">
            <span>{status}</span>
            <span>{Math.round(progress)}%</span>
          </div>
        </div>

        <p className="text-xs text-zinc-400 text-center">
          This may take a while for longer videos
        </p>
      </div>
    </div>
  )
}

export function VideoEditor({
  videoData,
  fileName,
  onBack,
  onExport,
  exportState,
  onCancelExport,
  onDismissExportError,
  interactionDisabled = false,
}: VideoEditorProps) {
  const { video, thumbnail, metadata } = videoData
  useEffect(() => () => {
    clearPreviewCaches()
    disposePhotoWebGLProcessor()
  }, [videoData])
  const [color, setColor] = useState<{ recipe: Recipe | null; settings: RecipeSettings }>({ recipe: null, settings: {} })
  const activeRecipe = color.recipe
  const customSettings = color.settings
  const [transform, setTransform] = useState(createDefaultTransformState)
  const [draft, setDraft] = useState<EditorSession | null>(null)
  const owner = useMemo(() => ({ imageId: video.src, recipeId: activeRecipe?.id ?? null }), [video, activeRecipe?.id])
  const session = activeEditorSession(draft, owner)
  const sessionKind = session?.kind
  const isTuning = session?.kind === 'tuning'
  const isCropping = session?.kind === 'crop'
  const visibleProfile = session?.kind === 'tuning' ? session.profile : activeRecipe
  const visibleSettings = session?.kind === 'tuning' ? session.draft : customSettings
  const visibleTransform = session?.kind === 'crop' ? session.draft : transform
  const previewTransform = useMemo(() => isCropping ? { ...visibleTransform, cropRatio: 'original' as const } : visibleTransform, [isCropping, visibleTransform])
  const transformedThumbnail = useMemo(() => renderImageTransform(thumbnail, transform), [thumbnail, transform])
  const [cropGridActive, setCropGridActive] = useState(false)
  const [showOriginal, setShowOriginal] = useState(false)
  const [isPanelOpen, setIsPanelOpen] = useState(true)
  const [mode, setMode] = useState<EditorMode>('films')
  const [isHelpOpen, setIsHelpOpen] = useState(false)
  const [preparationAttempt, setPreparationAttempt] = useState(0)
  const [renderError, setRenderError] = useState<string | null>(null)
  const [prepared, setPrepared] = useState<{ owner: object; plan: ProcessingPlan | null; error: string | null } | null>(null)
  const planOwner = useMemo(() => ({ videoData, visibleProfile, visibleSettings, previewTransform, preparationAttempt }), [videoData, visibleProfile, visibleSettings, previewTransform, preparationAttempt])
  const processingPlan = prepared?.owner === planOwner ? prepared.plan : null
  const preparationError = prepared?.owner === planOwner ? prepared.error : null
  const preparing = !processingPlan && !preparationError
  const exportRequest = useRef<{ videoData: VideoData; plan: ProcessingPlan; fileName: string } | null>(null)
  const deliveryOwner = useRef(videoData)
  deliveryOwner.current = videoData
  const commands = editorCommands({
    loading: interactionDisabled,
    modal: isHelpOpen || !!exportState.requiresSilentAudioConsent,
    exporting: exportState.isExporting,
    session: session?.kind ?? null,
    hasColor: !!activeRecipe,
  })
  const canExport = commands.export && !!processingPlan && !renderError
  const canCompare = !interactionDisabled && !isHelpOpen && !exportState.requiresSilentAudioConsent && !exportState.isExporting && !session && !!processingPlan && !renderError
  const contextualPanelRef = useRef<HTMLDivElement>(null)
  const sessionTriggerRef = useRef<HTMLElement | null>(null)
  const restoreSessionFocus = useRef(false)
  const exportButtonRef = useRef<HTMLButtonElement>(null)
  const handleRenderError = useCallback((message: string | null) => setRenderError(message), [])

  // Viewport height for mobile
  const [viewportHeight, setViewportHeight] = useState<number | null>(null)

  useLayoutEffect(() => {
    const updateHeight = () => {
      setViewportHeight(window.innerHeight)
    }
    const handleOrientation = () => setTimeout(updateHeight, 100)
    updateHeight()
    window.addEventListener('resize', updateHeight)
    window.addEventListener('orientationchange', handleOrientation)
    return () => {
      window.removeEventListener('resize', updateHeight)
      window.removeEventListener('orientationchange', handleOrientation)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setRenderError(null)
    const size = getVideoOutputSize(metadata.width, metadata.height, previewTransform)
    prepareProcessingPlan(visibleProfile, size, visibleSettings, { signal: controller.signal }).then(
      plan => { if (!controller.signal.aborted) setPrepared({ owner: planOwner, plan: { ...plan, geometry: previewTransform }, error: null }) },
      error => { if (!controller.signal.aborted) setPrepared({ owner: planOwner, plan: null, error: error instanceof Error ? error.message : 'Film preparation failed' }) },
    )
    return () => controller.abort()
  }, [visibleProfile, visibleSettings, previewTransform, metadata, planOwner])

  useEffect(() => {
    setShowOriginal(false)
  }, [videoData, activeRecipe, session?.kind, isHelpOpen, interactionDisabled, exportState.isExporting, exportState.requiresSilentAudioConsent])

  useEffect(() => {
    exportRequest.current = null
    setDraft(null)
    setColor({ recipe: null, settings: {} })
    setTransform(createDefaultTransformState())
    setMode('films')
  }, [videoData])

  useEffect(() => {
    if (!sessionKind) return
    const frame = requestAnimationFrame(() => contextualPanelRef.current?.querySelector<HTMLElement>('button')?.focus())
    return () => cancelAnimationFrame(frame)
  }, [sessionKind])

  const handleRecipeSelect = useCallback((recipe: Recipe | null) => {
    if (!commands.selectColor) return
    setDraft(null)
    setMode('films')
    setColor({ recipe, settings: {} })
  }, [commands.selectColor])

  const handleTuningCancel = useCallback(() => {
    setDraft(null)
    setCropGridActive(false)
    setMode('films')
    restoreSessionFocus.current = true
  }, [])

  useEffect(() => {
    if (session || !processingPlan || renderError || !restoreSessionFocus.current) return
    const frame = requestAnimationFrame(() => {
      const trigger = sessionTriggerRef.current
      const target = trigger?.isConnected ? trigger
        : document.querySelector<HTMLElement>('nav[aria-label="Editor modes"] button[aria-current="page"]')
      if (target && !(target instanceof HTMLButtonElement && target.disabled)) {
        target.focus({ preventScroll: true })
        restoreSessionFocus.current = false
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [session, processingPlan, renderError])

  const handleTuningOpen = useCallback(() => {
    if (isTuning) {
      if (commands.cancelDraft) handleTuningCancel()
      return
    }
    if (!commands.advanced || !activeRecipe || !processingPlan) return
    sessionTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setDraft(beginTuningSession(owner, customSettings, activeRecipe))
    setMode('advanced')
    setIsPanelOpen(true)
  }, [commands.advanced, commands.cancelDraft, activeRecipe, processingPlan, isTuning, handleTuningCancel, owner, customSettings])

  const handleTuningApply = useCallback(() => {
    if (!commands.editDraft || !processingPlan || renderError) return
    const changes = editorSessionChanges(session, owner)
    if (changes && 'transform' in changes) setTransform(changes.transform)
    else if (changes) setColor({ recipe: changes.recipe === undefined ? activeRecipe : changes.recipe, settings: changes.customSettings })
    handleTuningCancel()
  }, [commands.editDraft, processingPlan, renderError, session, owner, activeRecipe, handleTuningCancel])

  const handleSettingsChange = (settings: RecipeSettings) => {
    if (!commands.editDraft) return
    setDraft(previous => {
      const current = activeEditorSession(previous, owner)
      return current?.kind === 'tuning' ? updateTuningSession(current, settings) : current
    })
  }

  const changeDraftProfile = (profile: Recipe) => {
    if (!commands.editDraft) return
    setDraft(previous => {
      const current = activeEditorSession(previous, owner)
      return current?.kind === 'tuning' ? selectTuningProfile(current, profile) : current
    })
  }

  const changeCrop = useCallback((update: Partial<ImageTransformState>) => {
    if (!commands.cropGeometry) return
    setDraft(previous => {
      const current = activeEditorSession(previous, owner)
      if (current?.kind !== 'crop') return current
      return updateCropSession(update.cropRatio === undefined ? current : setCropRatio(current, update.cropRatio), update)
    })
  }, [commands.cropGeometry, owner])

  const changeGeometry = useCallback((update: Partial<ImageTransformState>) => {
    if (isCropping) changeCrop(update)
    else if (commands.geometry) setTransform(previous => ({ ...previous, ...update }))
  }, [isCropping, commands.geometry, changeCrop])

  const openCrop = useCallback(() => {
    if (isCropping || !(commands.geometry || (isTuning && commands.editDraft))) return
    sessionTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setDraft(beginCropSession(owner, transform))
    setMode('crop')
    setIsPanelOpen(true)
  }, [commands.geometry, commands.editDraft, isCropping, isTuning, owner, transform])

  const handlePanelToggle = useCallback(() => {
    if (commands.panel) setIsPanelOpen(previous => !previous)
  }, [commands.panel])

  const changeMode = (next: EditorMode) => {
    if (next === 'advanced') {
      handleTuningOpen()
      return
    }
    if (next === 'crop') { openCrop(); return }
    if (!commands.selectColor) return
    setDraft(null)
    setCropGridActive(false)
    restoreSessionFocus.current = false
    setMode(next)
    setIsPanelOpen(true)
  }

  const runExportRequest = useCallback(async (allowSilentAudio = false) => {
    const request = exportRequest.current
    if (!request || request.videoData !== videoData || interactionDisabled || exportState.isExporting || session || isHelpOpen || (!allowSilentAudio && !commands.export)) return
    try {
      const blob = await onExport(request.plan, { allowSilentAudio })
      if (!blob || deliveryOwner.current !== request.videoData || exportRequest.current !== request) return
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      try {
        link.href = url
        link.download = request.fileName
        document.body.appendChild(link)
        link.click()
      } finally {
        link.remove()
        URL.revokeObjectURL(url)
      }
    } catch {
      // The owned export hook supplies error and consent feedback.
    }
  }, [videoData, interactionDisabled, exportState.isExporting, session, isHelpOpen, commands.export, onExport])

  const handleExport = useCallback(async () => {
    if (!canExport || !processingPlan) return
    exportRequest.current = {
      videoData,
      plan: processingPlan,
      fileName: `photochrome_${activeRecipe?.id ?? 'original'}_${fileName.replace(/\.[^.]+$/, '')}.mp4`,
    }
    await runExportRequest()
  }, [canExport, activeRecipe, processingPlan, videoData, fileName, runExportRequest])

  /**
   * Compare before/after
   */
  const handleCompareStart = useCallback(() => { if (canCompare) setShowOriginal(true) }, [canCompare])
  const handleCompareEnd = useCallback(() => setShowOriginal(false), [])

  /**
   * Keyboard shortcuts
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') e.preventDefault()
      if (e.key !== 'Escape' && e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable="true"], [role="slider"]')) return
      if ((e.key === 'Enter' || e.key === ' ') && e.target instanceof Element && e.target.closest('button')) return
      if (interactionDisabled || isHelpOpen || exportState.isExporting || exportState.requiresSilentAudioConsent) return

      switch (e.key.toLowerCase()) {
        case 't':
          if (!e.metaKey && !e.ctrlKey && commands.advanced) {
            handleTuningOpen()
          }
          break
        case 'p':
          if (!e.metaKey && !e.ctrlKey && commands.panel) {
            handlePanelToggle()
          }
          break
        case 'c':
          if (!e.metaKey && !e.ctrlKey && commands.geometry) openCrop()
          break
        case 'r':
          if (!e.metaKey && !e.ctrlKey) changeGeometry({ quarterTurns: e.shiftKey ? ((visibleTransform.quarterTurns + 270) % 360) as ImageTransformState['quarterTurns'] : nextQuarterTurn(visibleTransform.quarterTurns) })
          break
        case 'f':
          if (!e.metaKey && !e.ctrlKey) changeGeometry({ flipHorizontal: !visibleTransform.flipHorizontal })
          break
        case 'escape':
          if (commands.cancelDraft) {
            handleTuningCancel()
          }
          break
        case 'enter':
          if (session && commands.editDraft) {
            handleTuningApply()
          }
          break
        case ' ':
          if (canCompare) {
            e.preventDefault()
            setShowOriginal(true)
          }
          break
        case 's':
          if ((e.metaKey || e.ctrlKey) && canExport) {
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
    window.addEventListener('blur', handleCompareEnd)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', handleCompareEnd)
    }
  }, [
    interactionDisabled,
    isHelpOpen,
    exportState.requiresSilentAudioConsent,
    commands,
    canExport,
    canCompare,
    session,
    openCrop,
    changeGeometry,
    visibleTransform,
    processingPlan,
    handleTuningApply,
    isTuning,
    activeRecipe,
    exportState.isExporting,
    handleTuningOpen,
    handleTuningCancel,
    handlePanelToggle,
    handleExport,
    handleCompareEnd,
  ])

  const actions: EditorAction[] = isCropping ? [
    { id: 'cancel-crop', label: 'Cancel', onClick: handleTuningCancel, variant: 'ghost', disabled: !commands.cancelDraft },
    { id: 'apply-crop', label: 'Done', onClick: handleTuningApply, disabled: !commands.editDraft || !processingPlan || !!renderError },
  ] : isTuning ? [] : [
    {
      id: 'export', label: exportState.isExporting ? 'Exporting...' : 'Export',
      ariaLabel: exportState.isExporting ? 'Exporting...' : 'Export video',
      onClick: () => { void handleExport() }, disabled: !canExport, busy: exportState.isExporting,
      buttonRef: exportButtonRef,
    },
  ]

  return (
    <main
      className="flex flex-col md:flex-row overflow-hidden"
      style={{ height: viewportHeight ? `${viewportHeight}px` : '100dvh' }}
    >
      {/* The media stage and persistent control dock share one responsive layout. */}
      <div className="editor-stage editor-video-stage flex-1 min-w-0 min-h-0 overflow-hidden">
        <div className="mobile-editor-header mobile-editor-surface">
          <EditorHeader compact={isTuning}
            modes={<EditorModes mode={mode} onChange={changeMode} advancedOpen={isTuning}
              disabled={{ films: !commands.selectColor, advanced: isTuning ? !commands.cancelDraft : !commands.advanced || !processingPlan, crop: isCropping ? !commands.cancelDraft : !(commands.geometry || (isTuning && commands.editDraft)) }} />}
            leading={
              <Button variant="ghost" onClick={() => { if (commands.navigate) onBack() }} disabled={!commands.navigate}
                className="editor-control min-h-11 min-w-11 rounded-lg p-0 text-zinc-300" aria-label="Back">
                <ArrowLeft className="size-4" aria-hidden="true" />
              </Button>
            }
            trailing={<EditorActions actions={isCropping ? [] : actions} placement="header" extraActions={[{
              id: 'help', label: 'Help', icon: <HelpCircle className="size-4" aria-hidden="true" />,
              onClick: () => { if (commands.help) setIsHelpOpen(true) }, disabled: !commands.help,
            }, {
              id: 'panel', label: isPanelOpen ? 'Hide panel' : 'Show panel', desktopOnly: true,
              icon: isPanelOpen ? <PanelRightClose className="size-4" aria-hidden="true" /> : <PanelRightOpen className="size-4" aria-hidden="true" />,
              onClick: handlePanelToggle, disabled: !commands.panel,
            }]} />} />
        <div className="editor-color-status flex items-center gap-2 text-xs text-zinc-400" aria-label="Applied color"
          data-quiet={!session && !preparationError && !hasModifiedSettings(activeRecipe, customSettings) || undefined}>
          {(preparing || preparationError) && <span className={preparationError ? undefined : 'sr-only'}>{preparationError ? 'Unavailable:' : 'Preparing:'}</span>}
          <span>{getProfileName(activeRecipe)}</span>
          {hasModifiedSettings(activeRecipe, customSettings) && <span>· Modified</span>}
        </div>

        {exportState.error && !exportState.requiresSilentAudioConsent && (
          <div
            role="alert"
            className="mx-3 md:mx-6 mb-2 flex items-center gap-3 rounded-lg border border-rose-900/70 bg-rose-950/80 px-3 py-2 text-sm text-rose-100"
          >
            <p className="min-w-0 flex-1">Video export failed: {exportState.error}</p>
            <Button size="sm" variant="outline" onClick={() => { void runExportRequest() }} disabled={!commands.export || !exportRequest.current}>
              Retry
            </Button>
            <Button size="sm" variant="ghost" onClick={onDismissExportError}>
              Dismiss
            </Button>
          </div>
        )}

        {(preparationError || renderError) && (
          <div role="alert" className="mx-3 md:mx-6 mb-2 flex items-center gap-3 text-sm text-rose-100">
            <p className="flex-1">{preparationError || renderError}</p>
            <Button size="sm" variant="outline" onClick={() => setPreparationAttempt(attempt => attempt + 1)} disabled={interactionDisabled || exportState.isExporting || isHelpOpen}>Retry film</Button>
          </div>
        )}
        </div>

        {/* Preview area */}
        <div className="editor-video-preview flex-1 min-h-0 px-3 md:px-6 relative overflow-hidden">
          <VideoPreview
            video={video}
            processingPlan={showOriginal ? null : processingPlan}
            isSuspended={exportState.isExporting || !!renderError}
            transform={visibleTransform}
            cropMode={isCropping}
            onTransformChange={changeCrop}
            cropGridActive={cropGridActive}
            onProcessingError={handleRenderError}
            retryKey={preparationAttempt}
            statusOverlay={preparing ? <EditorProcessing label="Loading film…" /> : undefined}
            overlay={!isCropping && !isTuning ? <EditorCompare active={showOriginal} disabled={!canCompare}
              onStart={handleCompareStart} onEnd={handleCompareEnd} /> : undefined}
            onMouseDown={handleCompareStart}
            onMouseUp={handleCompareEnd}
            onMouseLeave={handleCompareEnd}
          />
        </div>
      <EditorControlDock mode={mode} contentRef={contextualPanelRef} hideDesktop={!isPanelOpen}
        actions={<EditorActions actions={isCropping ? actions : []} primaryId="apply-crop" />}>
        {mode === 'films' && <FilmSelector sourceImage={transformedThumbnail} activeRecipe={activeRecipe} onSelect={handleRecipeSelect} disabled={!commands.selectColor} retryKey={preparationAttempt} />}
        {mode === 'advanced' && session?.kind === 'tuning' && session.profile && (
          <AdvancedPanel profile={session.profile} settings={session.draft} sourceImage={transformedThumbnail}
            onProfileSelect={changeDraftProfile} onSettingsChange={handleSettingsChange}
            onApply={handleTuningApply} onCancel={handleTuningCancel}
            disabled={!commands.editDraft} applyDisabled={!processingPlan || !!renderError} />
        )}
        {mode === 'crop' && session?.kind === 'crop' && (
          <CropSessionControls disabled={!commands.cropGeometry}
            onRotate={() => changeGeometry({ quarterTurns: nextQuarterTurn(visibleTransform.quarterTurns) })}
            onFlip={() => changeGeometry({ flipHorizontal: !visibleTransform.flipHorizontal })}
            cropRatio={session.draft.cropRatio} fineAngle={session.draft.fineAngle} cropScale={session.draft.cropScale}
            onCropRatioChange={cropRatio => changeCrop({ cropRatio })} onFineAngleChange={fineAngle => changeCrop({ fineAngle })}
            onCropScaleChange={cropScale => changeCrop({ cropScale })} onInteractionChange={setCropGridActive} />
        )}
      </EditorControlDock>
      </div>
      {/* Export progress overlay */}
      {exportState.isExporting && (
        <ExportOverlay
          progress={exportState.progress}
          status={exportState.status}
          onCancel={() => { exportRequest.current = null; onCancelExport() }}
        />
      )}

      <Sheet open={!!exportState.requiresSilentAudioConsent} onOpenChange={open => { if (!open) onDismissExportError() }}>
        <SheetContent side="bottom" className="mx-auto max-w-lg rounded-t-2xl space-y-4" onCloseAutoFocus={event => { event.preventDefault(); if (!exportState.isExporting) exportButtonRef.current?.focus() }}>
          <SheetTitle>Export without sound?</SheetTitle>
          <SheetDescription>{exportState.error || 'This browser cannot preserve the sound in this clip.'} Your edit remains available if you cancel.</SheetDescription>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onDismissExportError}>Cancel</Button>
            <Button onClick={() => { void runExportRequest(true) }} disabled={interactionDisabled}>Export without sound</Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Help dialog */}
      <HelpDialog
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />
    </main>
  )
}
