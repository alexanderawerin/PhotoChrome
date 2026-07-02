import { useRef, useMemo, useState } from 'react'
import { AspectRatio, type NormalizedCropRect } from '../engine/transform'

interface CropOverlayProps {
  imageWidth: number
  imageHeight: number
  aspectRatio: AspectRatio
  /** Горизонтальное смещение рамки: 0 = левый край, 0.5 = центр, 1 = правый край */
  offsetX?: number
  /** Вертикальное смещение рамки: 0 = верхний край, 0.5 = центр, 1 = нижний край */
  offsetY?: number
  onOffsetChange?: (offset: { x: number; y: number }) => void
  cropRect?: NormalizedCropRect
  onCropRectChange?: (rect: NormalizedCropRect) => void
  gridActive?: boolean
}

export function CropOverlay({
  imageWidth,
  imageHeight,
  aspectRatio,
  offsetX = 0.5,
  offsetY = 0.5,
  onOffsetChange,
  cropRect = { x: 0, y: 0, width: 1, height: 1 },
  onCropRectChange,
  gridActive = false,
}: CropOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)
  const dragStartRef = useRef({ x: 0, y: 0, ox: 0.5, oy: 0.5 })
  const freeStartRef = useRef({ x: 0, y: 0, rect: cropRect, corner: '' })
  const [isDragging, setIsDragging] = useState(false)

  // Вычисляем долю (0..1) размеров кропа от всего изображения
  const cropFraction = useMemo(() => {
    if (aspectRatio === 'free') return { w: cropRect.width, h: cropRect.height }
    if (aspectRatio === 'original') return null

    const ratios: Record<AspectRatio, number> = {
      'original': imageWidth / imageHeight,
      '1:1': 1,
      '4:3': 4 / 3,
      '3:4': 3 / 4,
      '16:9': 16 / 9,
      '9:16': 9 / 16,
      'free': 1,
    }

    const targetRatio = ratios[aspectRatio]
    const currentRatio = imageWidth / imageHeight

    let wFrac: number, hFrac: number
    if (currentRatio > targetRatio) {
      hFrac = 1
      wFrac = (imageHeight * targetRatio) / imageWidth
    } else {
      wFrac = 1
      hFrac = (imageWidth / targetRatio) / imageHeight
    }
    return { w: wFrac, h: hFrac }
  }, [imageWidth, imageHeight, aspectRatio, cropRect.height, cropRect.width])

  if (aspectRatio === 'original' || !cropFraction) return null

  // Позиция рамки в процентах от контейнера
  const cropWidthPct  = cropFraction.w * 100
  const cropHeightPct = cropFraction.h * 100
  const availW = 100 - cropWidthPct   // % от контейнера
  const availH = 100 - cropHeightPct

  const leftPct   = aspectRatio === 'free' ? cropRect.x * 100 : availW * offsetX
  const topPct    = aspectRatio === 'free' ? cropRect.y * 100 : availH * offsetY
  const rightPct  = 100 - leftPct - cropWidthPct
  const bottomPct = 100 - topPct - cropHeightPct

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    isDraggingRef.current = true
    setIsDragging(true)
    dragStartRef.current = { x: e.clientX, y: e.clientY, ox: offsetX, oy: offsetY }
    freeStartRef.current = { x: e.clientX, y: e.clientY, rect: { ...cropRect }, corner: 'move' }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return
    const container = containerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    const availPxW = rect.width  * (availW / 100)
    const availPxH = rect.height * (availH / 100)

    if (aspectRatio === 'free' && onCropRectChange) {
      const start = freeStartRef.current
      const dx = (e.clientX - start.x) / rect.width
      const dy = (e.clientY - start.y) / rect.height
      const minimum = 0.1
      const next = { ...start.rect }
      if (start.corner === 'move') {
        next.x = Math.max(0, Math.min(1 - next.width, start.rect.x + dx))
        next.y = Math.max(0, Math.min(1 - next.height, start.rect.y + dy))
      } else {
        if (start.corner.includes('l')) {
          const right = start.rect.x + start.rect.width
          next.x = Math.max(0, Math.min(right - minimum, start.rect.x + dx))
          next.width = right - next.x
        }
        if (start.corner.includes('r')) next.width = Math.max(minimum, Math.min(1 - start.rect.x, start.rect.width + dx))
        if (start.corner.includes('t')) {
          const bottom = start.rect.y + start.rect.height
          next.y = Math.max(0, Math.min(bottom - minimum, start.rect.y + dy))
          next.height = bottom - next.y
        }
        if (start.corner.includes('b')) next.height = Math.max(minimum, Math.min(1 - start.rect.y, start.rect.height + dy))
      }
      onCropRectChange(next)
      return
    }
    if (!onOffsetChange) return
    const newX = availPxW > 0
      ? Math.max(0, Math.min(1, dragStartRef.current.ox + (e.clientX - dragStartRef.current.x) / availPxW))
      : dragStartRef.current.ox

    const newY = availPxH > 0
      ? Math.max(0, Math.min(1, dragStartRef.current.oy + (e.clientY - dragStartRef.current.y) / availPxH))
      : dragStartRef.current.oy

    onOffsetChange({ x: newX, y: newY })
  }

  const handlePointerUp = () => {
    isDraggingRef.current = false
    setIsDragging(false)
  }

  const handleResizeStart = (corner: string) => (e: React.PointerEvent) => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    isDraggingRef.current = true
    setIsDragging(true)
    freeStartRef.current = { x: e.clientX, y: e.clientY, rect: { ...cropRect }, corner }
  }

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none">
      {/* Затемнение сверху */}
      {topPct > 0.01 && (
        <div
          className="absolute left-0 right-0 top-0 bg-black/60"
          style={{ height: `${topPct}%` }}
        />
      )}

      {/* Затемнение снизу */}
      {bottomPct > 0.01 && (
        <div
          className="absolute left-0 right-0 bottom-0 bg-black/60"
          style={{ height: `${bottomPct}%` }}
        />
      )}

      {/* Затемнение слева */}
      {leftPct > 0.01 && (
        <div
          className="absolute left-0 bg-black/60"
          style={{ top: `${topPct}%`, width: `${leftPct}%`, height: `${cropHeightPct}%` }}
        />
      )}

      {/* Затемнение справа */}
      {rightPct > 0.01 && (
        <div
          className="absolute right-0 bg-black/60"
          style={{ top: `${topPct}%`, width: `${rightPct}%`, height: `${cropHeightPct}%` }}
        />
      )}

      {/* Перетаскиваемая рамка кропа */}
      <div
        className="absolute border-2 border-white/80 shadow-lg touch-none pointer-events-auto"
        style={{
          left: `${leftPct}%`,
          top: `${topPct}%`,
          width: `${cropWidthPct}%`,
          height: `${cropHeightPct}%`,
          cursor: availW > 0.1 || availH > 0.1 ? 'move' : 'default',
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {/* Сетка 3×3 (правило третей) */}
        <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none">
          {[...Array(9)].map((_, i) => (
            <div key={i} className={`border ${gridActive || isDragging ? 'border-white/50' : 'border-white/20'}`} />
          ))}
        </div>

        {/* Угловые маркеры */}
        {(['lt', 'rt', 'lb', 'rb'] as const).map(corner => (
          <button
            key={corner}
            type="button"
            aria-label={`Resize crop ${corner}`}
            className={`absolute size-11 ${corner.includes('l') ? '-left-5' : '-right-5'} ${corner.includes('t') ? '-top-5' : '-bottom-5'} ${aspectRatio === 'free' ? 'pointer-events-auto' : 'pointer-events-none'}`}
            onPointerDown={aspectRatio === 'free' ? handleResizeStart(corner) : undefined}
          >
            <span className={`absolute size-4 ${corner.includes('l') ? 'left-5' : 'right-5'} ${corner.includes('t') ? 'top-5' : 'bottom-5'} ${corner.includes('l') ? 'border-l-2' : 'border-r-2'} ${corner.includes('t') ? 'border-t-2' : 'border-b-2'} border-white`} />
          </button>
        ))}
      </div>
    </div>
  )
}
