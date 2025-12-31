interface ImageCounterProps {
  currentIndex: number
  totalImages: number
}

/**
 * Счётчик изображений для мобильного интерфейса
 * Показывает текущее изображение и общее количество (например, 1/5)
 */
export function ImageCounter({ currentIndex, totalImages }: ImageCounterProps) {
  if (totalImages <= 1) {
    return null
  }

  return (
    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-10 md:hidden">
      <div className="bg-zinc-900/80 backdrop-blur-sm px-3 py-1 rounded-full">
        <p className="text-xs text-white font-medium">
          {currentIndex + 1} / {totalImages}
        </p>
      </div>
    </div>
  )
}
