import { useMemo } from 'react'
import { AspectRatio, calculateCropArea } from '../engine/transform'

interface CropOverlayProps {
  imageWidth: number
  imageHeight: number
  aspectRatio: AspectRatio
}

export function CropOverlay({ imageWidth, imageHeight, aspectRatio }: CropOverlayProps) {
  // Вычисляем область кропа
  const cropArea = useMemo(() => {
    return calculateCropArea(imageWidth, imageHeight, aspectRatio)
  }, [imageWidth, imageHeight, aspectRatio])

  // Вычисляем проценты для позиционирования
  const overlay = useMemo(() => {
    const left = (cropArea.x / imageWidth) * 100
    const top = (cropArea.y / imageHeight) * 100
    const width = (cropArea.width / imageWidth) * 100
    const height = (cropArea.height / imageHeight) * 100
    const right = 100 - left - width
    const bottom = 100 - top - height

    return { left, top, width, height, right, bottom }
  }, [cropArea, imageWidth, imageHeight])

  // Если free - не показываем оверлей
  if (aspectRatio === 'free') {
    return null
  }

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Затемнение сверху */}
      {overlay.top > 0 && (
        <div
          className="absolute left-0 right-0 top-0 bg-black/60"
          style={{ height: `${overlay.top}%` }}
        />
      )}

      {/* Затемнение снизу */}
      {overlay.bottom > 0 && (
        <div
          className="absolute left-0 right-0 bottom-0 bg-black/60"
          style={{ height: `${overlay.bottom}%` }}
        />
      )}

      {/* Затемнение слева */}
      {overlay.left > 0 && (
        <div
          className="absolute left-0 bg-black/60"
          style={{
            top: `${overlay.top}%`,
            width: `${overlay.left}%`,
            height: `${overlay.height}%`
          }}
        />
      )}

      {/* Затемнение справа */}
      {overlay.right > 0 && (
        <div
          className="absolute right-0 bg-black/60"
          style={{
            top: `${overlay.top}%`,
            width: `${overlay.right}%`,
            height: `${overlay.height}%`
          }}
        />
      )}

      {/* Рамка области кропа */}
      <div
        className="absolute border-2 border-white/80 shadow-lg"
        style={{
          left: `${overlay.left}%`,
          top: `${overlay.top}%`,
          width: `${overlay.width}%`,
          height: `${overlay.height}%`
        }}
      >
        {/* Сетка 3x3 (правило третей) */}
        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
          {[...Array(9)].map((_, i) => (
            <div
              key={i}
              className="border border-white/20"
            />
          ))}
        </div>

        {/* Угловые маркеры */}
        <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-white" />
        <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-white" />
        <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-white" />
        <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-white" />
      </div>
    </div>
  )
}

