import { useState, useEffect, useCallback } from 'react'
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
  const {
    images,
    currentIndex,
    isLoading: isImageLoading,
    error: imageError,
    loadImages,
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

  const handleFileSelect = useCallback(async (files: File | File[], type: 'image' | 'video') => {
    if (type === 'image') {
      const fileArray = Array.isArray(files) ? files : [files]
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
  }, [resetImage, resetVideo])

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
            <Button
              onClick={handleReset}
              variant="outline"
              className="gap-2 border-zinc-700 hover:bg-zinc-800 hover:text-white"
            >
              <RefreshCw className="w-4 h-4" />
              Try again
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    )
  }

  // Show landing screen if no media loaded
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
      <Editor
        images={images}
        currentIndex={currentIndex}
        onIndexChange={goToImage}
        onImageUpdate={updateImage}
        onNextImage={nextImage}
        onPreviousImage={previousImage}
        fileName={fileName}
        onBack={handleReset}
      />
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
