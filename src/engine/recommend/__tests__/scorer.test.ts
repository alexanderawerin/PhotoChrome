import { describe, it, expect } from 'vitest'
import { scoreRecipe } from '../scorer'
import type { PhotoFeatures } from '../features'
import type { Recipe } from '../../types'

const warmPortrait: PhotoFeatures = {
  brightness: 0.5,
  contrast: 0.3,
  shadowsRatio: 0.1,
  highlightsRatio: 0.1,
  warmth: 0.4,
  saturation: 0.3,
  dominantHues: [{ hue: 20, weight: 0.7 }, { hue: 200, weight: 0.3 }],
  isLowKey: false,
  isHighKey: false,
  isMonochromatic: false,
  isHighContrast: false,
  exif: { iso: 1600 },
}

const saturatedLandscape: PhotoFeatures = {
  brightness: 0.6,
  contrast: 0.45,
  shadowsRatio: 0.1,
  highlightsRatio: 0.1,
  warmth: 0.1,
  saturation: 0.7,
  dominantHues: [{ hue: 120, weight: 0.5 }, { hue: 200, weight: 0.5 }],
  isLowKey: false,
  isHighKey: false,
  isMonochromatic: false,
  isHighContrast: false,
}

function makeRecipe(id: string, filmSimulation: string, settings: Recipe['settings'] = {}): Recipe {
  return { id, name: id, filmSimulation, settings }
}

describe('scoreRecipe', () => {
  it('warm portrait + Astia portrait recipe → positive score with film+use_case reasons', () => {
    const recipe = makeRecipe('astia-portrait', 'astia')
    const { score, reasons } = scoreRecipe(warmPortrait, recipe)
    expect(score).toBeGreaterThan(0)
    const factors = reasons.map(r => r.factor)
    expect(factors).toContain('use_case_match')
    expect(factors).toContain('film_astia')
  })

  it('warm portrait + Acros recipe → score is 0 (B&W excluded)', () => {
    const recipe = makeRecipe('acros-standard', 'acros')
    const { score, reasons } = scoreRecipe(warmPortrait, recipe)
    expect(score).toBe(0)
    expect(reasons).toEqual([])
  })

  it('saturated landscape + Velvia landscape recipe → positive score with film bonus', () => {
    const recipe = makeRecipe('velvia-landscape', 'velvia')
    const { score, reasons } = scoreRecipe(saturatedLandscape, recipe)
    expect(score).toBeGreaterThan(0)
    expect(reasons.map(r => r.factor)).toContain('film_velvia')
  })

  it('saturated landscape + Astia portrait recipe → low or zero score', () => {
    const recipe = makeRecipe('astia-portrait', 'astia')
    const { score } = scoreRecipe(saturatedLandscape, recipe)
    expect(score).toBeLessThan(0.4)
  })

  it('high ISO photo + recipe with grain → recipe-specific bonus applied', () => {
    const recipe = makeRecipe('provia-portrait', 'provia', { grainEffect: 'strong' })
    const features: PhotoFeatures = { ...warmPortrait, exif: { iso: 6400 } }
    const { reasons } = scoreRecipe(features, recipe)
    expect(reasons.map(r => r.factor)).toContain('grain_camouflage')
  })

  it('Kelvin match — recipe.whiteBalanceKelvin ≈ exif.colorTemperatureKelvin → kelvin_match reason', () => {
    const recipe = makeRecipe('classic-color', 'classic-chrome', { whiteBalanceKelvin: 5300 })
    const features: PhotoFeatures = {
      ...warmPortrait,
      saturation: 0.2,
      exif: { colorTemperatureKelvin: 5400 },
    }
    const { reasons } = scoreRecipe(features, recipe)
    expect(reasons.map(r => r.factor)).toContain('kelvin_match')
  })

  it('DR400 recipe + blown highlights → dr400 reason', () => {
    const recipe = makeRecipe('provia-bright', 'provia', { dynamicRange: 'DR400' })
    const features: PhotoFeatures = { ...warmPortrait, highlightsRatio: 0.25 }
    const { reasons } = scoreRecipe(features, recipe)
    expect(reasons.map(r => r.factor)).toContain('dr400_highlights')
  })
})
