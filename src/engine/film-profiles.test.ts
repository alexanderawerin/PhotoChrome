import { afterEach, describe, expect, it, vi } from 'vitest'
import { getBaseFilm, getBaseFilms, getProfileName, hasModifiedSettings, isBaseProfile, NEUTRAL_FILM_SETTINGS } from './film-profiles'
import { getAllRecipes } from '../presets/recipes'
import { getSimulation } from '../presets/simulations'
import { createProcessingPlan, createOriginalProcessingPlan, prepareProcessingPlan } from './processing-plan'
import { processOnCPU } from './cpu'
import type { Recipe } from './types'

class TestImageData {
  constructor(public data: Uint8ClampedArray, public width: number, public height: number) {}
}

afterEach(() => vi.unstubAllGlobals())

describe('base film profiles', () => {
  it('provides precisely ten neutral bases separately from all existing recipe identities', () => {
    const films = getBaseFilms()
    expect(films.map(film => film.name)).toEqual(['Provia', 'Velvia', 'Astia', 'Pro 400H', 'Superia', 'Acros', 'Neopan', 'Eterna', 'Classic Chrome', 'Classic Neg'])
    expect(new Set(films.map(film => film.id)).size).toBe(10)
    expect(getAllRecipes()).toHaveLength(100)
    const catalogIds = new Set(getAllRecipes().map(recipe => recipe.id))
    for (const film of films) {
      expect(isBaseProfile(film)).toBe(true)
      expect(catalogIds.has(film.id)).toBe(false)
      expect(film.settings).toEqual(NEUTRAL_FILM_SETTINGS)
      expect(film.settings).not.toHaveProperty('whiteBalanceKelvin')
      expect(getSimulation(film.filmSimulation)).toBeDefined()
    }
    const mutated = getBaseFilms()[0]
    mutated.settings.color = 4
    expect(getBaseFilms()[0].settings.color).toBe(0)
  })

  it('tracks effective manual differences and applied profile names', () => {
    const base = getBaseFilm('eterna')!
    expect(getProfileName(null)).toBe('Original')
    expect(getProfileName(base)).toBe('Eterna')
    expect(hasModifiedSettings(base, { color: 0, whiteBalanceKelvin: undefined })).toBe(false)
    expect(hasModifiedSettings(base, { color: 1 })).toBe(true)
    expect(hasModifiedSettings(base, { color: 0 })).toBe(false)
    expect(hasModifiedSettings(base, { color: undefined, grainSize: 'large' })).toBe(false)
    const recipe = { ...base, profileKind: undefined, name: 'Detailed recipe', settings: { color: 2 } }
    expect(getProfileName(recipe)).toBe('Eterna · Detailed recipe')
    expect(hasModifiedSettings(recipe, { color: 2, grainEffect: 'off' })).toBe(false)
    expect(hasModifiedSettings(recipe, { color: 0 })).toBe(true)
    expect(hasModifiedSettings(null, { color: 4 })).toBe(false)
  })

  it('uses the existing curve simulation unchanged with neutral additions', () => {
    vi.stubGlobal('ImageData', TestImageData)
    const source = new ImageData(new Uint8ClampedArray([35, 89, 120, 0, 170, 104, 50, 192]), 2, 1)
    for (const id of ['eterna', 'classic-neg']) {
      const base = getBaseFilm(id)!
      const plan = createProcessingPlan(base, source)
      const withoutAdditions = { ...plan, settings: {} }
      expect(processOnCPU(source, plan).data).toEqual(processOnCPU(source, withoutAdditions).data)
      expect(processOnCPU(source, plan).data).not.toEqual(source.data)
      expect(plan.simulation).toEqual(getSimulation(id))
    }
  })

  it('clears inherited Kelvin or preset processing when the other WB mode is chosen', () => {
    vi.stubGlobal('ImageData', TestImageData)
    const source = new ImageData(new Uint8ClampedArray([65, 120, 185, 255]), 1, 1)
    const base = getBaseFilm('eterna')!
    const kelvinRecipe = { ...base, settings: { whiteBalanceKelvin: 8500 } }
    const presetPlan = createProcessingPlan(kelvinRecipe, source, { whiteBalance: 'tungsten', whiteBalanceKelvin: undefined })
    const expectedPreset = createProcessingPlan(base, source, { whiteBalance: 'tungsten' })
    expect(processOnCPU(source, presetPlan).data).toEqual(processOnCPU(source, expectedPreset).data)
    const presetRecipe: Recipe = { ...base, settings: { whiteBalance: 'tungsten' } }
    const kelvinPlan = createProcessingPlan(presetRecipe, source, { whiteBalance: undefined, whiteBalanceKelvin: 8500 })
    const expectedKelvin = createProcessingPlan(base, source, { whiteBalanceKelvin: 8500 })
    expect(processOnCPU(source, kelvinPlan).data).toEqual(processOnCPU(source, expectedKelvin).data)
    expect(processOnCPU(source, presetPlan).data).not.toEqual(processOnCPU(source, kelvinPlan).data)
    expect(hasModifiedSettings(kelvinRecipe, { whiteBalance: 'auto', whiteBalanceKelvin: undefined })).toBe(true)
  })
})

describe('Original color mode', () => {
  it('copies every RGBA byte with no LUT or color adjustments', async () => {
    vi.stubGlobal('ImageData', TestImageData)
    const source = new ImageData(new Uint8ClampedArray([15, 41, 203, 0, 251, 32, 8, 128]), 2, 1)
    const plan = createOriginalProcessingPlan(source)
    expect(plan.colorMode).toBe('original')
    expect(plan.lut).toBeNull()
    expect(plan.simulation.lutImage).toBeUndefined()
    expect(createProcessingPlan(null, source)).toEqual(plan)
    expect(await prepareProcessingPlan(null, source, { color: 4, grainEffect: 'strong' })).toEqual(plan)
    const result = processOnCPU(source, plan)
    expect(result.data).toEqual(source.data)
    expect(result.data).not.toBe(source.data)
    // Explicit mode remains authoritative even if a stale color snapshot exists.
    const staleColor = { ...plan, settings: { color: 4, clarity: 5 }, simulation: { ...plan.simulation, saturation: 0, lutImage: 'unused.png' } }
    expect(processOnCPU(source, staleColor).data).toEqual(source.data)
    expect(() => createOriginalProcessingPlan({ width: 0, height: 1 })).toThrow()
  })
})
