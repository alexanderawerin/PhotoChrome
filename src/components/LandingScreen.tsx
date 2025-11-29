import { useRef, useState, useCallback } from 'react'
import { Upload, Camera } from 'lucide-react'
import { Button } from './ui/button'
import { PhotoArc } from './PhotoArc'

interface LandingScreenProps {
  onImageSelect: (file: File) => void
}

/** Accepted image MIME types */
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

/**
 * Validates that a file is an accepted image type.
 */
function isValidImageFile(file: File): boolean {
  return file.type.startsWith('image/') || ACCEPTED_IMAGE_TYPES.includes(file.type)
}

export function LandingScreen({ onImageSelect }: LandingScreenProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && isValidImageFile(file)) {
      onImageSelect(file)
    }
  }, [onImageSelect])

  const handleButtonClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    setIsDragging(false)
    const file = event.dataTransfer.files[0]
    if (file && isValidImageFile(file)) {
      onImageSelect(file)
    }
  }, [onImageSelect])

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    setIsDragging(false)
  }, [])

  return (
    <main
      className={`
        min-h-screen relative
        transition-colors duration-300 overflow-hidden
        ${isDragging ? 'bg-zinc-900/50' : ''}
      `}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      role="main"
      aria-label="Photochrome start screen"
    >
      {/* Background */}
      <div className="absolute inset-0 bg-zinc-950" aria-hidden="true" />

      {/* Decorative circle of cards */}
      <PhotoArc />

      {/* Main content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-[100]">
        <header className="text-center space-y-3">
          <div className="flex items-center justify-center mb-2" aria-hidden="true">
            <Camera className="w-6 h-6 text-zinc-500" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white">
            Photochrome
          </h1>
          <p className="text-sm text-zinc-500 max-w-xs mx-auto leading-relaxed">
            Fujifilm film simulations<br/>for your photos
          </p>
        </header>

        <div className="mt-6">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="sr-only"
            id="image-upload"
            aria-label="Select image for processing"
          />
          
          <Button
            size="lg"
            onClick={handleButtonClick}
            className="gap-2.5 text-sm px-6 py-5 bg-white text-black hover:bg-zinc-200 transition-all duration-200 rounded-xl pointer-events-auto"
            aria-controls="image-upload"
          >
            <Upload className="w-4 h-4" aria-hidden="true" />
            Upload Photo
          </Button>
          
          <p 
            className={`
              text-xs mt-4 text-center transition-colors duration-300 hidden md:block
              ${isDragging ? 'text-white' : 'text-zinc-600'}
            `}
            aria-live="polite"
          >
            {isDragging ? 'Drop to upload' : 'or drag and drop here'}
          </p>
        </div>
      </div>
    </main>
  )
}
