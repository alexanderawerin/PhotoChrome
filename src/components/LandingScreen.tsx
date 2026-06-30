import { useRef, useState, useCallback } from 'react'
import { Upload, Camera } from 'lucide-react'
import { Button } from './ui/button'
import { PhotoArc } from './PhotoArc'
import { SUPPORTED_IMAGE_TYPES } from '../engine/media-selection'

interface LandingScreenProps {
  onFileSelect: (files: File | File[], type: 'image' | 'video') => void
}

/** Accepted image MIME types */
/** Accepted video MIME types */
const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/mov']

/**
 * Validates that a file is an accepted image type.
 */
function isValidImageFile(file: File): boolean {
  return SUPPORTED_IMAGE_TYPES.includes(file.type.toLowerCase() as typeof SUPPORTED_IMAGE_TYPES[number])
}

/**
 * Validates that a file is an accepted video type.
 */
function isValidVideoFile(file: File): boolean {
  return file.type.startsWith('video/') || ACCEPTED_VIDEO_TYPES.includes(file.type)
}

export function LandingScreen({ onFileSelect }: LandingScreenProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleFileSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (files.length === 0) return

    if (files.every(isValidImageFile)) {
      onFileSelect(files, 'image')
    } else if (files.length === 1 && isValidVideoFile(files[0])) {
      onFileSelect(files[0], 'video')
    } else {
      // Pass the complete group to the image validator so mixed/unsupported
      // selections fail atomically instead of silently dropping files.
      onFileSelect(files, 'image')
    }
  }, [onFileSelect])

  const handleButtonClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    setIsDragging(false)

    const files = Array.from(event.dataTransfer.files)
    if (files.length === 0) return

    if (files.every(isValidImageFile)) {
      onFileSelect(files, 'image')
    } else if (files.length === 1 && isValidVideoFile(files[0])) {
      onFileSelect(files[0], 'video')
    } else {
      onFileSelect(files, 'image')
    }
  }, [onFileSelect])

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
            One hundred film simulations<br/>for your photos and videos
          </p>
        </header>

        <div className="mt-6">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
            multiple
            onChange={handleFileSelect}
            className="sr-only"
            id="media-upload"
            aria-label="Select image or video for processing"
          />
          
          <Button
            size="lg"
            onClick={handleButtonClick}
            className="gap-2.5 text-sm px-6 py-5 bg-white text-black hover:bg-zinc-200 transition-all duration-200 rounded-xl pointer-events-auto"
            aria-controls="media-upload"
          >
            <Upload className="w-4 h-4" aria-hidden="true" />
            Upload Photos or Video
          </Button>
          
          <p 
            className={`
              text-xs mt-4 text-center transition-colors duration-300
              ${isDragging ? 'text-white' : 'text-zinc-600'}
            `}
            aria-live="polite"
          >
            {isDragging ? (
              'Drop to upload'
            ) : (
              <>
                © 2026{' '}
                <a
                  href="https://netdesigner.ru"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-zinc-300 transition-colors"
                >
                  Alexander Awerin
                </a>
              </>
            )}
          </p>
        </div>
      </div>
    </main>
  )
}
