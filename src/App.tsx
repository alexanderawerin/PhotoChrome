import { useEffect, useRef, type ReactNode } from 'react'
import { ImageOff, Film, RefreshCw } from 'lucide-react'
import { LandingScreen } from './components/LandingScreen'
import { Editor } from './components/Editor'
import { VideoEditor } from './components/VideoEditor'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Spinner } from './components/ui/spinner'
import { Button } from './components/ui/button'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from './components/ui/empty'
import { useMediaSession } from './hooks/useMediaSession'
import { useVideoExport } from './hooks/useVideoExport'
import demoOneUrl from '../img/alexander-awerin-3yqVPhHHsdI-unsplash.webp'
import demoTwoUrl from '../img/alexander-awerin-AQI2wTv1SWo-unsplash.webp'
import demoThreeUrl from '../img/alexander-awerin-yafEjegDFl4-unsplash.webp'

const DEMO_PHOTOS = [demoOneUrl, demoTwoUrl, demoThreeUrl] as const

/**
 * Loading overlay shown while media is being decoded.
 * An image preview is supplied only for image selections; the existing editor
 * or landing surface remains visible behind the scrim whenever possible.
 */
function LoadingOverlay({
  mediaType = 'image',
  previewUrl,
}: {
  mediaType?: 'image' | 'video'
  previewUrl?: string | null
}) {
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center overflow-hidden bg-black/60 p-4 backdrop-blur-md"
      role="status"
      aria-label={mediaType === 'video' ? 'Loading video' : 'Loading image'}
      aria-busy="true"
      aria-live="polite"
    >
      {previewUrl && (
        <img
          src={previewUrl}
          alt=""
          aria-hidden="true"
          className="loading-preview absolute inset-0 size-full scale-105 object-cover blur-2xl opacity-70"
        />
      )}
      <div className="absolute inset-0 bg-black/45" aria-hidden="true" />
      <div className="relative z-10 flex w-full max-w-sm items-center justify-center gap-3 rounded-2xl border border-white/10 bg-zinc-950/80 px-4 py-3 shadow-2xl backdrop-blur-sm">
        <Spinner className="size-5 shrink-0 text-zinc-300 motion-reduce:animate-none" aria-hidden="true" />
        <p
          className="text-center text-sm leading-5 text-zinc-100"
        >
          {mediaType === 'video' ? 'Loading video…' : 'Loading photo…'}
        </p>
      </div>
    </div>
  )
}

function LoadingContent({ isLoading, children }: { isLoading: boolean; children: ReactNode }) {
  return (
    <div className="contents" {...(isLoading ? { inert: '' } : {})}>
      {children}
    </div>
  )
}

/** Keeps the last working editor mounted while its replacement loads. */
function AppContent() {
  const { session, state, previewUrl } = useMediaSession(DEMO_PHOTOS)
  const { media } = state
  const { exportState, exportVideoWithEffects, cancelExport, dismissExportError } = useVideoExport(
    media?.kind === 'video' ? media.data : null,
  )
  const errorFileInputRef = useRef<HTMLInputElement>(null)
  const retryButtonRef = useRef<HTMLButtonElement>(null)
  const isLoading = state.status === 'loading' || state.status === 'empty'
  const blocked = state.status !== 'ready'
  const request = state.status === 'loading' || state.status === 'error' ? state.request : null
  const isVideoRequest = request?.kind === 'video'
  const error = state.status === 'error' ? state.message : null

  useEffect(() => {
    if (state.status === 'error') retryButtonRef.current?.focus()
  }, [state.status])

  const handleFileSelect = (files: File | File[], type: 'image' | 'video'): Promise<void> => {
    const selection = Array.isArray(files) ? files : [files]
    if (selection.length === 0) return Promise.resolve()
    return type === 'video'
      ? session.load({ kind: 'video', file: selection[0] })
      : session.load({ kind: 'photos', files: selection, mode: 'replace' })
  }

  const startDemo = () => { void session.load({ kind: 'demo' }) }
  let content: ReactNode
  if (media?.kind === 'video') {
    content = (
      <VideoEditor
        videoData={media.data}
        fileName={media.fileName}
        onBack={startDemo}
        onExport={exportVideoWithEffects}
        exportState={exportState}
        onCancelExport={cancelExport}
        onDismissExportError={dismissExportError}
        interactionDisabled={blocked}
      />
    )
  } else if (media) {
    content = (
      <Editor
        images={media.images}
        currentIndex={media.currentIndex}
        onImageUpdate={session.updateImage}
        onNextImage={() => session.goToImage(media.currentIndex + 1)}
        onPreviousImage={() => session.goToImage(media.currentIndex - 1)}
        onBack={startDemo}
        onAddImages={files => session.load({ kind: 'photos', files, mode: media.kind === 'demo' ? 'replace' : 'append' })}
        onMediaSelect={handleFileSelect}
        demoMode={media.kind === 'demo'}
        interactionDisabled={blocked}
      />
    )
  } else if (isLoading) {
    content = <main className="min-h-screen bg-zinc-950" />
  } else {
    content = <LandingScreen onFileSelect={handleFileSelect} />
  }

  const ErrorIcon = isVideoRequest ? Film : ImageOff
  return (
    <>
      <LoadingContent isLoading={blocked}>{content}</LoadingContent>
      {isLoading && <LoadingOverlay mediaType={isVideoRequest ? 'video' : 'image'} previewUrl={previewUrl} />}
      {error && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-zinc-950 p-4" role="alert">
          <Empty className="max-w-md border-0">
            <EmptyHeader>
              <EmptyMedia variant="icon" className="bg-rose-500/10 text-rose-400 size-16 rounded-2xl [&_svg]:size-8">
                <ErrorIcon />
              </EmptyMedia>
              <EmptyTitle className="text-xl text-white">
                {isVideoRequest ? 'Failed to load video' : request?.kind === 'demo' ? 'Failed to load demo' : 'Failed to load image'}
              </EmptyTitle>
              <EmptyDescription className="text-zinc-400">{error}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <div className="flex w-full flex-col gap-2">
                <input
                  ref={errorFileInputRef}
                  type="file"
                  accept={isVideoRequest ? 'video/mp4,video/webm,video/quicktime,video/mov' : 'image/jpeg,image/png,image/webp,image/gif'}
                  multiple={!isVideoRequest}
                  className="sr-only"
                  aria-label={isVideoRequest ? 'Choose another video' : 'Choose another photo'}
                  onChange={event => {
                    const files = Array.from(event.target.files ?? [])
                    event.target.value = ''
                    if (request?.kind === 'photos' && request.mode === 'append') {
                      void session.load({ ...request, files })
                    } else {
                      void handleFileSelect(files, isVideoRequest ? 'video' : 'image')
                    }
                  }}
                />
                <Button ref={retryButtonRef} onClick={() => { void session.retry() }} variant="outline" className="gap-2 border-zinc-700 hover:bg-zinc-800 hover:text-white">
                  <RefreshCw className="w-4 h-4" /> Retry
                </Button>
                <Button onClick={() => errorFileInputRef.current?.click()}>Choose another</Button>
                <Button variant="ghost" onClick={media ? session.resume : startDemo}>
                  {media && media.kind !== 'demo' ? 'Back to editor' : 'Back to demo'}
                </Button>
              </div>
            </EmptyContent>
          </Empty>
        </div>
      )}
    </>
  )
}

/** Root application component wrapped with error boundary. */
function App() {
  return <ErrorBoundary><AppContent /></ErrorBoundary>
}

export default App
