import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check } from 'lucide-react'
import { Button } from './ui/button'
import { Slider } from './ui/slider'
import { AspectRatio } from '../engine/transform'
import { CROP_RATIO_ORDER_MOBILE, cropRatioPanelItems } from '../constants/cropRatios'

interface CropPanelProps {
  cropRatio: AspectRatio
  onCropRatioChange: (ratio: AspectRatio) => void
  fineAngle: number
  cropScale: number
  onFineAngleChange: (angle: number) => void
  onCropScaleChange: (scale: number) => void
  onInteractionChange: (active: boolean) => void
  onApply: () => void
  onCancel: () => void
  showActions?: boolean
}

const MOBILE_CROP_RATIOS = cropRatioPanelItems(CROP_RATIO_ORDER_MOBILE)
const SLIDER_KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown']

export function CropPanel({
  cropRatio,
  onCropRatioChange,
  fineAngle,
  cropScale,
  onFineAngleChange,
  onCropScaleChange,
  onInteractionChange,
  onApply,
  onCancel,
  showActions = true,
}: CropPanelProps) {
  const [isRatioOpen, setIsRatioOpen] = useState(false)
  const [isChangingAngle, setIsChangingAngle] = useState(false)
  const ratioControlRef = useRef<HTMLDivElement>(null)
  const ratioButtonRef = useRef<HTMLButtonElement>(null)
  const ratioPopupRef = useRef<HTMLDivElement>(null)
  const [ratioPosition, setRatioPosition] = useState({ top: 8, left: 8, maxHeight: 320 })

  useLayoutEffect(() => {
    if (!isRatioOpen) return
    const position = () => {
      const anchor = ratioButtonRef.current?.getBoundingClientRect()
      if (!anchor) return
      const height = Math.min(320, window.innerHeight - 16)
      const above = anchor.top - height - 8
      const top = above >= 8 ? above : Math.min(anchor.bottom + 8, window.innerHeight - height - 8)
      setRatioPosition({ top: Math.max(8, top), left: Math.max(8, Math.min(anchor.left, window.innerWidth - 184)), maxHeight: height })
    }
    position()
    window.addEventListener('resize', position)
    document.addEventListener('scroll', position, true)
    return () => { window.removeEventListener('resize', position); document.removeEventListener('scroll', position, true) }
  }, [isRatioOpen])
  const ratioListId = useId()
  const ratioLabel = MOBILE_CROP_RATIOS.find(ratio => ratio.value === cropRatio)?.label ?? cropRatio

  useEffect(() => {
    if (!isRatioOpen) return
    ratioPopupRef.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')?.focus()
    const dismissOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !ratioControlRef.current?.contains(event.target) && !ratioPopupRef.current?.contains(event.target)) setIsRatioOpen(false)
    }
    document.addEventListener('pointerdown', dismissOutside)
    return () => document.removeEventListener('pointerdown', dismissOutside)
  }, [isRatioOpen])

  useEffect(() => () => onInteractionChange(false), [onInteractionChange])

  const endAngleChange = () => {
    setIsChangingAngle(false)
    onInteractionChange(false)
  }

  return (
    <div
      className="flex flex-col bg-transparent md:bg-black"
      onKeyDown={event => {
        // Let focused buttons activate without triggering the editor's Enter shortcut.
        if ((event.key === 'Enter' || event.key === ' ') && event.target instanceof Element && event.target.closest('button')) event.stopPropagation()
      }}
    >
      <div className="flex min-h-28 flex-col gap-2 px-3 py-2 md:px-4 md:py-4">
        <div className="flex min-h-11 items-center gap-3">
          <div
            ref={ratioControlRef}
            className="relative shrink-0"
            onBlur={event => {
              if (!event.currentTarget.contains(event.relatedTarget) && !ratioPopupRef.current?.contains(event.relatedTarget)) setIsRatioOpen(false)
            }}
            onKeyDown={event => {
              if (event.key === 'Escape' && isRatioOpen) {
                event.preventDefault()
                event.stopPropagation()
                setIsRatioOpen(false)
                ratioButtonRef.current?.focus()
              }
            }}
          >
            <Button
              ref={ratioButtonRef}
              autoFocus={!showActions}
              variant="outline"
              size="sm"
              onClick={() => !isChangingAngle && setIsRatioOpen(open => !open)}
              className="mobile-glass-control relative min-h-11 w-20 rounded-xl border-white/10 bg-white/5 px-2 text-xs text-white/80 tabular-nums md:rounded-md"
              aria-label="Choose crop ratio"
              aria-expanded={isRatioOpen}
              aria-controls={isRatioOpen ? ratioListId : undefined}
            >
              <span className={`transition-opacity duration-150 motion-reduce:transition-none ${isChangingAngle ? 'opacity-0' : 'opacity-100'}`}>{ratioLabel}</span>
              <span aria-hidden="true" className={`absolute transition-opacity duration-150 motion-reduce:transition-none ${isChangingAngle ? 'opacity-100' : 'opacity-0'}`}>{fineAngle.toFixed(1)}°</span>
            </Button>
            {isRatioOpen && createPortal(
              <div ref={ratioPopupRef} id={ratioListId} style={ratioPosition} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget) && !ratioControlRef.current?.contains(event.relatedTarget)) setIsRatioOpen(false) }} className="fixed z-[250] grid w-44 grid-cols-2 gap-1 overflow-y-auto rounded-xl border border-white/15 bg-zinc-900 p-2 shadow-xl" role="group" aria-label="Crop ratios">
                {MOBILE_CROP_RATIOS.map(ratio => (
                  <Button
                    key={ratio.value}
                    variant={cropRatio === ratio.value ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => {
                      onCropRatioChange(ratio.value as AspectRatio)
                      setIsRatioOpen(false)
                      ratioButtonRef.current?.focus()
                    }}
                    className="min-h-11 text-xs"
                    aria-pressed={cropRatio === ratio.value}
                  >
                    {ratio.label}
                  </Button>
                ))}
              </div>, document.body
            )}
          </div>
          <div className="relative min-w-0 flex-1">
            <div
              className="pointer-events-none absolute inset-x-0 top-1/2 hidden h-3 -translate-y-1/2 opacity-30 md:block"
              style={{ backgroundImage: 'repeating-linear-gradient(to right, transparent 0, transparent calc(100% / 90 - 1px), #a1a1aa calc(100% / 90 - 1px), #a1a1aa calc(100% / 90))' }}
              aria-hidden="true"
            />
            <Slider
              value={[fineAngle]}
              min={-45}
              max={45}
              step={0.1}
              onValueChange={values => {
                setIsChangingAngle(true)
                onInteractionChange(true)
                onFineAngleChange(values[0])
              }}
              onPointerDown={() => { setIsChangingAngle(true); onInteractionChange(true) }}
              onPointerUp={endAngleChange}
              onPointerCancel={endAngleChange}
              onKeyDown={event => {
                if (SLIDER_KEYS.includes(event.key)) { setIsChangingAngle(true); onInteractionChange(true) }
              }}
              onKeyUp={endAngleChange}
              onBlur={endAngleChange}
              className="mobile-editor-ruler min-h-11"
              aria-label="Crop angle"
              aria-valuetext={`${fineAngle.toFixed(1)} degrees`}
            />
          </div>
          <Button variant="ghost" size="sm" onClick={() => onFineAngleChange(0)} className="mobile-glass-control min-h-11 min-w-12 shrink-0 rounded-xl px-2 text-white/80 md:rounded-md" aria-label="Reset crop angle">Reset</Button>
        </div>
        <div className="flex min-h-11 items-center gap-3">
          <span className="w-20 shrink-0 text-center text-xs text-white/70">Zoom</span>
          <Slider
            value={[cropScale]}
            min={1}
            max={3}
            step={0.01}
            onValueChange={values => {
              onInteractionChange(true)
              onCropScaleChange(values[0])
            }}
            onPointerDown={() => onInteractionChange(true)}
            onPointerUp={() => onInteractionChange(false)}
            onPointerCancel={() => onInteractionChange(false)}
            onKeyDown={event => { if (SLIDER_KEYS.includes(event.key)) onInteractionChange(true) }}
            onKeyUp={() => onInteractionChange(false)}
            onBlur={() => onInteractionChange(false)}
            className="min-h-11 min-w-0 flex-1"
            aria-label="Crop zoom"
            aria-valuetext={`${cropScale.toFixed(2)} times`}
          />
          <span className="w-12 shrink-0 text-center text-xs text-white/70 tabular-nums" aria-hidden="true">{cropScale.toFixed(2)}×</span>
        </div>
      </div>
      {showActions && (
        <div className="flex shrink-0 gap-2 border-t border-zinc-800 bg-black px-4 py-4 pb-6">
          <Button variant="outline" onClick={onApply} className="flex-1"><Check className="size-4" aria-hidden="true" />Apply</Button>
          <Button variant="outline" onClick={onCancel} className="flex-1">Cancel</Button>
        </div>
      )}
    </div>
  )
}
