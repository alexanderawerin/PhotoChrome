import { useEffect, useRef, useState } from 'react'
import { CropOverlay } from './CropOverlay'
import { AspectRatio, type NormalizedCropRect } from '../engine/transform'
import { RESIZE_DEBOUNCE_DELAY } from '../constants'

interface PreviewProps {
  imageData: ImageData | null
  alt?: string
  cropMode?: boolean
  cropRatio?: AspectRatio
  cropOffset?: { x: number; y: number }
  onCropOffsetChange?: (offset: { x: number; y: number }) => void
  cropRect?: NormalizedCropRect
  onCropRectChange?: (rect: NormalizedCropRect) => void
  cropScale?: number
  onCropScaleChange?: (scale: number) => void
  cropGridActive?: boolean
  onMouseDown?: () => void
  onMouseUp?: () => void
  onMouseLeave?: () => void
  // Swipe navigation для multi-image режима
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
  enableSwipe?: boolean
  cover?: boolean
  /** Media ownership changes invalidate an in-flight touch gesture. */
  gestureContextKey?: string
}

export function Preview({
  imageData,
  alt = 'Preview',
  cropMode = false,
  cropRatio = 'free',
  cropOffset,
  onCropOffsetChange,
  cropRect,
  onCropRectChange,
  cropScale = 1,
  onCropScaleChange,
  cropGridActive = false,
  onMouseDown,
  onMouseUp,
  onMouseLeave,
  onSwipeLeft,
  onSwipeRight,
  enableSwipe = false,
  cover = false,
  gestureContextKey,
}: PreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [canvasDisplaySize, setCanvasDisplaySize] = useState({ width: 0, height: 0 })

  // Swipe detection
  const gesture = useRef<{ startX: number; startY: number; endX: number; endY: number; swiping: boolean; cancelled: boolean } | null>(null)
  const suppressMouseUntil = useRef(0)
  const releaseComparison = useRef(onMouseUp)
  releaseComparison.current = onMouseUp
  const pinchStart = useRef<{ distance: number; scale: number } | null>(null)

  useEffect(() => {
    const release = () => {
      gesture.current = null
      pinchStart.current = null
      releaseComparison.current?.()
    }
    const onVisibility = () => { if (document.hidden) release() }
    window.addEventListener('blur', release)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('blur', release)
      document.removeEventListener('visibilitychange', onVisibility)
      release()
    }
  }, [])

  useEffect(() => {
    gesture.current = null
    pinchStart.current = null
    releaseComparison.current?.()
  }, [gestureContextKey, cropMode, enableSwipe])

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

      if ((imageAspect > containerAspect) !== cover) {
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
  }, [cover, imageData])

  if (!imageData) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-zinc-900 rounded-lg">
        <p className="text-muted-foreground">Нет изображения</p>
      </div>
    )
  }

  // Swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    suppressMouseUntil.current = performance.now() + 700
    gesture.current = null
    if (cropMode && e.touches.length === 2) {
      onMouseUp?.()
      const [first, second] = Array.from(e.touches)
      pinchStart.current = {
        distance: Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY),
        scale: cropScale,
      }
      return
    }
    if (cropMode || e.touches.length !== 1) {
      onMouseUp?.()
      return
    }
    const { clientX, clientY } = e.touches[0]
    gesture.current = { startX: clientX, startY: clientY, endX: clientX, endY: clientY, swiping: false, cancelled: false }
    onMouseDown?.()
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (cropMode && e.touches.length === 2 && pinchStart.current && onCropScaleChange) {
      const [first, second] = Array.from(e.touches)
      const distance = Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY)
      onCropScaleChange(Math.max(1, Math.min(3, pinchStart.current.scale * distance / pinchStart.current.distance)))
      return
    }
    if (cropMode || !gesture.current) return
    if (e.touches.length !== 1) {
      gesture.current = null
      onMouseUp?.()
      return
    }
    const current = gesture.current
    current.endX = e.touches[0].clientX
    current.endY = e.touches[0].clientY
    const dx = Math.abs(current.startX - current.endX)
    const dy = Math.abs(current.startY - current.endY)
    if (Math.max(dx, dy) > 50) {
      current.swiping = enableSwipe && dx > dy
      if (dy >= dx) current.cancelled = true
      onMouseUp?.()
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    suppressMouseUntil.current = performance.now() + 700
    pinchStart.current = null
    const current = gesture.current
    gesture.current = null
    onMouseUp?.()
    if (!current || !enableSwipe || cropMode || current.cancelled || e.touches.length > 0) return
    const swipeDistanceX = current.startX - current.endX
    const swipeDistanceY = current.startY - current.endY
    const minSwipeDistance = 50

    // Проверяем что это горизонтальный свайп (а не вертикальный скролл)
    if (current.swiping && Math.abs(swipeDistanceX) > Math.abs(swipeDistanceY) && Math.abs(swipeDistanceX) > minSwipeDistance) {
      if (swipeDistanceX > 0) {
        onSwipeLeft?.() // Свайп влево = следующее фото
      } else {
        onSwipeRight?.() // Свайп вправо = предыдущее фото
      }
    }
  }

  const handleTouchCancel = () => {
    suppressMouseUntil.current = performance.now() + 700
    gesture.current = null
    pinchStart.current = null
    onMouseUp?.()
  }

  return (
    <div
      ref={wrapperRef}
      className="w-full h-full flex items-center justify-center select-none overflow-hidden"
      style={{ touchAction: cropMode ? 'none' : 'pan-y' }}
      onMouseDown={cropMode ? undefined : () => { if (performance.now() >= suppressMouseUntil.current) onMouseDown?.() }}
      onMouseUp={cropMode ? undefined : onMouseUp}
      onMouseLeave={cropMode ? undefined : onMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      onContextMenu={event => event.preventDefault()}
    >
      <div 
        className="relative shrink-0 transition-[width,height] [transition-duration:280ms] ease-out motion-reduce:transition-none md:transition-none"
        style={{
          width: canvasDisplaySize.width || 'auto',
          height: canvasDisplaySize.height || 'auto',
        }}
      >
        <canvas
          ref={canvasRef}
          className={`block w-full h-full ${cover ? '' : 'rounded-lg shadow-2xl'}`}
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
              offsetX={cropOffset?.x ?? 0.5}
              offsetY={cropOffset?.y ?? 0.5}
              onOffsetChange={onCropOffsetChange}
              cropRect={cropRect}
              onCropRectChange={onCropRectChange}
              gridActive={cropGridActive}
            />
          </div>
        )}
      </div>
    </div>
  )
}
