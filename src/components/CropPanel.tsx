import { Check } from 'lucide-react'
import { Button } from './ui/button'
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group'
import { AspectRatio } from '../engine/transform'

interface CropPanelProps {
  cropRatio: AspectRatio
  onCropRatioChange: (ratio: AspectRatio) => void
  onApply: () => void
  onCancel: () => void
}

/** Available crop aspect ratios */
const CROP_RATIOS: { value: AspectRatio; label: string }[] = [
  { value: '1:1', label: '1:1' },
  { value: '4:3', label: '4:3' },
  { value: '3:4', label: '3:4' },
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
]

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
          {CROP_RATIOS.map((ratio) => (
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
