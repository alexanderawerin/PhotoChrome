import { describe, expect, it } from 'vitest'
import { parseRecipe } from '../engine/schemas'
import type { FilmSimulation, RecipeSettings } from '../engine/types'
import { RECIPES, RECIPE_USE_CASES } from './recipes'
import { hasSimulationLUTAsset, SIMULATIONS } from './simulations'

const processingPaths = ['cpu', 'worker', 'webgl'] as const

function supportsProcessingPath(simulation: FilmSimulation, path: typeof processingPaths[number]): boolean {
  // All three engines support curve simulations. LUT simulations additionally
  // require a bundled asset: CPU/WebGL load it directly and workers receive the
  // decoded LUT through their registration message.
  if (simulation.curve) return true
  if (simulation.lutImage) return hasSimulationLUTAsset(simulation.id)
  throw new Error(`Unknown processing path: ${path}`)
}

describe('recipe registry invariants', () => {
  it('contains unique IDs matching their registry keys', () => {
    const ids = Object.values(RECIPES).map(recipe => recipe.id)

    expect(new Set(ids).size).toBe(ids.length)
    for (const [key, recipe] of Object.entries(RECIPES)) {
      expect(recipe.id).toBe(key)
    }
  })

  it('contains valid settings for every recipe', () => {
    for (const recipe of Object.values(RECIPES)) {
      expect(() => parseRecipe(recipe), recipe.id).not.toThrow()
      expect(RECIPE_USE_CASES[recipe.id], `${recipe.id} has no use-case group`).toBeDefined()
    }
  })

  it('references existing simulations supported by every processing path', () => {
    for (const recipe of Object.values(RECIPES)) {
      const simulation = SIMULATIONS[recipe.filmSimulation]
      expect(simulation, `${recipe.id} references ${recipe.filmSimulation}`).toBeDefined()

      for (const path of processingPaths) {
        expect(
          supportsProcessingPath(simulation, path),
          `${recipe.id} is not supported by ${path}`
        ).toBe(true)
      }
    }
  })

  it('has a bundled asset for every declared LUT', () => {
    for (const simulation of Object.values(SIMULATIONS)) {
      if (simulation.lutImage) {
        expect(hasSimulationLUTAsset(simulation.id), simulation.id).toBe(true)
      }
    }
  })
})

describe('recipe settings validation', () => {
  const validRecipe = (settings: RecipeSettings) => ({
    id: 'test',
    name: 'Test',
    filmSimulation: 'provia',
    settings,
  })

  it.each([
    ['highlight', -2, 4],
    ['shadow', -2, 4],
    ['color', -4, 4],
    ['sharpness', -4, 4],
    ['clarity', -5, 5],
    ['wbShiftRed', -9, 9],
    ['wbShiftBlue', -9, 9],
    ['whiteBalanceKelvin', 2500, 10000],
  ] as const)('enforces the %s range', (field, min, max) => {
    expect(() => parseRecipe(validRecipe({ [field]: min - 1 }))).toThrow()
    expect(() => parseRecipe(validRecipe({ [field]: min }))).not.toThrow()
    expect(() => parseRecipe(validRecipe({ [field]: max }))).not.toThrow()
    expect(() => parseRecipe(validRecipe({ [field]: max + 1 }))).toThrow()
  })

  it('rejects non-finite numeric settings', () => {
    expect(() => parseRecipe(validRecipe({ color: Number.NaN }))).toThrow()
    expect(() => parseRecipe(validRecipe({ clarity: Number.POSITIVE_INFINITY }))).toThrow()
  })
})
