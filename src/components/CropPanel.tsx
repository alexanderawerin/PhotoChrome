import { useState } from 'react'
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
}

const MOBILE_CROP_RATIOS = cropRatioPanelItems(CROP_RATIO_ORDER_MOBILE)

export function CropPanel({ 
  cropRatio, 
  onCropRatioChange, 
  fineAngle,
  cropScale,
  onFineAngleChange,
  onCropScaleChange,
  onInteractionChange,
  onApply, 
  onCancel 
}: CropPanelProps) {
  const [isRatioOpen, setIsRatioOpen] = useState(false)
  const [isChangingAngle, setIsChangingAngle] = useState(false)
  const ratioLabel = MOBILE_CROP_RATIOS.find(ratio => ratio.value === cropRatio)?.label ?? cropRatio

  return (
    <div className="flex flex-col bg-black safe-area-inset">
      {/* Content */}
      <div className="space-y-4 px-4 py-4">
        <div className="relative flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => !isChangingAngle && setIsRatioOpen(open => !open)}
            className="min-h-11 w-20 flex-shrink-0 px-2 text-xs tabular-nums"
            aria-label="Choose crop ratio"
            aria-expanded={isRatioOpen}
          >
            {isChangingAngle ? `${fineAngle.toFixed(1)}°` : ratioLabel}
          </Button>
          {isRatioOpen && (
            <div className="absolute bottom-12 left-0 z-10 grid w-44 grid-cols-2 gap-1 rounded-xl border border-zinc-700 bg-zinc-900 p-2 shadow-xl" role="menu" aria-label="Crop ratios">
              {MOBILE_CROP_RATIOS.map(ratio => (
                <Button
                  key={ratio.value}
                  variant={cropRatio === ratio.value ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    onCropRatioChange(ratio.value as AspectRatio)
                    setIsRatioOpen(false)
                  }}
                  className="min-h-11 text-xs"
                  role="menuitem"
                >
                  {ratio.label}
                </Button>
              ))}
            </div>
          )}
          <div className="relative flex-1">
            <div
              className="pointer-events-none absolute inset-x-0 top-1/2 h-3 -translate-y-1/2 opacity-30"
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
              onValueCommit={() => {
                setIsChangingAngle(false)
                onInteractionChange(false)
              }}
              aria-label="Crop angle"
              aria-valuetext={`${fineAngle.toFixed(1)} degrees`}
            />
          </div>
          <Button variant="ghost" size="sm" onClick={() => onFineAngleChange(0)} className="min-h-11 px-2">Reset</Button>
        </div>
        <div className="flex items-center gap-3">
          <span className="w-12 text-xs text-zinc-400">Zoom</span>
          <Slider
            value={[cropScale]}
            min={1}
            max={3}
            step={0.01}
            onValueChange={values => {
              onInteractionChange(true)
              onCropScaleChange(values[0])
            }}
            onValueCommit={() => onInteractionChange(false)}
            aria-label="Crop zoom"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 px-4 py-4 pb-6 border-t border-zinc-800 bg-black">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="default"
            onClick={onApply}
            className="flex-1"
          >
            <Check className="w-4 h-4" aria-hidden="true" />
            Apply
          </Button>
          <Button
            variant="outline"
            size="default"
            onClick={onCancel}
            className="flex-1"
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}
