import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
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
import { useImageProcessor } from './hooks/useImageProcessor'
import { useVideoProcessor } from './hooks/useVideoProcessor'
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

type MediaType = 'image' | 'video' | null
type MediaSelection =
  | { type: 'image'; files: File[] }
  | { type: 'video'; file: File }

/**
 * Main application component.
 * Handles routing between landing screen and editor based on loaded media state.
 */
function AppContent() {
  const [mediaType, setMediaType] = useState<MediaType>(null)
  const [fileName, setFileName] = useState<string>('')
  const [isDemoInitializing, setIsDemoInitializing] = useState(true)
  const demoLoadStarted = useRef(false)
  const lastMediaSelectionRef = useRef<MediaSelection | null>(null)
  const loadingPreviewUrlRef = useRef<string | null>(null)
  const [loadingPreviewUrl, setLoadingPreviewUrl] = useState<string | null>(null)
  const errorFileInputRef = useRef<HTMLInputElement>(null)
  const {
    images,
    currentIndex,
    isLoading: isImageLoading,
    error: imageError,
    loadImages,
    addImages,
    goToImage,
    nextImage,
    previousImage,
    updateImage,
    reset: resetImage,
  } = useImageProcessor()

  const {
    videoData,
    isLoading: isVideoLoading,
    error: videoError,
    exportState,
    loadVideoFile,
    exportVideoWithEffects,
    cancelExport,
    dismissExportError,
    reset: resetVideo,
  } = useVideoProcessor()

  const isLoading = isImageLoading || isVideoLoading
  const error = imageError || videoError

  const setLoadingPreviewForFile = useCallback((file: File | null) => {
    if (loadingPreviewUrlRef.current) {
      URL.revokeObjectURL(loadingPreviewUrlRef.current)
    }

    const nextUrl = file?.type.startsWith('image/') ? URL.createObjectURL(file) : null
    loadingPreviewUrlRef.current = nextUrl
    setLoadingPreviewUrl(nextUrl)
  }, [])

  const clearLoadingPreview = useCallback(() => {
    if (loadingPreviewUrlRef.current) {
      URL.revokeObjectURL(loadingPreviewUrlRef.current)
      loadingPreviewUrlRef.current = null
    }
    setLoadingPreviewUrl(null)
  }, [])

  useEffect(() => () => {
    if (loadingPreviewUrlRef.current) {
      URL.revokeObjectURL(loadingPreviewUrlRef.current)
      loadingPreviewUrlRef.current = null
    }
  }, [])

  const loadDemo = useCallback(async () => {
    setIsDemoInitializing(true)
    try {
      const files = await Promise.all(DEMO_PHOTOS.map(async (url, index) => {
        const response = await fetch(url)
        if (!response.ok) throw new Error('Failed to load demo photo')
        const blob = await response.blob()
        return new File([blob], `Demo ${index + 1}.webp`, { type: blob.type || 'image/webp' })
      }))
      await loadImages(files)
    } finally {
      setIsDemoInitializing(false)
    }
  }, [loadImages])

  useEffect(() => {
    if (demoLoadStarted.current) return
    demoLoadStarted.current = true
    void loadDemo()
  }, [loadDemo])

  const handleFileSelect = useCallback(async (files: File | File[], type: 'image' | 'video') => {
    if (type === 'image') {
      const fileArray = Array.isArray(files) ? files : [files]
      if (fileArray.length === 0) return
      lastMediaSelectionRef.current = { type: 'image', files: fileArray }
      setLoadingPreviewForFile(fileArray[0])
      setFileName(fileArray.length === 1 ? fileArray[0].name : `${fileArray.length} images`)
      setMediaType(type)
      try {
        await loadImages(fileArray)
      } finally {
        clearLoadingPreview()
      }
    } else {
      const file = Array.isArray(files) ? files[0] : files
      if (!file) return
      lastMediaSelectionRef.current = { type: 'video', file }
      setLoadingPreviewForFile(null)
      setFileName(file.name)
      setMediaType(type)
      try {
        await loadVideoFile(file)
      } finally {
        clearLoadingPreview()
      }
    }
  }, [clearLoadingPreview, loadImages, loadVideoFile, setLoadingPreviewForFile])

  const handleReset = useCallback(() => {
    lastMediaSelectionRef.current = null
    clearLoadingPreview()
    setMediaType(null)
    setFileName('')
    resetImage()
    resetVideo()
    void loadDemo()
  }, [clearLoadingPreview, loadDemo, resetImage, resetVideo])

  const handleRetry = useCallback(() => {
    const selection = lastMediaSelectionRef.current
    if (!selection) {
      handleReset()
      return
    }

    if (selection.type === 'image') {
      void handleFileSelect(selection.files, 'image')
    } else {
      void handleFileSelect(selection.file, 'video')
    }
  }, [handleFileSelect, handleReset])

  // Determine error type for contextual icon
  const isVideoError = mediaType === 'video'
  const ErrorIcon = isVideoError ? Film : ImageOff

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <Empty className="max-w-md border-0">
          <EmptyHeader>
            <EmptyMedia 
              variant="icon" 
              className="bg-rose-500/10 text-rose-400 size-16 rounded-2xl [&_svg]:size-8"
            >
              <ErrorIcon />
            </EmptyMedia>
            <EmptyTitle className="text-xl text-white">
              {isVideoError ? 'Failed to load video' : 'Failed to load image'}
            </EmptyTitle>
            <EmptyDescription className="text-zinc-400">
              {error}
            </EmptyDescription>
          </EmptyHeader>

          <EmptyContent>
            <div className="flex w-full flex-col gap-2">
              <input
                ref={errorFileInputRef}
                type="file"
                accept={isVideoError
                  ? 'video/mp4,video/webm,video/quicktime,video/mov'
                  : 'image/jpeg,image/png,image/webp,image/gif'}
                multiple={!isVideoError}
                className="sr-only"
                aria-label={isVideoError ? 'Choose another video' : 'Choose another photo'}
                onChange={event => {
                  const files = Array.from(event.target.files ?? [])
                  event.target.value = ''
                  if (files.length > 0) {
                    void handleFileSelect(
                      isVideoError ? files[0] : files,
                      isVideoError ? 'video' : 'image'
                    )
                  }
                }}
              />
              <Button
                onClick={handleRetry}
                variant="outline"
                className="gap-2 border-zinc-700 hover:bg-zinc-800 hover:text-white"
              >
                <RefreshCw className="w-4 h-4" />
                Retry
              </Button>
              <Button onClick={() => errorFileInputRef.current?.click()}>
                Choose another
              </Button>
              <Button variant="ghost" onClick={handleReset}>Back to demo</Button>
            </div>
          </EmptyContent>
        </Empty>
      </div>
    )
  }

  // Show landing screen if no media loaded
  if (mediaType === null && images.length > 0) {
    return (
      <Editor
        images={images}
        currentIndex={currentIndex}
        onIndexChange={goToImage}
        onImageUpdate={updateImage}
        onNextImage={nextImage}
        onPreviousImage={previousImage}
        onBack={handleReset}
        onAddImages={async files => handleFileSelect(files, 'image')}
        onMediaSelect={handleFileSelect}
        demoMode
      />
    )
  }

  if (mediaType === null && isDemoInitializing) {
    return <main className="min-h-screen bg-zinc-950"><LoadingOverlay mediaType="image" /></main>
  }

  if (mediaType === null || (mediaType === 'image' && images.length === 0) || (mediaType === 'video' && !videoData && images.length === 0)) {
    return (
      <>
        <LoadingContent isLoading={isLoading}>
          <LandingScreen onFileSelect={handleFileSelect} />
        </LoadingContent>
        {isLoading && (
          <LoadingOverlay
            mediaType={mediaType === 'video' ? 'video' : 'image'}
            previewUrl={mediaType === 'image' ? loadingPreviewUrl : undefined}
          />
        )}
      </>
    )
  }

  // Keep the current image editor visible while a replacement image or video loads.
  if (images.length > 0 && (mediaType === 'image' || (mediaType === 'video' && !videoData))) {
    return (
      <>
        <LoadingContent isLoading={isLoading}>
          <Editor
            images={images}
            currentIndex={currentIndex}
            onIndexChange={goToImage}
            onImageUpdate={updateImage}
            onNextImage={nextImage}
            onPreviousImage={previousImage}
            onBack={handleReset}
            onAddImages={addImages}
            interactionDisabled={isLoading}
          />
        </LoadingContent>
        {isLoading && (
          <LoadingOverlay
            mediaType={mediaType === 'video' ? 'video' : 'image'}
            previewUrl={mediaType === 'image' ? loadingPreviewUrl : undefined}
          />
        )}
      </>
    )
  }

  // Show video editor
  if (mediaType === 'video' && videoData) {
    return (
      <>
        <LoadingContent isLoading={isLoading}>
          <VideoEditor
            videoData={videoData}
            fileName={fileName}
            onBack={handleReset}
            onExport={exportVideoWithEffects}
            exportState={exportState}
            onCancelExport={cancelExport}
            onDismissExportError={dismissExportError}
          />
        </LoadingContent>
        {isLoading && <LoadingOverlay mediaType="video" />}
      </>
    )
  }

  return null
}

/**
 * Root application component wrapped with error boundary.
 */
function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  )
}

export default App
