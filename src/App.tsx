import { useState, useEffect, useCallback, useRef } from 'react'
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

/**
 * Loading messages that cycle while waiting.
 * Ordered from quick to slow operations.
 */
const LOADING_MESSAGES = [
  'Reading file...',
  'Decoding image...',
  'Preparing canvas...',
  'Creating thumbnail...',
  'Almost ready...',
  'Just a moment...',
  'Still working...',
  'Large image, hang tight...',
  'Processing pixels...',
  'Worth the wait...',
] as const

/** Interval between message changes (ms) - 1 second */
const MESSAGE_INTERVAL = 1000
const DEMO_PHOTOS = [demoOneUrl, demoTwoUrl, demoThreeUrl] as const

/**
 * Loading overlay shown while image is being processed.
 * Cycles through helpful messages on slow connections.
 * Styled like shadcn/ui Item component with muted variant.
 */
function LoadingOverlay() {
  const [messageIndex, setMessageIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex(prev => (prev + 1) % LOADING_MESSAGES.length)
    }, MESSAGE_INTERVAL)

    return () => clearInterval(interval)
  }, [])

  return (
    <div 
      className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[200] p-4"
      role="status"
      aria-label="Loading image"
      aria-live="polite"
    >
      {/* Item-like container with muted background */}
      <div className="flex items-center gap-3 pl-4 pr-4 py-3 rounded-xl bg-zinc-800/80">
        <Spinner className="size-5 text-zinc-400 flex-shrink-0" />
        <p 
          key={messageIndex}
          className="text-sm text-zinc-300 animate-fade-in whitespace-nowrap"
        >
          {LOADING_MESSAGES[messageIndex]}
        </p>
      </div>
    </div>
  )
}

type MediaType = 'image' | 'video' | null

/**
 * Main application component.
 * Handles routing between landing screen and editor based on loaded media state.
 */
function AppContent() {
  const [mediaType, setMediaType] = useState<MediaType>(null)
  const [fileName, setFileName] = useState<string>('')
  const [isDemoInitializing, setIsDemoInitializing] = useState(true)
  const demoLoadStarted = useRef(false)
  const lastImageFilesRef = useRef<File[]>([])
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
      lastImageFilesRef.current = fileArray
      setFileName(fileArray.length === 1 ? fileArray[0].name : `${fileArray.length} images`)
      setMediaType(type)
      await loadImages(fileArray)
    } else {
      const file = Array.isArray(files) ? files[0] : files
      setFileName(file.name)
      setMediaType(type)
      await loadVideoFile(file)
    }
  }, [loadImages, loadVideoFile])

  const handleReset = useCallback(() => {
    setMediaType(null)
    setFileName('')
    resetImage()
    resetVideo()
    void loadDemo()
  }, [loadDemo, resetImage, resetVideo])

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
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                className="sr-only"
                aria-label="Choose another photo"
                onChange={event => {
                  const files = Array.from(event.target.files ?? [])
                  event.target.value = ''
                  if (files.length > 0) void handleFileSelect(files, 'image')
                }}
              />
              <Button
                onClick={() => {
                  if (lastImageFilesRef.current.length > 0) void loadImages(lastImageFilesRef.current)
                  else handleReset()
                }}
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
    return <main className="min-h-screen bg-zinc-950"><LoadingOverlay /></main>
  }

  if (mediaType === null || (mediaType === 'image' && images.length === 0) || (mediaType === 'video' && !videoData)) {
    return (
      <>
        <LandingScreen onFileSelect={handleFileSelect} />
        {isLoading && <LoadingOverlay />}
      </>
    )
  }

  // Show image editor (multi-image support)
  if (mediaType === 'image' && images.length > 0) {
    return (
      <>
        <Editor
          images={images}
          currentIndex={currentIndex}
          onIndexChange={goToImage}
          onImageUpdate={updateImage}
          onNextImage={nextImage}
          onPreviousImage={previousImage}
          onBack={handleReset}
          onAddImages={addImages}
        />
        {isLoading && <LoadingOverlay />}
      </>
    )
  }

  // Show video editor
  if (mediaType === 'video' && videoData) {
    return (
      <VideoEditor
        videoData={videoData}
        fileName={fileName}
        onBack={handleReset}
        onExport={exportVideoWithEffects}
        exportState={exportState}
        onCancelExport={cancelExport}
        onDismissExportError={dismissExportError}
      />
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
