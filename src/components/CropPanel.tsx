import { Check } from 'lucide-react'
import { Button } from './ui/button'
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group'
import { AspectRatio } from '../engine/transform'
import { CROP_RATIO_ORDER_MOBILE, cropRatioPanelItems } from '../constants/cropRatios'

interface CropPanelProps {
  cropRatio: AspectRatio
  onCropRatioChange: (ratio: AspectRatio) => void
  onApply: () => void
  onCancel: () => void
}

const MOBILE_CROP_RATIOS = cropRatioPanelItems(CROP_RATIO_ORDER_MOBILE)

export function CropPanel({ 
  cropRatio, 
  onCropRatioChange, 
  onApply, 
  onCancel 
}: CropPanelProps) {
  return (
    <div className="flex flex-col bg-black safe-area-inset">
      {/* Content */}
      <div className="px-4 py-4">
        <label className="text-sm text-zinc-300 block mb-2">
          Aspect Ratio
        </label>
        <ToggleGroup 
          type="single" 
          value={cropRatio}
          onValueChange={(v) => v && onCropRatioChange(v as AspectRatio)}
          className="w-full justify-start"
        >
          {MOBILE_CROP_RATIOS.map((ratio) => (
            <ToggleGroupItem
              key={ratio.value}
              value={ratio.value}
              aria-label={ratio.label}
              className="flex-1 text-xs"
            >
              {ratio.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
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
