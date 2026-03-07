import { useRef, useMemo } from 'react'
import { AspectRatio } from '../engine/transform'

interface CropOverlayProps {
  imageWidth: number
  imageHeight: number
  aspectRatio: AspectRatio
  /** Горизонтальное смещение рамки: 0 = левый край, 0.5 = центр, 1 = правый край */
  offsetX?: number
  /** Вертикальное смещение рамки: 0 = верхний край, 0.5 = центр, 1 = нижний край */
  offsetY?: number
  onOffsetChange?: (offset: { x: number; y: number }) => void
}

export function CropOverlay({
  imageWidth,
  imageHeight,
  aspectRatio,
  offsetX = 0.5,
  offsetY = 0.5,
  onOffsetChange,
}: CropOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef(false)
  const dragStartRef = useRef({ x: 0, y: 0, ox: 0.5, oy: 0.5 })

  // Вычисляем долю (0..1) размеров кропа от всего изображения
  const cropFraction = useMemo(() => {
    if (aspectRatio === 'free') return null

    const ratios: Record<AspectRatio, number> = {
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
  }, [imageWidth, imageHeight, aspectRatio])

  if (aspectRatio === 'free' || !cropFraction) return null

  // Позиция рамки в процентах от контейнера
  const cropWidthPct  = cropFraction.w * 100
  const cropHeightPct = cropFraction.h * 100
  const availW = 100 - cropWidthPct   // % от контейнера
  const availH = 100 - cropHeightPct

  const leftPct   = availW * offsetX
  const topPct    = availH * offsetY
  const rightPct  = 100 - leftPct - cropWidthPct
  const bottomPct = 100 - topPct - cropHeightPct

  const handlePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    isDraggingRef.current = true
    dragStartRef.current = { x: e.clientX, y: e.clientY, ox: offsetX, oy: offsetY }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current || !onOffsetChange) return
    const container = containerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    const availPxW = rect.width  * (availW / 100)
    const availPxH = rect.height * (availH / 100)

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
            <div key={i} className="border border-white/20" />
          ))}
        </div>

        {/* Угловые маркеры */}
        <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-white pointer-events-none" />
        <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-white pointer-events-none" />
        <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-white pointer-events-none" />
        <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-white pointer-events-none" />
      </div>
    </div>
  )
}
