import { RotateCcw } from 'lucide-react'
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group'
import { Slider } from './ui/slider'
import { Recipe, RecipeSettings } from '../engine/types'

interface TuningPanelProps {
  recipe: Recipe
  customSettings: RecipeSettings
  onSettingsChange: (settings: RecipeSettings) => void
}

/** Slider parameter configuration */
interface SliderParam {
  key: keyof RecipeSettings
  label: string
  min: number
  max: number
  step: number
  defaultValue: number
}

const SLIDER_PARAMS: SliderParam[] = [
  { key: 'highlight', label: 'Highlight', min: -2, max: 4, step: 1, defaultValue: 0 },
  { key: 'shadow', label: 'Shadow', min: -2, max: 4, step: 1, defaultValue: 0 },
  { key: 'color', label: 'Color', min: -4, max: 4, step: 1, defaultValue: 0 },
  { key: 'sharpness', label: 'Sharpness', min: -4, max: 4, step: 1, defaultValue: 0 },
  { key: 'clarity', label: 'Clarity', min: -5, max: 5, step: 1, defaultValue: 0 },
  { key: 'wbShiftRed', label: 'WB Shift Red', min: -9, max: 9, step: 1, defaultValue: 0 },
  { key: 'wbShiftBlue', label: 'WB Shift Blue', min: -9, max: 9, step: 1, defaultValue: 0 },
]

/** Dynamic Range options */
type DynamicRangeValue = 'DR100' | 'DR200' | 'DR400'
const DR_OPTIONS: { value: DynamicRangeValue; label: string }[] = [
  { value: 'DR100', label: 'DR100' },
  { value: 'DR200', label: 'DR200' },
  { value: 'DR400', label: 'DR400' },
]

/** White Balance preset options */
type WhiteBalanceValue = 'auto' | 'daylight' | 'shade' | 'cloudy' | 'tungsten' | 'fluorescent'
const WB_OPTIONS: { value: WhiteBalanceValue; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'daylight', label: 'Daylight' },
  { value: 'shade', label: 'Shade' },
  { value: 'cloudy', label: 'Cloudy' },
  { value: 'tungsten', label: 'Tungsten' },
  { value: 'fluorescent', label: 'Fluoresce.' },
]

/** Toggle options */
type ToggleValue = 'off' | 'weak' | 'strong'
const TOGGLE_OPTIONS: { value: ToggleValue; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'weak', label: 'Weak' },
  { value: 'strong', label: 'Strong' },
]

/** Grain size options */
type GrainSizeValue = 'small' | 'large'
const GRAIN_SIZE_OPTIONS: { value: GrainSizeValue; label: string }[] = [
  { value: 'small', label: 'Small' },
  { value: 'large', label: 'Large' },
]

interface ToggleParam {
  key: keyof RecipeSettings
  label: string
}

const TOGGLE_PARAMS: ToggleParam[] = [
  { key: 'grainEffect', label: 'Grain Effect' },
  { key: 'colorChromeEffect', label: 'Color Chrome' },
  { key: 'colorChromeFXBlue', label: 'Color FX Blue' },
]

export function TuningPanel({
  recipe,
  customSettings,
  onSettingsChange
}: TuningPanelProps) {
  const dynamicRange = customSettings.dynamicRange ?? recipe.settings.dynamicRange ?? 'DR100'
  const wbPreset = customSettings.whiteBalance ?? recipe.settings.whiteBalance ?? 'auto'
  const kelvin = customSettings.whiteBalanceKelvin ?? recipe.settings.whiteBalanceKelvin ?? 5500
  // An explicit preset overrides profile Kelvin; explicit Kelvin takes priority.
  const wbMode = customSettings.whiteBalanceKelvin !== undefined ||
    (customSettings.whiteBalance === undefined && recipe.settings.whiteBalanceKelvin !== undefined)
    ? 'kelvin' : 'preset'
  const grainEffect = customSettings.grainEffect ?? recipe.settings.grainEffect ?? 'off'
  const grainSize = customSettings.grainSize ?? recipe.settings.grainSize ?? 'small'

  const handleDRChange = (value: string) => {
    if (value) {
      onSettingsChange({ ...customSettings, dynamicRange: value as DynamicRangeValue })
    }
  }

  const handleWBChange = (value: string) => {
    if (value) {
      onSettingsChange({ ...customSettings, whiteBalance: value as WhiteBalanceValue, whiteBalanceKelvin: undefined })
    }
  }

  const handleWBModeChange = (mode: 'preset' | 'kelvin') => {
    if (mode === 'kelvin') {
      onSettingsChange({ ...customSettings, whiteBalance: undefined, whiteBalanceKelvin: 5500 })
    } else {
      onSettingsChange({ ...customSettings, whiteBalanceKelvin: undefined, whiteBalance: 'auto' })
    }
  }

  const handleKelvinChange = (value: number) => {
    onSettingsChange({ ...customSettings, whiteBalanceKelvin: value, whiteBalance: undefined })
  }

  // Обработчики
  const handleSliderChange = (key: keyof RecipeSettings, value: number) => {
    onSettingsChange({ ...customSettings, [key]: value })
  }

  const handleToggleChange = (key: keyof RecipeSettings, value: string) => {
    if (value) {
      onSettingsChange({ ...customSettings, [key]: value as ToggleValue })
    }
  }

  const handleGrainSizeChange = (value: string) => {
    if (value) {
      onSettingsChange({ ...customSettings, grainSize: value as GrainSizeValue })
    }
  }

  const resetSetting = (key: keyof RecipeSettings) => {
    const next = { ...customSettings }
    delete next[key]
    if (key === 'whiteBalance' || key === 'whiteBalanceKelvin') {
      delete next.whiteBalance
      delete next.whiteBalanceKelvin
    }
    onSettingsChange(next)
  }

  const resetButton = (key: keyof RecipeSettings, label: string) => (
    <button type="button" onClick={() => resetSetting(key)} className="grid size-11 place-items-center md:size-7 rounded text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200" aria-label={`Reset ${label} to profile`}>
      <RotateCcw className="size-3" aria-hidden="true" />
    </button>
  )

  return (
    <div className="editor-tuning-panel">
      {/* Slider params */}
      {SLIDER_PARAMS.map((param) => {
        const value = (customSettings[param.key] ?? recipe.settings[param.key] ?? param.defaultValue) as number
        const sliderId = `slider-${param.key}`
        return (
          <div key={param.key} className="editor-tuning-control">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor={sliderId} className="text-sm text-zinc-300">
                {param.label}
              </label>
              <div className="flex items-center gap-1">
                <span className="w-8 text-right text-sm tabular-nums text-zinc-500" aria-hidden="true">{value > 0 ? `+${value}` : value}</span>
                <button type="button" onClick={() => resetSetting(param.key)} className="grid size-11 place-items-center md:size-7 rounded text-zinc-600 hover:bg-zinc-800 hover:text-zinc-200" aria-label={`Reset ${param.label} to profile`}>
                  <RotateCcw className="size-3" aria-hidden="true" />
                </button>
              </div>
            </div>
            <Slider
              id={sliderId}
              aria-label={param.label}
              value={[value]}
              min={param.min}
              max={param.max}
              step={param.step}
              onValueChange={(values) => handleSliderChange(param.key, values[0])}
              className="editor-tuning-slider h-11 w-full"
              aria-valuetext={`${value > 0 ? '+' : ''}${value}`}
            />
          </div>
        )
      })}

      {/* Toggle params with ToggleGroup */}
      {TOGGLE_PARAMS.map((param) => {
        const value = (customSettings[param.key] ?? recipe.settings[param.key] ?? 'off') as ToggleValue
        const labelId = `toggle-label-${param.key}`
        return (
          <div key={param.key} className="editor-tuning-control">
            <div className="flex items-center justify-between">
              <label id={labelId} className="text-sm text-zinc-300">{param.label}</label>
              {resetButton(param.key, param.label)}
            </div>
            <ToggleGroup
              type="single"
              value={value}
              onValueChange={(v) => handleToggleChange(param.key, v)}
              className="w-full justify-start"
              aria-labelledby={labelId}
            >
              {TOGGLE_OPTIONS.map((option) => (
                <ToggleGroupItem
                  key={option.value}
                  value={option.value}
                  aria-label={option.label}
                  className="min-h-11 flex-1 text-xs md:min-h-9"
                >
                  {option.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        )
      })}

      {/* Grain Size - only shown when grain is not off */}
      {grainEffect !== 'off' && (
        <div className="editor-tuning-control animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <label id="toggle-label-grainSize" className="text-sm text-zinc-300">Grain Size</label>
            {resetButton('grainSize', 'Grain Size')}
          </div>
          <ToggleGroup
            type="single"
            value={grainSize}
            onValueChange={handleGrainSizeChange}
            className="w-full justify-start"
            aria-labelledby="toggle-label-grainSize"
          >
            {GRAIN_SIZE_OPTIONS.map((option) => (
              <ToggleGroupItem
                key={option.value}
                value={option.value}
                aria-label={option.label}
                className="min-h-11 flex-1 text-xs md:min-h-9"
              >
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      )}

      {/* Dynamic Range */}
      <div className="editor-tuning-control">
        <div className="flex items-center justify-between">
          <label id="toggle-label-dynamicRange" className="text-sm text-zinc-300">Dynamic Range</label>
          {resetButton('dynamicRange', 'Dynamic Range')}
        </div>
        <ToggleGroup
          type="single"
          value={dynamicRange}
          onValueChange={handleDRChange}
          className="w-full justify-start"
          aria-labelledby="toggle-label-dynamicRange"
        >
          {DR_OPTIONS.map((option) => (
            <ToggleGroupItem
              key={option.value}
              value={option.value}
              aria-label={option.label}
              className="min-h-11 flex-1 text-xs md:min-h-9"
            >
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      {/* White Balance */}
      <div className="editor-tuning-control editor-tuning-white-balance">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1 text-sm text-zinc-300">White Balance{resetButton('whiteBalance', 'White Balance')}</span>
          <div className="flex rounded-md overflow-hidden border border-zinc-700">
            <button
              onClick={() => handleWBModeChange('preset')}
              className={`min-h-11 min-w-11 px-2 py-1 text-xs transition-colors md:min-h-8 ${
                wbMode === 'preset'
                  ? 'bg-zinc-600 text-white'
                  : 'bg-transparent text-zinc-500 hover:text-zinc-300'
              }`}
              aria-pressed={wbMode === 'preset'}
              aria-label="White Balance Preset mode"
            >
              Preset
            </button>
            <button
              onClick={() => handleWBModeChange('kelvin')}
              className={`min-h-11 min-w-11 px-2 py-1 text-xs transition-colors md:min-h-8 ${
                wbMode === 'kelvin'
                  ? 'bg-zinc-600 text-white'
                  : 'bg-transparent text-zinc-500 hover:text-zinc-300'
              }`}
              aria-pressed={wbMode === 'kelvin'}
              aria-label="White Balance Kelvin mode"
            >
              Kelvin
            </button>
          </div>
        </div>

        {wbMode === 'preset' ? (
          <ToggleGroup
            type="single"
            value={wbPreset}
            onValueChange={handleWBChange}
            className="editor-tuning-wb-presets grid grid-cols-2 gap-1"
            aria-label="White Balance preset"
          >
            {WB_OPTIONS.map((option) => (
              <ToggleGroupItem
                key={option.value}
                value={option.value}
                aria-label={option.label}
                className="min-h-11 text-xs w-full md:min-h-9"
              >
                {option.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : (
          <div className="editor-tuning-temperature">
            <div className="flex items-center justify-between">
              <label htmlFor="slider-kelvin" className="text-sm text-zinc-500">Temperature</label>
              <span className="flex items-center gap-1 text-sm text-zinc-500 tabular-nums">
                <span aria-hidden="true">{kelvin}K</span>
                {resetButton('whiteBalanceKelvin', 'Temperature')}
              </span>
            </div>
            <Slider
              id="slider-kelvin"
              value={[kelvin]}
              min={2500}
              max={10000}
              step={100}
              onValueChange={(values) => handleKelvinChange(values[0])}
              className="editor-tuning-slider h-11 w-full"
              aria-label={`White balance ${kelvin} Kelvin`}
            />
          </div>
        )}
      </div>
    </div>
  )
}
