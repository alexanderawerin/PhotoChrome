import { LandingScreen } from './components/LandingScreen'
import { Editor } from './components/Editor'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useImageProcessor } from './hooks/useImageProcessor'

/**
 * Loading overlay shown while image is being processed.
 */
function LoadingOverlay() {
  return (
    <div 
      className="fixed inset-0 bg-background/80 flex items-center justify-center z-50"
      role="status"
      aria-label="Загрузка изображения"
    >
      <div className="text-center">
        <div 
          className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"
          aria-hidden="true"
        />
        <p className="text-muted-foreground">Загрузка изображения...</p>
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
            Попробовать снова
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

