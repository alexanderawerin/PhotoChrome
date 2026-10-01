import { useState, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { ArrowLeft, PanelRightClose, PanelRightOpen, Film, X, Settings2, Share, HelpCircle, Crop, RotateCw, FlipHorizontal } from 'lucide-react'
import { APP_VERSION } from '../constants'
import { Button } from './ui/button'
import { VideoPreview } from './VideoPreview'
import { FilmSelector } from './FilmSelector'
import { getBaseFilm, getProfileName, hasModifiedSettings } from '../engine/film-profiles'
import { useIsMdUp } from '../hooks/useIsMdUp'
import { AdvancedPanel } from './AdvancedPanel'
import { CropPanel } from './CropPanel'
import { activeEditorSession, beginTuningSession, beginCropSession, editorSessionChanges, selectTuningProfile, restoreTuningBase, updateTuningSession, updateCropSession, setCropRatio, type EditorSession } from '../engine/editor-sessions'
import { createDefaultTransformState, nextQuarterTurn, renderImageTransform, type ImageTransformState } from '../engine/transform'
import { getVideoOutputSize } from '../engine/video/geometry'
import { HelpDialog } from './HelpDialog'
import { Recipe, RecipeSettings, ProcessingPlan } from '../engine/types'
import { prepareProcessingPlan } from '../engine/processing-plan'
import { editorCommands } from '../engine/editor-commands'
import { Sheet, SheetContent, SheetTitle, SheetDescription } from './ui/sheet'
import type { VideoData } from '../engine/media-loading'
import type { VideoExportState } from '../hooks/useVideoExport'
import { Spinner } from './ui/spinner'

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
  const isDesktop = useIsMdUp()
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
  const advancedThumbnail = useMemo(() => isTuning ? renderImageTransform(thumbnail, transform) : thumbnail, [isTuning, thumbnail, transform])
  const [cropGridActive, setCropGridActive] = useState(false)
  const [showOriginal, setShowOriginal] = useState(false)
  const [isPanelOpen, setIsPanelOpen] = useState(true)
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
  }, [videoData])

  useEffect(() => {
    if (!sessionKind) return
    const frame = requestAnimationFrame(() => contextualPanelRef.current?.querySelector<HTMLElement>('button')?.focus())
    return () => cancelAnimationFrame(frame)
  }, [sessionKind])

  const handleRecipeSelect = useCallback((recipe: Recipe | null) => {
    if (!commands.selectColor) return
    setDraft(null)
    setColor({ recipe, settings: {} })
  }, [commands.selectColor])

  const handleTuningCancel = useCallback(() => {
    setDraft(null)
    setCropGridActive(false)
    restoreSessionFocus.current = true
  }, [])

  useEffect(() => {
    if (session || !processingPlan || renderError || !restoreSessionFocus.current) return
    const frame = requestAnimationFrame(() => {
      const trigger = sessionTriggerRef.current
      if (trigger?.isConnected && !(trigger instanceof HTMLButtonElement && trigger.disabled)) {
        trigger.focus({ preventScroll: true })
        restoreSessionFocus.current = false
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [session, processingPlan, renderError])

  const handleTuningOpen = useCallback(() => {
    if (!commands.advanced || !activeRecipe || !processingPlan) return
    if (isTuning) handleTuningCancel()
    else {
      sessionTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      setDraft(beginTuningSession(owner, customSettings, activeRecipe))
      setIsPanelOpen(true)
    }
  }, [commands.advanced, activeRecipe, processingPlan, isTuning, handleTuningCancel, owner, customSettings])

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

  const restoreDraftBase = () => {
    if (!commands.editDraft) return
    setDraft(previous => {
      const current = activeEditorSession(previous, owner)
      return current?.kind === 'tuning' ? restoreTuningBase(current) : current
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
    if (!commands.geometry) return
    sessionTriggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setDraft(beginCropSession(owner, transform))
    setIsPanelOpen(true)
  }, [commands.geometry, owner, transform])

  const handlePanelToggle = useCallback(() => {
    if (commands.panel) setIsPanelOpen(previous => !previous)
  }, [commands.panel])

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
          if (session) {
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

  function renderContextualPanel() {
    if (session?.kind === 'tuning' && session.profile) return (
      <AdvancedPanel profile={session.profile} settings={session.draft} sourceImage={advancedThumbnail}
        onProfileSelect={changeDraftProfile} onSettingsChange={handleSettingsChange}
        onApply={handleTuningApply} onCancel={handleTuningCancel} onRestoreBase={restoreDraftBase}
        disabled={!commands.editDraft} applyDisabled={!processingPlan || !!renderError} />
    )
    if (session?.kind === 'crop') return (
      <section role="region" aria-label="Crop settings" className="h-full overflow-y-auto">
        <div className="flex justify-between gap-2 p-3">
          <h2>Crop</h2>
          <Button variant="ghost" onClick={handleTuningCancel} aria-label="Close crop"><X className="size-4" aria-hidden="true" /></Button>
        </div>
        <div className="flex gap-2 px-3">
          <Button variant="outline" onClick={() => changeGeometry({ quarterTurns: nextQuarterTurn(visibleTransform.quarterTurns) })}>Rotate</Button>
          <Button variant="outline" onClick={() => changeGeometry({ flipHorizontal: !visibleTransform.flipHorizontal })}>Reflect</Button>
        </div>
        <fieldset disabled={!commands.cropGeometry} className="border-0 p-0 min-w-0">
          <CropPanel cropRatio={session.draft.cropRatio} fineAngle={session.draft.fineAngle} cropScale={session.draft.cropScale}
            onCropRatioChange={cropRatio => changeCrop({ cropRatio })} onFineAngleChange={fineAngle => changeCrop({ fineAngle })}
            onCropScaleChange={cropScale => changeCrop({ cropScale })} onInteractionChange={setCropGridActive}
            onApply={handleTuningApply} onCancel={handleTuningCancel} />
        </fieldset>
      </section>
    )
    return null
  }

  return (
    <main
      className="flex flex-col md:flex-row overflow-hidden"
      style={{ height: viewportHeight ? `${viewportHeight}px` : '100dvh' }}
    >
      {/* Main area: preview + toolbar */}
      <div className="flex-1 flex flex-col bg-zinc-950 min-w-0 min-h-0 overflow-hidden">
        {/* Header */}
        <header className="flex-shrink-0 px-3 py-2 md:p-4">
          <div className="relative flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { if (commands.navigate) onBack() }}
              disabled={!commands.navigate}
              className="text-zinc-400 hover:text-white h-8 w-8 p-0"
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>

            <div className="absolute left-1/2 -translate-x-1/2 text-center">
              <h1 className="text-sm md:text-lg font-semibold text-white">
                Photochrome
                <sup className="text-[8px] md:text-[10px] text-zinc-400 ml-0.5">
                  {APP_VERSION}
                </sup>
              </h1>
              <div className="flex items-center justify-center gap-2">
                <Film className="w-3 h-3 text-zinc-400" />
                <p className="text-[10px] md:text-xs text-zinc-400 truncate max-w-[140px] md:max-w-none">
                  {fileName}
                </p>
              </div>
            </div>

            {/* Desktop: Panel toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePanelToggle}
              disabled={!commands.panel}
              className="text-zinc-400 hover:text-white hidden md:flex"
              aria-label={isPanelOpen ? 'Hide panel' : 'Show panel'}
            >
              {isPanelOpen ? (
                <PanelRightClose className="w-5 h-5" />
              ) : (
                <PanelRightOpen className="w-5 h-5" />
              )}
            </Button>
            {/* Spacer for mobile */}
            <div className="w-8 h-8 md:hidden" />
          </div>
        </header>

        <div className="mx-3 md:mx-6 mb-2 flex items-center gap-2 text-xs text-zinc-400" aria-label="Applied color">
          {(preparing || preparationError) && <span>{preparationError ? 'Unavailable:' : 'Preparing:'}</span>}
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

        {preparing && <p role="status" className="mx-3 md:mx-6 mb-2 text-sm text-zinc-300">Loading film…</p>}
        {(preparationError || renderError) && (
          <div role="alert" className="mx-3 md:mx-6 mb-2 flex items-center gap-3 text-sm text-rose-100">
            <p className="flex-1">{preparationError || renderError}</p>
            <Button size="sm" variant="outline" onClick={() => setPreparationAttempt(attempt => attempt + 1)} disabled={interactionDisabled || exportState.isExporting || isHelpOpen}>Retry film</Button>
          </div>
        )}

        {/* Preview area */}
        <div className="flex-1 min-h-0 px-3 md:px-6 relative overflow-hidden">
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
            onMouseDown={handleCompareStart}
            onMouseUp={handleCompareEnd}
            onMouseLeave={handleCompareEnd}
          />
          
          {/* Video info badge */}
          <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg pointer-events-none">
            <Film className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-xs text-zinc-300">
              {Math.round(metadata.duration * 10) / 10}s • {metadata.width}×{metadata.height}
            </span>
          </div>
        </div>

        {/* Video toolbar - Order: Help → Preset settings → Export */}
        <div className={`flex-shrink-0 p-3 md:p-4 ${session && !isDesktop ? 'hidden' : ''}`}>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {/* Help button */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => { if (commands.help) setIsHelpOpen(true) }}
              disabled={!commands.help}
              aria-label="Help"
            >
              <HelpCircle className="w-4 h-4" aria-hidden="true" />
            </Button>

            {/* Recipe chip — toggle tuning panel */}
            {activeRecipe ? (
              <Button
                variant="outline"
                size="default"
                onClick={handleTuningOpen}
                disabled={!commands.advanced || !processingPlan}
                aria-label="Advanced settings"
                aria-pressed={isTuning}
              >
                <Film className="w-4 h-4" aria-hidden="true" />
                <span className="max-w-32 truncate">
                  {activeRecipe.name}
                </span>
                <Settings2 className="w-4 h-4" aria-hidden="true" />
              </Button>
            ) : (
              <Button
                variant="outline"
                size="default"
                disabled
              >
                <Film className="w-4 h-4" aria-hidden="true" />
                Original
              </Button>
            )}

            {activeRecipe && !isTuning && hasModifiedSettings(activeRecipe, customSettings) && (
              <Button variant="outline" onClick={() => { if (commands.selectColor) handleRecipeSelect(getBaseFilm(activeRecipe.filmSimulation) ?? null) }} disabled={!commands.selectColor}>Restore base film</Button>
            )}

            <Button variant="outline" size="icon" aria-label="Crop" onClick={openCrop} disabled={!commands.geometry}><Crop className="w-4 h-4" aria-hidden="true" /></Button>
            <Button variant="outline" size="icon" aria-label="Rotate clockwise" onClick={() => changeGeometry({ quarterTurns: nextQuarterTurn(visibleTransform.quarterTurns) })} disabled={!commands.geometry && !commands.cropGeometry}><RotateCw className="w-4 h-4" aria-hidden="true" /></Button>
            <Button variant="outline" size="icon" aria-label="Flip horizontal" onClick={() => changeGeometry({ flipHorizontal: !visibleTransform.flipHorizontal })} disabled={!commands.geometry && !commands.cropGeometry}><FlipHorizontal className="w-4 h-4" aria-hidden="true" /></Button>

            {/* Export button */}
            <Button
              variant="default"
              size="default"
              ref={exportButtonRef}
              onClick={handleExport}
              disabled={!canExport}
              aria-label={exportState.isExporting ? 'Exporting...' : 'Export video'}
              aria-busy={exportState.isExporting}
            >
              {exportState.isExporting ? (
                <Spinner className="w-4 h-4" />
              ) : (
                <Share className="w-4 h-4" aria-hidden="true" />
              )}
              {exportState.isExporting ? 'Exporting...' : 'Export'}
            </Button>
          </div>
        </div>

        {!isDesktop && (
          <div className={`flex-shrink-0 ${session ? 'p-1' : 'p-3'}`}>
            <FilmSelector activeRecipe={activeRecipe} onSelect={handleRecipeSelect} disabled={!commands.selectColor} horizontal />
          </div>
        )}
        {!isDesktop && session && (
        <div ref={contextualPanelRef} className="relative flex-shrink-0 z-30 h-[60dvh] min-h-0 overflow-hidden border-t border-zinc-800 bg-black">
          {renderContextualPanel()}
        </div>
      )}

      </div>

      {isDesktop && isPanelOpen && (
        <aside aria-label="Film browser" className="flex-shrink-0 h-full min-h-0 w-[320px] overflow-hidden bg-black border-l border-zinc-800">
          {!session && <FilmSelector activeRecipe={activeRecipe} onSelect={handleRecipeSelect} disabled={!commands.selectColor} className="p-3" />}
          {session && <div className="flex h-full min-h-0 flex-col">
            <FilmSelector activeRecipe={activeRecipe} onSelect={handleRecipeSelect} disabled={!commands.selectColor} horizontal className="shrink-0 border-b border-zinc-800 p-2" />
            <div ref={contextualPanelRef} className="min-h-0 flex-1">{renderContextualPanel()}</div>
          </div>}
        </aside>
      )}
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
