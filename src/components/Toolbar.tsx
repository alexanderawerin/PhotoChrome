import { RotateCw, RotateCcw, Crop, Check, Download, RotateCcw as Reset } from 'lucide-react'
import { Button } from './ui/button'
import { ButtonGroup } from './ui/button-group'
import { AspectRatio } from '../engine/transform'

interface ToolbarProps {
  onRotateClockwise: () => void
  onRotateCounterClockwise: () => void
  onCropClick: () => void
  onExport: () => void
  onReset: () => void
  canExport: boolean
  canReset: boolean
  isExporting?: boolean
  cropMode?: boolean
  cropRatio?: AspectRatio
  onCropRatioChange?: (ratio: AspectRatio) => void
  onCropApply?: () => void
  onCropCancel?: () => void
}

const CROP_RATIOS: { value: AspectRatio; label: string }[] = [
  { value: '1:1', label: '1:1' },
  { value: '4:3', label: '4:3' },
  { value: '3:4', label: '3:4' },
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: 'free', label: 'Отмена' },
]

export function Toolbar({
  onRotateClockwise,
  onRotateCounterClockwise,
  onCropClick,
  onExport,
  onReset,
  canExport,
  canReset,
  isExporting = false,
  cropMode = false,
  cropRatio = '1:1',
  onCropRatioChange,
  onCropApply,
  onCropCancel
}: ToolbarProps) {
  // Режим кропа
  if (cropMode) {
    return (
      <div className="flex items-center justify-center gap-2 flex-wrap">
        {CROP_RATIOS.map((ratio) => (
          <Button
            key={ratio.value}
            variant={cropRatio === ratio.value ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              if (ratio.value === 'free') {
                onCropCancel?.()
              } else {
                onCropRatioChange?.(ratio.value)
              }
            }}
            className={ratio.value === 'free' ? 'text-zinc-400' : ''}
          >
            {ratio.label}
          </Button>
        ))}
        <Button
          size="sm"
          onClick={onCropApply}
          className="gap-2 ml-2"
          disabled={cropRatio === 'free'}
        >
          <Check className="w-4 h-4" />
          Применить
        </Button>
      </div>
    )
  }

  // Обычный режим - все по центру
  return (
    <div className="flex items-center justify-center gap-3">
      <Button
        variant="ghost"
        size="sm"
        onClick={onReset}
        disabled={!canReset}
        className="text-zinc-500 hover:text-zinc-300 disabled:opacity-30"
        title="Сбросить изменения"
      >
        <Reset className="w-4 h-4 mr-1.5" />
        Сбросить
      </Button>

      <ButtonGroup>
        <Button
          variant="outline"
          size="icon"
          onClick={onRotateCounterClockwise}
          title="Повернуть влево (Shift+R)"
        >
          <RotateCcw className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={onRotateClockwise}
          title="Повернуть вправо (R)"
        >
          <RotateCw className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={onCropClick}
          title="Обрезать (C)"
        >
          <Crop className="w-4 h-4" />
        </Button>
      </ButtonGroup>
      
      <Button
        size="sm"
        onClick={onExport}
        disabled={!canExport || isExporting}
        className="gap-2"
      >
        <Download className="w-4 h-4" />
        {isExporting ? 'Экспорт...' : 'Скачать'}
      </Button>
    </div>
  )
}
