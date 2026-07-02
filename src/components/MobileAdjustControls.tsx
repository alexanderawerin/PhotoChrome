import {
  Aperture,
  CircleDot,
  Contrast,
  Droplets,
  Focus,
  Gauge,
  Waves,
  Palette,
  Sparkles,
  Sun,
  Thermometer,
  WandSparkles,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { AdjustSession, AdjustTool } from '../engine/editor-sessions'
import type { Recipe, RecipeSettings } from '../engine/types'
import { Button } from './ui/button'
import { Slider } from './ui/slider'
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group'

interface SliderConfig {
  kind: 'slider'
  min: number
  max: number
  step: number
  fallback: number
}

interface ChoiceConfig {
  kind: 'choice'
  options: ReadonlyArray<{ value: string; label: string }>
  fallback: string
}

type ToolConfig = {
  key: AdjustTool
  label: string
  icon: LucideIcon
} & (SliderConfig | ChoiceConfig)

const STRENGTH_OPTIONS = [
  { value: 'off', label: 'Off' },
  { value: 'weak', label: 'Weak' },
  { value: 'strong', label: 'Strong' },
] as const

const MOBILE_ADJUST_TOOLS: ToolConfig[] = [
  { key: 'highlight', label: 'Highlight', icon: Sun, kind: 'slider', min: -2, max: 4, step: 1, fallback: 0 },
  { key: 'shadow', label: 'Shadow', icon: Contrast, kind: 'slider', min: -2, max: 4, step: 1, fallback: 0 },
  { key: 'color', label: 'Color', icon: Palette, kind: 'slider', min: -4, max: 4, step: 1, fallback: 0 },
  { key: 'sharpness', label: 'Sharpness', icon: Focus, kind: 'slider', min: -4, max: 4, step: 1, fallback: 0 },
  { key: 'clarity', label: 'Clarity', icon: Aperture, kind: 'slider', min: -5, max: 5, step: 1, fallback: 0 },
  { key: 'wbShiftRed', label: 'WB Shift Red', icon: CircleDot, kind: 'slider', min: -9, max: 9, step: 1, fallback: 0 },
  { key: 'wbShiftBlue', label: 'WB Shift Blue', icon: CircleDot, kind: 'slider', min: -9, max: 9, step: 1, fallback: 0 },
  { key: 'grainEffect', label: 'Grain Effect', icon: Waves, kind: 'choice', options: STRENGTH_OPTIONS, fallback: 'off' },
  { key: 'grainSize', label: 'Grain Size', icon: Gauge, kind: 'choice', options: [{ value: 'small', label: 'Small' }, { value: 'large', label: 'Large' }], fallback: 'small' },
  { key: 'colorChromeEffect', label: 'Color Chrome', icon: Sparkles, kind: 'choice', options: STRENGTH_OPTIONS, fallback: 'off' },
  { key: 'colorChromeFXBlue', label: 'Color FX Blue', icon: Droplets, kind: 'choice', options: STRENGTH_OPTIONS, fallback: 'off' },
  { key: 'dynamicRange', label: 'Dynamic Range', icon: WandSparkles, kind: 'choice', options: [{ value: 'DR100', label: 'DR100' }, { value: 'DR200', label: 'DR200' }, { value: 'DR400', label: 'DR400' }], fallback: 'DR100' },
  { key: 'whiteBalance', label: 'White Balance', icon: Sun, kind: 'choice', options: [{ value: 'auto', label: 'Auto' }, { value: 'daylight', label: 'Daylight' }, { value: 'shade', label: 'Shade' }, { value: 'cloudy', label: 'Cloudy' }, { value: 'tungsten', label: 'Tungsten' }, { value: 'fluorescent', label: 'Fluorescent' }], fallback: 'auto' },
  { key: 'whiteBalanceKelvin', label: 'Temperature', icon: Thermometer, kind: 'slider', min: 2500, max: 10000, step: 100, fallback: 5500 },
]

interface MobileAdjustControlsProps {
  recipe: Recipe | null
  settings: RecipeSettings
  session: AdjustSession | null
  onOpen: (tool: AdjustTool) => void
  onChange: (value: RecipeSettings[AdjustTool]) => void
  onReset: () => void
}

export function MobileAdjustControls({
  recipe,
  settings,
  session,
  onOpen,
  onChange,
  onReset,
}: MobileAdjustControlsProps) {
  if (!recipe) {
    return (
      <div className="flex h-28 items-center justify-center border-t border-zinc-800 bg-black px-4 text-center text-sm text-zinc-500">
        Choose a preset before adjusting it.
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex h-28 gap-2 overflow-x-auto border-t border-zinc-800 bg-black p-3 scrollbar-hide" aria-label="Adjust tools">
        {MOBILE_ADJUST_TOOLS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => onOpen(key)}
            className="flex min-h-20 w-20 flex-shrink-0 flex-col items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-2 text-zinc-300"
            aria-label={`Adjust ${label}`}
          >
            <Icon className="size-5" aria-hidden="true" />
            <span className="text-center text-[10px] leading-tight">{label}</span>
          </button>
        ))}
      </div>
    )
  }

  const config = MOBILE_ADJUST_TOOLS.find(tool => tool.key === session.tool)
  if (!config) return null
  const Icon = config.icon
  const value = session.draft[config.key] ?? settings[config.key] ?? recipe.settings[config.key] ?? config.fallback

  return (
    <div className="flex h-28 items-center gap-3 border-t border-zinc-800 bg-black px-3" aria-label={`${config.label} controls`}>
      <div className="flex size-11 flex-shrink-0 items-center justify-center rounded-lg border border-zinc-800 text-zinc-300" aria-hidden="true">
        <Icon className="size-5" />
      </div>
      {config.kind === 'slider' ? (
        <Slider
          value={[Number(value)]}
          min={config.min}
          max={config.max}
          step={config.step}
          onValueChange={values => onChange(values[0])}
          aria-label={config.label}
          aria-valuetext={config.key === 'whiteBalanceKelvin' ? `${value} K` : String(value)}
        />
      ) : (
        <ToggleGroup
          type="single"
          value={String(value)}
          onValueChange={next => next && onChange(next as RecipeSettings[AdjustTool])}
          className="min-w-0 flex-1 justify-start overflow-x-auto scrollbar-hide"
          aria-label={config.label}
        >
          {config.options.map(option => (
            <ToggleGroupItem key={option.value} value={option.value} className="min-h-11 flex-shrink-0 px-3">
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}
      {config.kind === 'slider' && (
        <Button variant="ghost" size="sm" onClick={onReset} className="min-h-11 flex-shrink-0 px-2">
          Reset
        </Button>
      )}
    </div>
  )
}
