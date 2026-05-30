import { describe, it, expect } from 'vitest'
import { recommendRecipes } from '../recommend'
import { getAllRecipes, RECIPE_USE_CASES } from '../../../presets/recipes'
import type { PhotoFeatures } from '../features'

const allRecipes = getAllRecipes()

const monochromatic: PhotoFeatures = {
  brightness: 0.5, contrast: 0.3, shadowsRatio: 0.1, highlightsRatio: 0.1,
  warmth: 0, saturation: 0.05, dominantHues: [],
  isLowKey: false, isHighKey: false, isMonochromatic: true, isHighContrast: false,
}

const warmPortrait: PhotoFeatures = {
  brightness: 0.55, contrast: 0.3, shadowsRatio: 0.05, highlightsRatio: 0.1,
  warmth: 0.4, saturation: 0.3,
  dominantHues: [{ hue: 20, weight: 0.7 }, { hue: 200, weight: 0.3 }],
  isLowKey: false, isHighKey: false, isMonochromatic: false, isHighContrast: false,
}

const saturatedLandscape: PhotoFeatures = {
  brightness: 0.6, contrast: 0.45, shadowsRatio: 0.1, highlightsRatio: 0.1,
  warmth: 0.1, saturation: 0.7,
  dominantHues: [{ hue: 120, weight: 0.4 }, { hue: 200, weight: 0.4 }, { hue: 60, weight: 0.2 }],
  isLowKey: false, isHighKey: false, isMonochromatic: false, isHighContrast: false,
}

describe('recommendRecipes', () => {
  it('returns empty array for monochromatic input', () => {
    expect(recommendRecipes(monochromatic, allRecipes)).toEqual([])
  })

  it('returns 5 picks for warm portrait scene', () => {
    const picks = recommendRecipes(warmPortrait, allRecipes)
    expect(picks.length).toBe(5)
  })

  it('warm portrait picks include at least one portrait or everyday recipe', () => {
    const picks = recommendRecipes(warmPortrait, allRecipes)
    const useCases = picks.map(id => RECIPE_USE_CASES[id] ?? 'everyday')
    expect(useCases.some(uc => uc === 'portrait' || uc === 'everyday')).toBe(true)
  })

  it('top 5 contain at least 3 different film simulations (diversity)', () => {
    const picks = recommendRecipes(warmPortrait, allRecipes)
    const films = new Set(
      picks
        .map(id => allRecipes.find(r => r.id === id)?.filmSimulation)
        .filter((f): f is string => Boolean(f))
    )
    expect(films.size).toBeGreaterThanOrEqual(3)
  })

  it('no B&W recipes in non-empty output', () => {
    const picks = recommendRecipes(saturatedLandscape, allRecipes)
    const useCases = picks.map(id => RECIPE_USE_CASES[id] ?? 'everyday')
    expect(useCases.every(uc => uc !== 'bw')).toBe(true)

    const films = picks.map(id => allRecipes.find(r => r.id === id)?.filmSimulation)
    expect(films.every(f => f !== 'acros' && f !== 'neopan')).toBe(true)
  })

  it('is deterministic — same input gives same output', () => {
    const a = recommendRecipes(warmPortrait, allRecipes)
    const b = recommendRecipes(warmPortrait, allRecipes)
    expect(a).toEqual(b)
  })
})
