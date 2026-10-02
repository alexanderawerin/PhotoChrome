import type { Recipe } from '../engine/types'
import { getBaseFilms } from '../engine/film-profiles'

interface FilmSelectorProps {
  activeRecipe: Recipe | null
  onSelect: (profile: Recipe | null) => void
  disabled: boolean
  className?: string
}

export function FilmSelector({ activeRecipe, onSelect, disabled, className = '' }: FilmSelectorProps) {
  const choices = [null, ...getBaseFilms()]
  return (
    <div role="group" aria-label="Film selection" className={`flex gap-2 overflow-x-auto pb-2 md:grid md:grid-cols-2 md:overflow-visible ${className}`}>
      {choices.map(profile => {
        const active = profile ? activeRecipe?.filmSimulation === profile.filmSimulation : activeRecipe === null
        return (
          <button
            key={profile?.id ?? 'original'}
            type="button"
            aria-label={profile ? `Select film ${profile.name}` : 'Select Original'}
            aria-pressed={active}
            disabled={disabled}
            onClick={() => onSelect(profile)}
            className={`min-h-11 shrink-0 rounded-lg px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${active ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-white'}`}
          >
            {profile?.name ?? 'Original'}
          </button>
        )
      })}
    </div>
  )
}
