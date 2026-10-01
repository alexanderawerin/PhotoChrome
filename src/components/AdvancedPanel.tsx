import { useId, useState } from 'react'
import type { Recipe, RecipeSettings } from '../engine/types'
import { getAllRecipes } from '../presets/recipes'
import { getBaseFilm, getProfileName } from '../engine/film-profiles'
import { useFavorites } from '../hooks/useFavorites'
import { RecipeCard } from './RecipeCard'
import { TuningPanel } from './TuningPanel'
import { Button } from './ui/button'

interface AdvancedPanelProps {
  profile: Recipe
  settings: RecipeSettings
  sourceImage: ImageData
  onProfileSelect: (profile: Recipe) => void
  onSettingsChange: (settings: RecipeSettings) => void
  onApply: () => void
  onCancel: () => void
  onRestoreBase?: () => void
  disabled?: boolean
  applyDisabled?: boolean
}

/** Both tabs edit the caller's one owner-bound draft; only active content runs. */
export function AdvancedPanel({ profile, settings, sourceImage, onProfileSelect, onSettingsChange, onApply, onCancel, onRestoreBase, disabled = false, applyDisabled = false }: AdvancedPanelProps) {
  const [tab, setTab] = useState<'recipes' | 'manual'>('recipes')
  const id = useId()
  const { getFavoriteIds, toggleFavorite } = useFavorites()
  const favorites = new Set(getFavoriteIds())
  const recipes = getAllRecipes().filter(recipe => recipe.filmSimulation === profile.filmSimulation)
    .sort((a, b) => Number(favorites.has(b.id)) - Number(favorites.has(a.id)))
  const restoreBase = () => {
    if (onRestoreBase) onRestoreBase()
    else {
      const base = getBaseFilm(profile.filmSimulation)
      if (base) onProfileSelect(base)
    }
  }

  return (
    <section role="region" aria-label="Advanced settings" className="flex h-full min-h-0 flex-col bg-black">
      <div className="shrink-0 border-b border-zinc-800 px-3 py-2">
        <h2 className="text-base font-semibold">Advanced</h2>
        <p className="mt-1 text-xs text-zinc-400">{getProfileName(profile)}</p>
        <Button variant="ghost" className="mt-2 min-h-11 px-2 text-xs md:min-h-9" onClick={restoreBase} disabled={disabled}>Restore base film</Button>
      </div>
      <div role="tablist" aria-label="Advanced settings mode" className="flex shrink-0 gap-2 border-b border-zinc-800 px-4 py-2">
        {(['recipes', 'manual'] as const).map(value => (
          <button key={value} type="button" role="tab" id={`${id}-${value}`} aria-controls={`${id}-panel-${value}`} aria-selected={tab === value} tabIndex={tab === value ? 0 : -1}
            onClick={() => setTab(value)}
            onKeyDown={event => {
              if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
                event.preventDefault()
                const next = event.key === 'Home' ? 'recipes' : event.key === 'End' ? 'manual' : value === 'recipes' ? 'manual' : 'recipes'
                setTab(next)
                document.getElementById(`${id}-${next}`)?.focus()
              }
            }}
            className={`min-h-[44px] min-w-0 flex-1 rounded-md px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${tab === value ? 'bg-zinc-800 text-white' : 'text-zinc-400'}`}>
            {value === 'recipes' ? 'Recipes' : 'Manual'}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${id}-panel-${tab}`} aria-labelledby={`${id}-${tab}`} className="min-h-0 flex-1 overflow-y-auto">
        <fieldset disabled={disabled} className="h-full min-w-0 border-0 p-0">
          {tab === 'recipes' ? (
            <div className="grid grid-cols-2 gap-3 p-4">
              {recipes.map(recipe => (
                <RecipeCard key={recipe.id} recipe={recipe} sourceImage={sourceImage} isActive={profile.id === recipe.id}
                  largeTouchTargets isFavorite={favorites.has(recipe.id)} onFavoriteToggle={toggleFavorite} onClick={() => onProfileSelect(recipe)} />
              ))}
            </div>
          ) : (
            <TuningPanel recipe={profile} customSettings={settings} onSettingsChange={onSettingsChange} onApply={onApply} onCancel={onCancel} showActions={false} />
          )}
        </fieldset>
      </div>
      <div className="grid shrink-0 grid-cols-2 gap-2 border-t border-zinc-800 p-2">
        <Button variant="outline" className="h-auto min-h-[44px] min-w-0 whitespace-normal break-words px-2 py-2" onClick={onApply} disabled={disabled || applyDisabled}>Apply</Button>
        <Button variant="outline" className="h-auto min-h-[44px] min-w-0 whitespace-normal break-words px-2 py-2" onClick={onCancel}>Cancel</Button>
      </div>
    </section>
  )
}
