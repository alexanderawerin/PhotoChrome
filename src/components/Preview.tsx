import { useEffect, useRef, useState } from 'react'
import { CropOverlay } from './CropOverlay'
import { AspectRatio } from '../engine/transform'
import { RESIZE_DEBOUNCE_DELAY } from '../constants'

interface PreviewProps {
  imageData: ImageData | null
  alt?: string
  cropMode?: boolean
  cropRatio?: AspectRatio
  onMouseDown?: () => void
  onMouseUp?: () => void
  onMouseLeave?: () => void
  // Swipe navigation для multi-image режима
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  enableSwipe?: boolean
}

export function Preview({
  imageData,
  alt = 'Preview',
  cropMode = false,
  cropRatio = 'free',
  onMouseDown,
  onMouseUp,
  onMouseLeave,
  onSwipeLeft,
  onSwipeRight,
  enableSwipe = false
}: PreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [canvasDisplaySize, setCanvasDisplaySize] = useState({ width: 0, height: 0 })

  // Swipe detection
  const touchStartX = useRef(0)
  const touchEndX = useRef(0)
  const touchStartY = useRef(0)
  const touchEndY = useRef(0)

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
    if (!wrapperRef.current || !imageData) return

    const wrapper = wrapperRef.current

    const updateSize = () => {
      if (!canvasRef.current) return

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

    // ResizeObserver для отслеживания изменений размера контейнера
    // (срабатывает при сворачивании/разворачивании панели)
    const resizeObserver = new ResizeObserver(() => {
      // Небольшая задержка чтобы дождаться окончания CSS transition
      requestAnimationFrame(updateSize)
    })
    resizeObserver.observe(wrapper)

    // Также слушаем window resize на случай изменения размера окна
    window.addEventListener('resize', updateSize)
    
    // Обновляем через небольшую задержку (для случаев когда layout ещё не стабилизировался)
    const timeoutId = setTimeout(updateSize, RESIZE_DEBOUNCE_DELAY)

    return () => {
      resizeObserver.disconnect()
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

  // Swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!enableSwipe || cropMode) {
      // Fallback к обычным onTouch handlers
      onMouseDown?.()
      return
    }

    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!enableSwipe || cropMode) return

    touchEndX.current = e.touches[0].clientX
    touchEndY.current = e.touches[0].clientY
  }

  const handleTouchEnd = () => {
    if (!enableSwipe || cropMode) {
      // Fallback к обычным onTouch handlers
      onMouseUp?.()
      return
    }

    const swipeDistanceX = touchStartX.current - touchEndX.current
    const swipeDistanceY = touchStartY.current - touchEndY.current
    const minSwipeDistance = 50

    // Проверяем что это горизонтальный свайп (а не вертикальный скролл)
    if (Math.abs(swipeDistanceX) > Math.abs(swipeDistanceY) && Math.abs(swipeDistanceX) > minSwipeDistance) {
      if (swipeDistanceX > 0) {
        onSwipeLeft?.() // Свайп влево = следующее фото
      } else {
        onSwipeRight?.() // Свайп вправо = предыдущее фото
      }
    }
  }

  return (
    <div
      ref={wrapperRef}
      className="w-full h-full flex items-center justify-center select-none overflow-hidden"
      onMouseDown={cropMode ? undefined : onMouseDown}
      onMouseUp={cropMode ? undefined : onMouseUp}
      onMouseLeave={cropMode ? undefined : onMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
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
