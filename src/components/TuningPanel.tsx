import { Check, RotateCcw } from 'lucide-react'
import { Button } from './ui/button'
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group'
import { Slider } from './ui/slider'
import { Recipe, RecipeSettings } from '../engine/types'

interface TuningPanelProps {
  recipe: Recipe
  customSettings: RecipeSettings
  onSettingsChange: (settings: RecipeSettings) => void
  onApply: () => void
  onCancel: () => void
  showActions?: boolean
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
  onSettingsChange,
  onApply,
  onCancel,
  showActions = true
}: TuningPanelProps) {
  
  // Получаем Dynamic Range
  const getDynamicRange = (): DynamicRangeValue => {
    const customValue = customSettings?.dynamicRange as DynamicRangeValue | undefined
    if (customValue !== undefined) return customValue
    const recipeValue = recipe?.settings?.dynamicRange as DynamicRangeValue | undefined
    if (recipeValue !== undefined) return recipeValue
    return 'DR100'
  }

  const handleDRChange = (value: string) => {
    if (value) {
      onSettingsChange({ ...customSettings, dynamicRange: value as DynamicRangeValue })
    }
  }

  // Получаем пресет баланса белого
  const getWBPreset = (): WhiteBalanceValue => {
    const customValue = customSettings?.whiteBalance as WhiteBalanceValue | undefined
    if (customValue !== undefined) return customValue
    const recipeValue = recipe?.settings?.whiteBalance as WhiteBalanceValue | undefined
    if (recipeValue !== undefined) return recipeValue
    return 'auto'
  }

  const handleWBChange = (value: string) => {
    if (value) {
      onSettingsChange({ ...customSettings, whiteBalance: value as WhiteBalanceValue, whiteBalanceKelvin: undefined })
    }
  }

  const getWBMode = (): 'preset' | 'kelvin' => {
    // customSettings.whiteBalanceKelvin explicitly set → user chose kelvin mode
    if (customSettings?.whiteBalanceKelvin !== undefined) return 'kelvin'
    // customSettings.whiteBalance explicitly set → user chose preset mode (overrides recipe kelvin)
    if (customSettings?.whiteBalance !== undefined) return 'preset'
    // Fall back to recipe's default
    if (recipe?.settings?.whiteBalanceKelvin !== undefined) return 'kelvin'
    return 'preset'
  }

  const getKelvinValue = (): number => {
    if (customSettings?.whiteBalanceKelvin !== undefined) return customSettings.whiteBalanceKelvin
    if (recipe?.settings?.whiteBalanceKelvin !== undefined) return recipe.settings.whiteBalanceKelvin
    return 5500
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

  // Получаем значение слайдера
  const getSliderValue = (key: keyof RecipeSettings): number => {
    const customValue = customSettings?.[key]
    if (customValue !== undefined) return customValue as number
    const recipeValue = recipe?.settings?.[key]
    if (recipeValue !== undefined) return recipeValue as number
    return SLIDER_PARAMS.find(p => p.key === key)?.defaultValue ?? 0
  }

  // Получаем значение toggle
  const getToggleValue = (key: keyof RecipeSettings): ToggleValue => {
    const customValue = customSettings?.[key] as ToggleValue | undefined
    if (customValue !== undefined) return customValue
    const recipeValue = recipe?.settings?.[key] as ToggleValue | undefined
    if (recipeValue !== undefined) return recipeValue
    return 'off'
  }

  // Получаем grain size
  const getGrainSize = (): GrainSizeValue => {
    const customValue = customSettings?.grainSize
    if (customValue !== undefined) return customValue
    const recipeValue = recipe?.settings?.grainSize
    if (recipeValue !== undefined) return recipeValue
    return 'small'
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

  const grainEffect = getToggleValue('grainEffect')

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
    <div className="h-full flex flex-col bg-black safe-area-inset">
      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-4 md:pt-4 pb-3 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">
              Settings
            </h2>
            <p className="text-xs text-zinc-500 truncate">
              {recipe.name}
            </p>
          </div>

        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-5">

          {/* Slider params */}
          {SLIDER_PARAMS.map((param) => {
            const value = getSliderValue(param.key)
            const sliderId = `slider-${param.key}`
            return (
              <div key={param.key} className="space-y-2">
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
                  className="h-11 w-full"
                  aria-valuetext={`${value > 0 ? '+' : ''}${value}`}
                />
              </div>
            )
          })}

          {/* Divider */}
          <div className="h-px bg-zinc-800 my-4" />

          {/* Toggle params with ToggleGroup */}
          {TOGGLE_PARAMS.map((param) => {
            const value = getToggleValue(param.key)
            const labelId = `toggle-label-${param.key}`
            return (
              <div key={param.key} className="space-y-2">
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
            <div className="space-y-2 animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <label id="toggle-label-grainSize" className="text-sm text-zinc-300">Grain Size</label>
                {resetButton('grainSize', 'Grain Size')}
              </div>
              <ToggleGroup
                type="single"
                value={getGrainSize()}
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

          {/* Divider */}
          <div className="h-px bg-zinc-800" />

          {/* Dynamic Range */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label id="toggle-label-dynamicRange" className="text-sm text-zinc-300">Dynamic Range</label>
              {resetButton('dynamicRange', 'Dynamic Range')}
            </div>
            <ToggleGroup
              type="single"
              value={getDynamicRange()}
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
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-sm text-zinc-300">White Balance{resetButton('whiteBalance', 'White Balance')}</span>
              <div className="flex rounded-md overflow-hidden border border-zinc-700">
                <button
                  onClick={() => handleWBModeChange('preset')}
                  className={`min-h-11 min-w-11 px-2 py-1 text-xs transition-colors md:min-h-8 ${
                    getWBMode() === 'preset'
                      ? 'bg-zinc-600 text-white'
                      : 'bg-transparent text-zinc-500 hover:text-zinc-300'
                  }`}
                  aria-pressed={getWBMode() === 'preset'}
                  aria-label="White Balance Preset mode"
                >
                  Preset
                </button>
                <button
                  onClick={() => handleWBModeChange('kelvin')}
                  className={`min-h-11 min-w-11 px-2 py-1 text-xs transition-colors md:min-h-8 ${
                    getWBMode() === 'kelvin'
                      ? 'bg-zinc-600 text-white'
                      : 'bg-transparent text-zinc-500 hover:text-zinc-300'
                  }`}
                  aria-pressed={getWBMode() === 'kelvin'}
                  aria-label="White Balance Kelvin mode"
                >
                  Kelvin
                </button>
              </div>
            </div>

            {getWBMode() === 'preset' ? (
              <ToggleGroup
                type="single"
                value={getWBPreset()}
                onValueChange={handleWBChange}
                className="grid grid-cols-2 gap-1"
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
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="slider-kelvin" className="text-sm text-zinc-500">Temperature</label>
                  <span className="flex items-center gap-1 text-sm text-zinc-500 tabular-nums">
                    <span aria-hidden="true">{getKelvinValue()}K</span>
                    {resetButton('whiteBalanceKelvin', 'Temperature')}
                  </span>
                </div>
                <Slider
                  id="slider-kelvin"
                  value={[getKelvinValue()]}
                  min={2500}
                  max={10000}
                  step={100}
                  onValueChange={(values) => handleKelvinChange(values[0])}
                  className="h-11 w-full"
                  aria-label={`White balance ${getKelvinValue()} Kelvin`}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer with action buttons - fixed at bottom */}
      {showActions && <div className="flex-shrink-0 px-4 py-4 pb-6 md:pb-4 border-t border-zinc-800 bg-black">
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
      </div>}
    </div>
  )
}
