import type { Recipe } from '../types'
import type { PhotoFeatures, ScoredRecipe } from './features'
import { scoreRecipe } from './scorer'
import { DIVERSITY, PICKS_COUNT, CANDIDATE_POOL_SIZE } from './weights'
import { RECIPE_USE_CASES } from '../../presets/recipes'

/**
 * Возвращает топ-N recipe IDs для данных PhotoFeatures.
 * Guard: для монохромных фото — пустой массив.
 * Diversity (MMR): рецепты одного film/use_case подавляются.
 */
export function recommendRecipes(features: PhotoFeatures, allRecipes: Recipe[]): string[] {
  if (features.isMonochromatic) return []

  const scored: ScoredRecipe[] = allRecipes
    .map(r => {
      const { score, reasons } = scoreRecipe(features, r)
      return { recipeId: r.id, score, reasons }
    })
    .filter(s => s.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return a.recipeId.localeCompare(b.recipeId)
    })

  const candidates = scored.slice(0, CANDIDATE_POOL_SIZE)
  const recipeMap = new Map(allRecipes.map(r => [r.id, r]))

  const selected: ScoredRecipe[] = []
  const selectedFilms = new Set<string>()
  const selectedUseCases = new Set<string>()

  while (selected.length < PICKS_COUNT && candidates.length > 0) {
    let bestIdx = -1
    let bestEffective = -Infinity

    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i]
      const recipe = recipeMap.get(c.recipeId)
      if (!recipe) continue
      const film = recipe.filmSimulation
      const useCase = RECIPE_USE_CASES[c.recipeId] ?? 'everyday'

      const penalty =
        (selectedFilms.has(film) ? DIVERSITY.sameFilmPenalty : 0) +
        (selectedUseCases.has(useCase) ? DIVERSITY.sameUseCasePenalty : 0)

      const effective = c.score - DIVERSITY.lambda * penalty
      if (effective > bestEffective) {
        bestEffective = effective
        bestIdx = i
      }
    }

    if (bestIdx === -1) break
    const picked = candidates.splice(bestIdx, 1)[0]
    selected.push(picked)
    const r = recipeMap.get(picked.recipeId)
    if (r) {
      selectedFilms.add(r.filmSimulation)
      selectedUseCases.add(RECIPE_USE_CASES[picked.recipeId] ?? 'everyday')
    }
  }

  return selected.map(s => s.recipeId)
}
