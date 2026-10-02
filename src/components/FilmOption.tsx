import { Circle } from 'lucide-react'
import type { Recipe } from '../engine/types'
import { FilmThumbnail } from './FilmThumbnail'

interface FilmOptionProps {
  sourceImage: ImageData
  recipe: Recipe | null
  active: boolean
  onSelect: () => void
  ariaLabel: string
  disabled?: boolean
  retryKey?: number
  recipeOption?: boolean
}

/** The same image, selection marker, and caption for films and detailed recipes. */
export function FilmOption({ sourceImage, recipe, active, onSelect, ariaLabel, disabled = false, retryKey = 0, recipeOption = false }: FilmOptionProps) {
  const name = recipe?.name ?? 'Original'
  return (
    <button type="button" className="film-option" data-recipe-card={recipeOption ? '' : undefined}
      aria-label={ariaLabel} aria-pressed={active} disabled={disabled} onClick={onSelect}>
      {active && <Circle className="film-selected-marker" aria-hidden="true" fill="currentColor" />}
      <FilmThumbnail sourceImage={sourceImage} recipe={recipe} retryKey={retryKey} />
      <span className="film-label" title={name}>{name}</span>
    </button>
  )
}
