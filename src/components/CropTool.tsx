import { useState } from 'react'
import { Check, X } from 'lucide-react'
import { Button } from './ui/button'
import { AspectRatio } from '../engine/transform'

interface CropToolProps {
  onApply: (aspectRatio: AspectRatio) => void
  onCancel: () => void
}

export function CropTool({ onApply, onCancel }: CropToolProps) {
  const [selectedRatio, setSelectedRatio] = useState<AspectRatio>('free')

  const ratios: { value: AspectRatio; label: string }[] = [
    { value: '1:1', label: '1:1' },
    { value: '4:3', label: '4:3' },
    { value: '3:4', label: '3:4' },
    { value: '16:9', label: '16:9' },
    { value: '9:16', label: '9:16' },
    { value: 'free', label: 'Free' },
  ]

  return (
    <div className="absolute top-0 left-0 right-0 bg-background/95 border-b border-border p-4">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium mr-2">Соотношение сторон:</span>
          {ratios.map((ratio) => (
            <Button
              key={ratio.value}
              variant={selectedRatio === ratio.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedRatio(ratio.value)}
            >
              {ratio.label}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            className="gap-2"
          >
            <X className="w-4 h-4" />
            Отмена
          </Button>
          <Button
            size="sm"
            onClick={() => onApply(selectedRatio)}
            className="gap-2"
          >
            <Check className="w-4 h-4" />
            Применить
          </Button>
        </div>
      </div>
    </div>
  )
}

