import { useState, useEffect } from 'react'
import { LandingScreen } from './components/LandingScreen'
import { Editor } from './components/Editor'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Spinner } from './components/ui/spinner'
import { useImageProcessor } from './hooks/useImageProcessor'

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

/**
 * Main application component.
 * Handles routing between landing screen and editor based on loaded image state.
 */
function AppContent() {
  const { image, imageData, isLoading, error, loadImage, reset } = useImageProcessor()

  // Show error state if image loading failed
  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <p className="text-red-400">{error}</p>
          <button
            onClick={reset}
            className="text-sm text-zinc-400 hover:text-white underline"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  // Show landing screen if no image loaded
  if (!image || !imageData) {
    return (
      <>
        <LandingScreen onImageSelect={loadImage} />
        {isLoading && <LoadingOverlay />}
      </>
    )
  }

  // Show editor with loaded image
  return (
    <Editor
      originalImage={imageData.original}
      thumbnail={imageData.thumbnail}
      fileName={image.name}
      onBack={reset}
    />
  )
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

