import { useEffect, useId, useRef, useState } from 'react'
import type { Recipe, RecipeSettings } from '../engine/types'
import { getAllRecipes } from '../presets/recipes'
import { getBaseFilm, isBaseProfile } from '../engine/film-profiles'
import { FilmOption } from './FilmOption'
import { TuningPanel } from './TuningPanel'

interface AdvancedPanelProps {
  profile: Recipe
  settings: RecipeSettings
  sourceImage: ImageData
  onProfileSelect: (profile: Recipe) => void
  onSettingsChange: (settings: RecipeSettings) => void
  disabled?: boolean
}

/** Both tabs edit the caller's one owner-bound draft; only active content runs. */
export function AdvancedPanel({ profile, settings, sourceImage, onProfileSelect, onSettingsChange, disabled = false }: AdvancedPanelProps) {
  const [tab, setTab] = useState<'recipes' | 'manual'>('recipes')
  const id = useId()
  const recipesRef = useRef<HTMLDivElement>(null)
  const recipes = getAllRecipes().filter(recipe => recipe.filmSimulation === profile.filmSimulation)
  const recipeOrder = recipes.map(recipe => recipe.id).join(',')
  const baseName = getBaseFilm(profile.filmSimulation)?.name ?? profile.filmSimulation

  useEffect(() => {
    // Mode navigation is hidden during a draft; move keyboard focus into its controls.
    document.getElementById(`${id}-recipes`)?.focus({ preventScroll: true })
  }, [id])

  useEffect(() => {
    const strip = recipesRef.current
    const selected = strip?.querySelector<HTMLButtonElement>('.film-option[aria-pressed="true"]')
    if (!strip || !selected) return
    const bounds = strip.getBoundingClientRect()
    const option = selected.getBoundingClientRect()
    if (option.left < bounds.left || option.right > bounds.right) {
      strip.scrollTo({
        left: strip.scrollLeft + option.left - bounds.left - (strip.clientWidth - option.width) / 2,
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      })
    }
  }, [profile.id, tab, recipeOrder])

  return (
    <section role="region" aria-label="Advanced settings" data-advanced-tab={tab} className="editor-advanced-panel flex h-full min-h-0 flex-col">
      <div className="editor-advanced-heading">
        <div className="editor-advanced-leading">
          <div className="editor-advanced-profile">
            <p className="editor-advanced-base-name">{baseName}</p>
            {!isBaseProfile(profile) && <p className="editor-advanced-recipe-name">{profile.name}</p>}
          </div>
          <div role="tablist" aria-label="Advanced settings mode" className="editor-advanced-tabs">
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
                className="editor-advanced-tab">
                {value === 'recipes' ? 'Recipes' : 'Manual'}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div role="tabpanel" id={`${id}-panel-${tab}`} aria-labelledby={`${id}-${tab}`} className="min-h-0 flex-1 overflow-y-auto">
        <fieldset disabled={disabled} className="h-full min-w-0 border-0 p-0">
          {tab === 'recipes' ? (
            <div ref={recipesRef} className="editor-advanced-recipes film-selector-scroll">
              {recipes.map(recipe => (
                <FilmOption key={recipe.id} recipeOption recipe={recipe} sourceImage={sourceImage} active={profile.id === recipe.id}
                  ariaLabel={`Apply preset ${recipe.name}${profile.id === recipe.id ? ', selected' : ''}`}
                  disabled={disabled} onSelect={() => onProfileSelect(recipe)} />
              ))}
            </div>
          ) : (
            <TuningPanel recipe={profile} customSettings={settings} onSettingsChange={onSettingsChange} />
          )}
        </fieldset>
      </div>
    </section>
  )
}
