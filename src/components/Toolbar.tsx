import { RotateCw, RotateCcw, Crop, Check, Share, Settings2, Film, HelpCircle, Layers, Archive, FlipHorizontal2 } from 'lucide-react'
import { Spinner } from './ui/spinner'
import { Button } from './ui/button'
import { ButtonGroup } from './ui/button-group'
import { AspectRatio } from '../engine/transform'
import { Recipe } from '../engine/types'
import { CROP_RATIO_ORDER_DESKTOP, cropRatioToolbarItems, DEFAULT_CROP_RATIO_DESKTOP } from '../constants/cropRatios'

interface ToolbarProps {
  onRotateClockwise: () => void
  onRotateCounterClockwise: () => void
  onCropClick: () => void
  onFlipHorizontal?: () => void
  onExport: () => void
  canExport: boolean
  isExporting?: boolean
  onExportAll?: () => void
  canExportAll?: boolean
  isBatchExporting?: boolean
  // Crop mode
  cropMode?: boolean
  cropRatio?: AspectRatio
  onCropRatioChange?: (ratio: AspectRatio) => void
  onCropApply?: () => void
  onCropCancel?: () => void
  // Recipe & tuning
  activeRecipe?: Recipe | null
  tuningMode?: boolean
  onTuningOpen?: () => void
  // Multi-image mode
  totalImages?: number
  onApplyToAll?: () => void
  // Help
  onHelpClick?: () => void
  // Mobile modes
  mobileMode?: boolean  // Show only tools without download
  downloadOnly?: boolean // Show only download button
}

const DESKTOP_CROP_RATIOS = cropRatioToolbarItems(CROP_RATIO_ORDER_DESKTOP)

export function Toolbar({
  onRotateClockwise,
  onRotateCounterClockwise,
  onCropClick,
  onFlipHorizontal,
  onExport,
  canExport,
  isExporting = false,
  onExportAll,
  canExportAll = false,
  isBatchExporting = false,
  cropMode = false,
  cropRatio = DEFAULT_CROP_RATIO_DESKTOP,
  onCropRatioChange,
  onCropApply,
  onCropCancel,
  activeRecipe,
  tuningMode = false,
  onTuningOpen,
  totalImages = 1,
  onApplyToAll,
  onHelpClick,
  mobileMode = false,
  downloadOnly = false
}: ToolbarProps) {

  // ═══════════════════════════════════════════════════════════════════════════
  // CROP MODE
  // ═══════════════════════════════════════════════════════════════════════════
  if (cropMode) {
    return (
      <div 
        className="flex items-center justify-center gap-3"
        role="toolbar"
        aria-label="Crop aspect ratio selection"
      >
        {/* Grouped crop ratios */}
        <ButtonGroup role="group" aria-label="Aspect ratios">
          {DESKTOP_CROP_RATIOS.map((ratio) => (
            <Button
              key={ratio.value}
              variant={cropRatio === ratio.value ? 'default' : 'outline'}
              size="default"
              onClick={() => onCropRatioChange?.(ratio.value)}
              aria-label={ratio.ariaLabel}
              aria-pressed={cropRatio === ratio.value}
            >
              {ratio.label}
            </Button>
          ))}
        </ButtonGroup>

        {/* Action buttons */}
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="default"
            onClick={onCropApply}
            aria-label="Apply crop"
          >
            <Check className="w-4 h-4" aria-hidden="true" />
            Apply
          </Button>
          <Button
            variant="outline"
            size="default"
            onClick={onCropCancel}
            aria-label="Cancel crop"
          >
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DOWNLOAD ONLY MODE (mobile)
  // ═══════════════════════════════════════════════════════════════════════════
  if (downloadOnly) {
    return (
      <Button
        variant="default"
        size="default"
        onClick={onExport}
        disabled={!canExport || isExporting || isBatchExporting}
        aria-label={isExporting ? 'Exporting...' : 'Export processed image'}
        aria-busy={isExporting}
        className="w-full"
      >
        {isExporting ? (
          <Spinner className="size-4" randomColor />
        ) : (
          <Share className="w-4 h-4" aria-hidden="true" />
        )}
        {isExporting ? 'Exporting...' : 'Export'}
      </Button>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MOBILE MODE (tools without download)
  // Order: Help → Rotate/Crop → Preset settings
  // ═══════════════════════════════════════════════════════════════════════════
  if (mobileMode) {
    return (
      <div 
        className="flex items-center justify-between gap-2 w-full"
        role="toolbar"
        aria-label="Editing tools"
      >
        {/* Help button */}
        {onHelpClick && (
          <Button
            variant="outline"
            size="icon"
            onClick={onHelpClick}
            aria-label="Help"
            className="flex-shrink-0"
          >
            <HelpCircle className="w-4 h-4" aria-hidden="true" />
          </Button>
        )}

        {/* Transform tools */}
        <ButtonGroup role="group" aria-label="Transform tools" className="flex-shrink-0">
          <Button
            variant="outline"
            size="icon"
            onClick={onRotateCounterClockwise}
            aria-label="Rotate counter-clockwise"
          >
            <RotateCcw className="w-4 h-4" aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={onRotateClockwise}
            aria-label="Rotate clockwise"
          >
            <RotateCw className="w-4 h-4" aria-hidden="true" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={onCropClick}
            aria-label="Crop image"
          >
            <Crop className="w-4 h-4" aria-hidden="true" />
          </Button>
          {onFlipHorizontal && (
            <Button
              variant="outline"
              size="icon"
              onClick={onFlipHorizontal}
              aria-label="Flip horizontally"
            >
              <FlipHorizontal2 className="w-4 h-4" aria-hidden="true" />
            </Button>
          )}
        </ButtonGroup>

        {/* Recipe chip — toggle tuning panel */}
        {activeRecipe ? (
          <Button
            variant="outline"
            size="default"
            onClick={onTuningOpen}
            aria-label={`Tune ${activeRecipe.name}`}
            aria-pressed={tuningMode}
            className="text-xs min-w-0 flex-1"
          >
            <Film className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            <span className="truncate">
              {activeRecipe.name}
            </span>
            <Settings2 className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
          </Button>
        ) : (
          <Button
            variant="outline"
            size="default"
            disabled
            className="text-xs flex-1"
          >
            <Film className="w-4 h-4" aria-hidden="true" />
            <span>Select preset</span>
          </Button>
        )}
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DESKTOP MODE (full toolbar)
  // Order: Help → Rotate/Crop → Preset settings → Export
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div 
      className="flex items-center justify-center gap-3"
      role="toolbar"
      aria-label="Editing tools"
    >
      {/* Help button */}
      {onHelpClick && (
        <Button
          variant="outline"
          size="icon"
          onClick={onHelpClick}
          aria-label="Help"
        >
          <HelpCircle className="w-4 h-4" aria-hidden="true" />
        </Button>
      )}

      {/* Transform tools */}
      <ButtonGroup role="group" aria-label="Transform tools">
        <Button
          variant="outline"
          size="icon"
          onClick={onRotateCounterClockwise}
          aria-label="Rotate counter-clockwise (Shift+R)"
        >
          <RotateCcw className="w-4 h-4" aria-hidden="true" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={onRotateClockwise}
          aria-label="Rotate clockwise (R)"
        >
          <RotateCw className="w-4 h-4" aria-hidden="true" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={onCropClick}
          aria-label="Crop image (C)"
        >
          <Crop className="w-4 h-4" aria-hidden="true" />
        </Button>
      </ButtonGroup>

      {/* Recipe chip — toggle tuning panel */}
      {activeRecipe ? (
        <Button
          variant="outline"
          size="default"
          onClick={onTuningOpen}
          aria-label={`Tune ${activeRecipe.name}`}
          aria-pressed={tuningMode}
        >
          <Film className="w-4 h-4" aria-hidden="true" />
          <span className="max-w-32 truncate">
            {activeRecipe.name}
          </span>
          <Settings2 className="w-4 h-4" aria-hidden="true" />
        </Button>
      ) : (
        <Button
          variant="outline"
          size="default"
          disabled
        >
          <Film className="w-4 h-4" aria-hidden="true" />
          Select preset
        </Button>
      )}

      {/* Apply to all button (multi-image mode) */}
      {totalImages > 1 && activeRecipe && onApplyToAll && (
        <Button
          variant="outline"
          size="default"
          onClick={onApplyToAll}
          aria-label={`Apply current preset to all ${totalImages} images`}
        >
          <Layers className="w-4 h-4" aria-hidden="true" />
          Apply to all
        </Button>
      )}

      {/* Export */}
      {totalImages > 1 && onExportAll && (
        <Button
          variant="outline"
          size="default"
          onClick={onExportAll}
          disabled={!canExportAll || isBatchExporting || isExporting}
          aria-label="Export all photos"
          aria-busy={isBatchExporting}
        >
          {isBatchExporting ? <Spinner className="size-4" /> : <Archive className="w-4 h-4" aria-hidden="true" />}
          {isBatchExporting ? 'Exporting all...' : 'Export all'}
        </Button>
      )}

      <Button
        variant="default"
        size="default"
        onClick={onExport}
        disabled={!canExport || isExporting || isBatchExporting}
        aria-label={isExporting ? 'Exporting...' : 'Export processed image (Ctrl+S)'}
        aria-busy={isExporting}
      >
        {isExporting ? (
          <Spinner className="size-4" randomColor />
        ) : (
          <Share className="w-4 h-4" aria-hidden="true" />
        )}
        {isExporting ? 'Exporting...' : 'Export'}
      </Button>
    </div>
  )
}
