import { LandingScreen } from './components/LandingScreen'
import { Editor } from './components/Editor'
import { useImageProcessor } from './hooks/useImageProcessor'

function App() {
  const { image, imageData, isLoading, loadImage, reset } = useImageProcessor()

  if (!image || !imageData) {
    return (
      <>
        <LandingScreen onImageSelect={loadImage} />
        {isLoading && (
          <div className="fixed inset-0 bg-background/80 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Загрузка изображения...</p>
            </div>
          </div>
        )}
      </>
    )
  }

  return (
    <Editor
      originalImage={imageData.original}
      thumbnail={imageData.thumbnail}
      fileName={image.name}
      onBack={reset}
    />
  )
}

export default App

