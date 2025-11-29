import { Check, Shuffle } from 'lucide-react'
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
  onCancel
}: TuningPanelProps) {
  
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

  // Случайные настройки
  const handleRandomize = () => {
    const toggleValues: ToggleValue[] = ['off', 'weak', 'strong']
    const grainSizeValues: GrainSizeValue[] = ['small', 'large']
    
    const randomSettings: RecipeSettings = {
      // Случайные значения для слайдеров
      highlight: Math.floor(Math.random() * 7) - 2, // -2 to 4
      shadow: Math.floor(Math.random() * 7) - 2, // -2 to 4
      color: Math.floor(Math.random() * 9) - 4, // -4 to 4
      sharpness: Math.floor(Math.random() * 9) - 4, // -4 to 4
      clarity: Math.floor(Math.random() * 11) - 5, // -5 to 5
      wbShiftRed: Math.floor(Math.random() * 19) - 9, // -9 to 9
      wbShiftBlue: Math.floor(Math.random() * 19) - 9, // -9 to 9
      // Случайные toggle значения
      grainEffect: toggleValues[Math.floor(Math.random() * toggleValues.length)],
      colorChromeEffect: toggleValues[Math.floor(Math.random() * toggleValues.length)],
      colorChromeFXBlue: toggleValues[Math.floor(Math.random() * toggleValues.length)],
      // Случайный grain size
      grainSize: grainSizeValues[Math.floor(Math.random() * grainSizeValues.length)],
    }
    
    onSettingsChange(randomSettings)
  }

  const grainEffect = getToggleValue('grainEffect')

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
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRandomize}
            className="text-zinc-400 hover:text-white"
            aria-label="Randomize settings"
          >
            <Shuffle className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-5">
          
          {/* Slider params */}
          {SLIDER_PARAMS.map((param) => {
            const value = getSliderValue(param.key)
            return (
              <div key={param.key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-zinc-300">
                    {param.label}
                  </label>
                  <span className="text-sm text-zinc-500 tabular-nums w-8 text-right">
                    {value > 0 ? `+${value}` : value}
                  </span>
                </div>
                <Slider
                  value={[value]}
                  min={param.min}
                  max={param.max}
                  step={param.step}
                  onValueChange={(values) => handleSliderChange(param.key, values[0])}
                  className="w-full"
                  aria-label={`${param.label}: ${value}`}
                />
              </div>
            )
          })}

          {/* Divider */}
          <div className="h-px bg-zinc-800 my-4" />

          {/* Toggle params with ToggleGroup */}
          {TOGGLE_PARAMS.map((param) => {
            const value = getToggleValue(param.key)
            return (
              <div key={param.key} className="space-y-2">
                <label className="text-sm text-zinc-300 block">
                  {param.label}
                </label>
                <ToggleGroup 
                  type="single" 
                  value={value}
                  onValueChange={(v) => handleToggleChange(param.key, v)}
                  className="w-full justify-start"
                >
                  {TOGGLE_OPTIONS.map((option) => (
                    <ToggleGroupItem
                      key={option.value}
                      value={option.value}
                      aria-label={option.label}
                      className="flex-1 text-xs"
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
              <label className="text-sm text-zinc-300 block">
                Grain Size
              </label>
              <ToggleGroup 
                type="single" 
                value={getGrainSize()}
                onValueChange={handleGrainSizeChange}
                className="w-full justify-start"
              >
                {GRAIN_SIZE_OPTIONS.map((option) => (
                  <ToggleGroupItem
                    key={option.value}
                    value={option.value}
                    aria-label={option.label}
                    className="flex-1 text-xs"
                  >
                    {option.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
          )}
        </div>
      </div>

      {/* Footer with action buttons - fixed at bottom */}
      <div className="flex-shrink-0 px-4 py-4 pb-6 md:pb-4 border-t border-zinc-800 bg-black">
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
