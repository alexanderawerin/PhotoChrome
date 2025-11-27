import { RotateCw, RotateCcw, Crop } from 'lucide-react'
import { Button } from './ui/button'

interface ToolbarProps {
  onRotateClockwise: () => void
  onRotateCounterClockwise: () => void
  onCropClick: () => void
}

export function Toolbar({
  onRotateClockwise,
  onRotateCounterClockwise,
  onCropClick
}: ToolbarProps) {
  return (
    <div className="border-t border-border bg-background">
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onRotateCounterClockwise}
            className="gap-2"
          >
            <RotateCcw className="w-4 h-4" />
            Повернуть влево
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onRotateClockwise}
            className="gap-2"
          >
            <RotateCw className="w-4 h-4" />
            Повернуть вправо
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onCropClick}
            className="gap-2"
          >
            <Crop className="w-4 h-4" />
            Обрезать
          </Button>
        </div>
      </div>
    </div>
  )
}

