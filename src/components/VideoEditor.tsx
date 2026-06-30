import { useState, useCallback, useEffect, useLayoutEffect, useMemo } from 'react'
import { ArrowLeft, PanelRightClose, PanelRightOpen, Film, X, Settings2, Share, HelpCircle } from 'lucide-react'
import { APP_VERSION } from '../constants'
import { Button } from './ui/button'
import { VideoPreview } from './VideoPreview'
import { RecipePanel } from './RecipePanel'
import { TuningPanel } from './TuningPanel'
import { HelpDialog } from './HelpDialog'
import { Recipe, RecipeSettings, ProcessingPlan } from '../engine/types'
import { loadSimulationLUT } from '../presets/simulations'
import { createProcessingPlan } from '../engine/processing-plan'
import { getAllRecipes } from '../presets/recipes'
import { useFavorites } from '../hooks/useFavorites'
import { VideoData, VideoExportState } from '../hooks/useVideoProcessor'
import { Spinner } from './ui/spinner'

interface VideoEditorProps {
  videoData: VideoData
  fileName: string
  onBack: () => void
  onExport: (plan: ProcessingPlan) => Promise<Blob | null>
  exportState: VideoExportState
  onCancelExport: () => void
  onDismissExportError: () => void
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
            className="text-zinc-500 hover:text-white -mr-2"
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
          <div className="flex justify-between text-xs text-zinc-500">
            <span>{status}</span>
            <span>{Math.round(progress)}%</span>
          </div>
        </div>

        <p className="text-xs text-zinc-600 text-center">
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
}: VideoEditorProps) {
  const { video, thumbnail, metadata } = videoData
  const [activeRecipe, setActiveRecipe] = useState<Recipe | null>(null)
  const [customSettings, setCustomSettings] = useState<RecipeSettings>({})
  const [isTuning, setIsTuning] = useState(false)
  const [showOriginal, setShowOriginal] = useState(false)
  const [isPanelOpen, setIsPanelOpen] = useState(true)
  const [isHelpOpen, setIsHelpOpen] = useState(false)
  const [loadedSimulationId, setLoadedSimulationId] = useState<string | null>(null)

  // Favorites
  const { getFavoriteIds, toggleFavorite } = useFavorites()

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

  /**
   * Calculate processing options for WebGL preview
   */
  const processingPlan = useMemo((): ProcessingPlan | null => {
    if (!activeRecipe) return null
    if (loadedSimulationId !== activeRecipe.filmSimulation) return null
    return createProcessingPlan(activeRecipe, metadata, customSettings)
  }, [activeRecipe, customSettings, loadedSimulationId, metadata])

  useEffect(() => {
    if (!activeRecipe) return
    let cancelled = false
    setLoadedSimulationId(null)

    loadSimulationLUT(activeRecipe.filmSimulation).then(() => {
      if (!cancelled) setLoadedSimulationId(activeRecipe.filmSimulation)
    })

    return () => {
      cancelled = true
    }
  }, [activeRecipe])

  /**
   * Handle recipe selection
   */
  const handleRecipeSelect = useCallback((recipe: Recipe) => {
    setActiveRecipe(recipe)
    setCustomSettings({})
  }, [])

  /**
   * Random recipe
   */
  const handleRandomRecipe = useCallback(() => {
    const recipes = getAllRecipes()
    const availableRecipes = activeRecipe
      ? recipes.filter((r) => r.id !== activeRecipe.id)
      : recipes

    if (availableRecipes.length > 0) {
      const randomIndex = Math.floor(Math.random() * availableRecipes.length)
      handleRecipeSelect(availableRecipes[randomIndex])
    }
  }, [activeRecipe, handleRecipeSelect])

  /**
   * Handle settings change in tuning mode
   */
  const handleSettingsChange = useCallback((newSettings: RecipeSettings) => {
    setCustomSettings(newSettings)
  }, [])

  // Settings before tuning for cancel
  const [settingsBeforeTuning, setSettingsBeforeTuning] = useState<RecipeSettings>({})

  const handleTuningOpen = useCallback(() => {
    if (isTuning) {
      setIsTuning(false)
    } else {
      setSettingsBeforeTuning(customSettings)
      setIsTuning(true)
      if (!isPanelOpen) {
        setIsPanelOpen(true)
      }
    }
  }, [isTuning, customSettings, isPanelOpen])

  const handleTuningApply = useCallback(() => {
    setIsTuning(false)
  }, [])

  const handleTuningCancel = useCallback(() => {
    setCustomSettings(settingsBeforeTuning)
    setIsTuning(false)
  }, [settingsBeforeTuning])

  const handlePanelToggle = useCallback(() => {
    setIsPanelOpen((prev) => !prev)
    if (isTuning) {
      setIsTuning(false)
    }
  }, [isTuning])

  /**
   * Export video
   */
  const handleExport = useCallback(async () => {
    if (!activeRecipe || !processingPlan) return

    try {
      const blob = await onExport(processingPlan)

      if (blob) {
        // Download
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `photochrome_${activeRecipe.id}_${fileName.replace(/\.[^.]+$/, '')}.mp4`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      console.error('Export failed:', err)
    }
  }, [activeRecipe, fileName, processingPlan, onExport])

  /**
   * Compare before/after
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
        case 't':
          if (!e.metaKey && !e.ctrlKey && activeRecipe) {
            handleTuningOpen()
          }
          break
        case 'p':
          if (!e.metaKey && !e.ctrlKey) {
            handlePanelToggle()
          }
          break
        case 'escape':
          if (isTuning) {
            handleTuningCancel()
          }
          break
        case 'enter':
          if (isTuning) {
            setIsTuning(false)
          }
          break
        case ' ':
          if (activeRecipe && !isTuning) {
            e.preventDefault()
            setShowOriginal(true)
          }
          break
        case 's':
          if ((e.metaKey || e.ctrlKey) && activeRecipe && !exportState.isExporting) {
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
    isTuning,
    activeRecipe,
    exportState.isExporting,
    handleTuningOpen,
    handleTuningCancel,
    handlePanelToggle,
    handleExport,
  ])

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
              onClick={onBack}
              className="text-zinc-400 hover:text-white h-8 w-8 p-0"
              aria-label="Back"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>

            <div className="absolute left-1/2 -translate-x-1/2 text-center">
              <h1 className="text-sm md:text-lg font-semibold text-white">
                Photochrome
                <sup className="text-[8px] md:text-[10px] text-zinc-500 ml-0.5">
                  {APP_VERSION}
                </sup>
              </h1>
              <div className="flex items-center justify-center gap-2">
                <Film className="w-3 h-3 text-zinc-500" />
                <p className="text-[10px] md:text-xs text-zinc-500 truncate max-w-[140px] md:max-w-none">
                  {fileName}
                </p>
              </div>
            </div>

            {/* Desktop: Panel toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handlePanelToggle}
              className="text-zinc-500 hover:text-white hidden md:flex"
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

        {exportState.error && (
          <div
            role="alert"
            className="mx-3 md:mx-6 mb-2 flex items-center gap-3 rounded-lg border border-rose-900/70 bg-rose-950/80 px-3 py-2 text-sm text-rose-100"
          >
            <p className="min-w-0 flex-1">Video export failed: {exportState.error}</p>
            <Button size="sm" variant="outline" onClick={handleExport} disabled={exportState.isExporting}>
              Retry
            </Button>
            <Button size="sm" variant="ghost" onClick={onDismissExportError}>
              Dismiss
            </Button>
          </div>
        )}

        {/* Preview area */}
        <div className="flex-1 min-h-0 px-3 md:px-6 relative overflow-hidden">
          <VideoPreview
            video={video}
            processingPlan={showOriginal ? null : processingPlan}
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
        <div className="flex-shrink-0 p-3 md:p-4">
          <div className="flex items-center justify-center gap-3">
            {/* Help button */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => setIsHelpOpen(true)}
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
                aria-label={`Tune ${activeRecipe.name}`}
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
                Select preset
              </Button>
            )}

            {/* Export button */}
            <Button
              variant="default"
              size="default"
              onClick={handleExport}
              disabled={!activeRecipe || exportState.isExporting}
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

        {/* Mobile: Horizontal recipe panel */}
        <div className="flex-shrink-0 md:hidden">
          <RecipePanel
            sourceImage={thumbnail}
            activeRecipeId={activeRecipe?.id ?? null}
            favoriteIds={getFavoriteIds()}
            onRecipeSelect={handleRecipeSelect}
            onRandomRecipe={handleRandomRecipe}
            onFavoriteToggle={toggleFavorite}
            horizontal
          />
        </div>
      </div>

      {/* Desktop: Right panel with presets */}
      <aside
        className={`
          hidden md:block flex-shrink-0 h-full overflow-hidden
          bg-black border-l border-zinc-800
          transition-[width] duration-300 ease-out
          ${isPanelOpen ? 'w-72' : 'w-0 border-l-0'}
        `}
      >
        <div className="w-72 h-full relative">
          <RecipePanel
            sourceImage={thumbnail}
            activeRecipeId={activeRecipe?.id ?? null}
            favoriteIds={getFavoriteIds()}
            onRecipeSelect={handleRecipeSelect}
            onRandomRecipe={handleRandomRecipe}
            onFavoriteToggle={toggleFavorite}
          />

          {/* TuningPanel overlay */}
          <div
            className={`tuning-panel-overlay ${
              isTuning && activeRecipe ? 'tuning-panel-open' : 'tuning-panel-closed'
            }`}
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

      {/* Mobile: TuningPanel fullscreen */}
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

      {/* Export progress overlay */}
      {exportState.isExporting && (
        <ExportOverlay
          progress={exportState.progress}
          status={exportState.status}
          onCancel={onCancelExport}
        />
      )}

      {/* Help dialog */}
      <HelpDialog
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />
    </main>
  )
}
