import { useEffect, useRef, useState } from 'react'
import { CropOverlay } from './CropOverlay'
import { AspectRatio } from '../engine/transform'

interface PreviewProps {
  imageData: ImageData | null
  alt?: string
  cropMode?: boolean
  cropRatio?: AspectRatio
  onMouseDown?: () => void
  onMouseUp?: () => void
  onMouseLeave?: () => void
}

export function Preview({ 
  imageData, 
  alt = 'Preview',
  cropMode = false,
  cropRatio = 'free',
  onMouseDown,
  onMouseUp,
  onMouseLeave
}: PreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [canvasDisplaySize, setCanvasDisplaySize] = useState({ width: 0, height: 0 })

  // Рисуем изображение на canvas
  useEffect(() => {
    if (!imageData || !canvasRef.current) return

    const canvas = canvasRef.current
    canvas.width = imageData.width
    canvas.height = imageData.height

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.putImageData(imageData, 0, 0)
  }, [imageData])

  // Вычисляем размер canvas на экране для позиционирования оверлея
  useEffect(() => {
    const updateSize = () => {
      if (!canvasRef.current || !wrapperRef.current || !imageData) return

      const wrapper = wrapperRef.current
      const wrapperRect = wrapper.getBoundingClientRect()

      // Вычисляем размер, чтобы изображение вписывалось в контейнер
      const imageAspect = imageData.width / imageData.height
      const containerAspect = wrapperRect.width / wrapperRect.height

      let displayWidth: number
      let displayHeight: number

      if (imageAspect > containerAspect) {
        // Изображение шире контейнера - ограничиваем по ширине
        displayWidth = wrapperRect.width
        displayHeight = wrapperRect.width / imageAspect
      } else {
        // Изображение выше контейнера - ограничиваем по высоте
        displayHeight = wrapperRect.height
        displayWidth = wrapperRect.height * imageAspect
      }

      setCanvasDisplaySize({ width: displayWidth, height: displayHeight })
    }

    updateSize()

    // Обновляем при ресайзе
    window.addEventListener('resize', updateSize)
    
    // Также обновляем через небольшую задержку (для случаев когда layout ещё не стабилизировался)
    const timeoutId = setTimeout(updateSize, 100)

    return () => {
      window.removeEventListener('resize', updateSize)
      clearTimeout(timeoutId)
    }
  }, [imageData])

  if (!imageData) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-zinc-900 rounded-lg">
        <p className="text-muted-foreground">Нет изображения</p>
      </div>
    )
  }

  return (
    <div 
      ref={wrapperRef}
      className="w-full h-full flex items-center justify-center select-none overflow-hidden"
      onMouseDown={cropMode ? undefined : onMouseDown}
      onMouseUp={cropMode ? undefined : onMouseUp}
      onMouseLeave={cropMode ? undefined : onMouseLeave}
      onTouchStart={cropMode ? undefined : onMouseDown}
      onTouchEnd={cropMode ? undefined : onMouseUp}
    >
      <div 
        className="relative"
        style={{
          width: canvasDisplaySize.width || 'auto',
          height: canvasDisplaySize.height || 'auto',
        }}
      >
        <canvas
          ref={canvasRef}
          className="block w-full h-full rounded-lg shadow-2xl"
          aria-label={alt}
          draggable={false}
        />
        
        {/* Crop overlay */}
        {cropMode && canvasDisplaySize.width > 0 && (
          <div className="absolute inset-0 rounded-lg overflow-hidden">
            <CropOverlay
              imageWidth={imageData.width}
              imageHeight={imageData.height}
              aspectRatio={cropRatio}
            />
          </div>
        )}
      </div>
    </div>
  )
}
