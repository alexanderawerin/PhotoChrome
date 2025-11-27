import { useRef } from 'react'
import { Upload } from 'lucide-react'
import { Button } from './ui/button'
import { PhotoArc } from './PhotoArc'
import { getAllRecipes } from '../presets/recipes'

interface LandingScreenProps {
  onImageSelect: (file: File) => void
}

export function LandingScreen({ onImageSelect }: LandingScreenProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const recipes = getAllRecipes()

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
    const file = event.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) {
      onImageSelect(file)
    }
  }

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault()
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-8"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      <div className="max-w-2xl w-full text-center space-y-8">
        {/* Арка из примеров */}
        <PhotoArc recipes={recipes.map(r => r.name)} />

        {/* Заголовок */}
        <div className="space-y-4">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
            Photochrome
          </h1>
          <p className="text-lg text-muted-foreground max-w-md mx-auto">
            Плёночные симуляции Fujifilm для любых фото
          </p>
        </div>

        {/* Кнопка загрузки */}
        <div className="pt-4">
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
            className="gap-2"
          >
            <Upload className="w-5 h-5" />
            Загрузить фото
          </Button>
          <p className="text-sm text-muted-foreground mt-4">
            или перетащите фото сюда
          </p>
        </div>
      </div>
    </div>
  )
}

