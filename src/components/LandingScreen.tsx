import { useRef, useState } from 'react'
import { Upload, Camera } from 'lucide-react'
import { Button } from './ui/button'
import { PhotoArc } from './PhotoArc'

interface LandingScreenProps {
  onImageSelect: (file: File) => void
}

export function LandingScreen({ onImageSelect }: LandingScreenProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      onImageSelect(file)
    }
  }

  const handleButtonClick = () => {
    fileInputRef.current?.click()
  }

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault()
    setIsDragging(false)
    const file = event.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) {
      onImageSelect(file)
    }
  }

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (event: React.DragEvent) => {
    event.preventDefault()
    setIsDragging(false)
  }

  return (
    <div
      className={`
        min-h-screen relative
        transition-colors duration-300 overflow-hidden
        ${isDragging ? 'bg-zinc-900/50' : ''}
      `}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {/* Background */}
      <div className="absolute inset-0 bg-zinc-950" />

      {/* Арка из фото - слой 1 */}
      <PhotoArc />

      {/* Текст и кнопка - слой 2 (поверх всего, по центру) */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-[100]">
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center mb-2">
            <Camera className="w-6 h-6 text-zinc-500" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white">
            Photochrome
          </h1>
          <p className="text-sm text-zinc-500 max-w-xs mx-auto leading-relaxed">
            Плёночные симуляции Fujifilm<br/>для ваших фотографий
          </p>
        </div>

        <div className="mt-6">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          <Button
            size="lg"
            onClick={handleButtonClick}
            className="gap-2.5 text-sm px-6 py-5 bg-white text-black hover:bg-zinc-200 transition-all duration-200 rounded-xl pointer-events-auto"
          >
            <Upload className="w-4 h-4" />
            Загрузить фото
          </Button>
          
          <p className={`
            text-xs mt-4 text-center transition-colors duration-300
            ${isDragging ? 'text-white' : 'text-zinc-600'}
          `}>
            {isDragging ? 'Отпустите для загрузки' : 'или перетащите фото сюда'}
          </p>
        </div>
      </div>
    </div>
  )
}
