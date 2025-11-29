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

/** Available crop aspect ratios with labels */
const CROP_RATIOS: { value: AspectRatio; label: string; ariaLabel: string }[] = [
  { value: '1:1', label: '1:1', ariaLabel: 'Квадрат 1 к 1' },
  { value: '4:3', label: '4:3', ariaLabel: '4 к 3 горизонтальный' },
  { value: '3:4', label: '3:4', ariaLabel: '3 к 4 вертикальный' },
  { value: '16:9', label: '16:9', ariaLabel: '16 к 9 широкий' },
  { value: '9:16', label: '9:16', ariaLabel: '9 к 16 высокий' },
  { value: 'free', label: 'Отмена', ariaLabel: 'Отменить обрезку' },
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
      <div 
        className="flex items-center justify-center gap-2 flex-wrap"
        role="toolbar"
        aria-label="Выбор соотношения сторон для обрезки"
      >
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
            aria-label={ratio.ariaLabel}
            aria-pressed={cropRatio === ratio.value}
          >
            {ratio.label}
          </Button>
        ))}
        <Button
          size="sm"
          onClick={onCropApply}
          className="gap-2 ml-2"
          disabled={cropRatio === 'free'}
          aria-label="Применить обрезку"
        >
          <Check className="w-4 h-4" aria-hidden="true" />
          Применить
        </Button>
      </div>
    )
  }

  // Обычный режим - все по центру
  return (
    <div 
      className="flex items-center justify-center gap-3"
      role="toolbar"
      aria-label="Инструменты редактирования"
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={onReset}
        disabled={!canReset}
        className="text-zinc-500 hover:text-zinc-300 disabled:opacity-30"
        aria-label="Сбросить все изменения"
      >
        <Reset className="w-4 h-4 mr-1.5" aria-hidden="true" />
        Сбросить
      </Button>

      <ButtonGroup role="group" aria-label="Инструменты поворота и обрезки">
        <Button
          variant="outline"
          size="icon"
          onClick={onRotateCounterClockwise}
          aria-label="Повернуть против часовой стрелки (Shift+R)"
        >
          <RotateCcw className="w-4 h-4" aria-hidden="true" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={onRotateClockwise}
          aria-label="Повернуть по часовой стрелке (R)"
        >
          <RotateCw className="w-4 h-4" aria-hidden="true" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={onCropClick}
          aria-label="Обрезать изображение (C)"
        >
          <Crop className="w-4 h-4" aria-hidden="true" />
        </Button>
      </ButtonGroup>
      
      <Button
        size="sm"
        onClick={onExport}
        disabled={!canExport || isExporting}
        className="gap-2"
        aria-label={isExporting ? 'Экспорт в процессе' : 'Скачать обработанное изображение (Ctrl+S)'}
        aria-busy={isExporting}
      >
        <Download className="w-4 h-4" aria-hidden="true" />
        {isExporting ? 'Экспорт...' : 'Скачать'}
      </Button>
    </div>
  )
}
