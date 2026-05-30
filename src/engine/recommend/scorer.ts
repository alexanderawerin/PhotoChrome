import type { Recipe } from '../types'
import type { PhotoFeatures, Reason } from './features'
import { RECIPE_USE_CASES, type UseCase } from '../../presets/recipes'
import {
  USE_CASE_FIT_BONUS,
  FILM_FIT_BONUS,
  FILM_FALLBACK_BONUS,
  RECIPE_SPECIFIC_BONUS,
  THRESHOLDS as T,
} from './weights'

export type ScoreResult = {
  score: number
  reasons: Reason[]
}

type UseCaseRule = (f: PhotoFeatures) => UseCase[]

const USE_CASE_RULES: UseCaseRule[] = [
  f => f.isHighKey && f.warmth > 0 ? ['portrait', 'everyday'] : [],
  f => f.warmth > T.warmthWarm && f.saturation < T.saturationHigh && !f.isHighContrast ? ['portrait'] : [],
  f => f.saturation > T.saturationHigh && !f.isLowKey ? ['landscape'] : [],
  f => f.dominantHues.length >= T.dominantHueCountHigh && f.saturation > T.saturationMuted ? ['street', 'cinema'] : [],
  f => f.isLowKey && f.isHighContrast && f.saturation > T.saturationMidLow ? ['cinema'] : [],
  f => f.warmth > T.warmthSlight && f.saturation > T.saturationVibrant ? ['everyday'] : [],
]

function preferredUseCases(features: PhotoFeatures): Set<UseCase> {
  const preferred = new Set<UseCase>()
  for (const rule of USE_CASE_RULES) {
    rule(features).forEach(uc => preferred.add(uc))
  }
  if (preferred.size === 0) preferred.add('everyday')
  return preferred
}

function filmBonus(features: PhotoFeatures, simulation: string): Reason | null {
  const make = (factor: string, label: string): Reason => ({ factor, weight: FILM_FIT_BONUS, label })

  switch (simulation) {
    case 'velvia':
      return features.saturation > T.saturationVibrant
        ? make('film_velvia', 'Velvia for saturated colors')
        : null
    case 'astia':
      return features.warmth > T.warmthMild && features.contrast < T.contrastMid
        ? make('film_astia', 'Astia for soft warm scenes')
        : null
    case 'acros':
    case 'neopan':
      return null
    case 'classic-chrome':
      return features.saturation < T.saturationMuted
        ? make('film_classic_chrome', 'Classic Chrome for muted palettes')
        : null
    case 'classic-neg':
      return features.dominantHues.length >= T.dominantHueCountHigh && features.saturation > T.saturationMidLow
        ? make('film_classic_neg', 'Classic Neg for complex palettes')
        : null
    case 'pro-400h':
      return features.warmth > T.warmthMild
        ? make('film_pro_400h', 'Pro 400H for warm tones')
        : null
    case 'eterna':
      return features.contrast > T.contrastLow &&
             features.shadowsRatio > T.shadowsRecover &&
             features.highlightsRatio > T.shadowsRecover
        ? make('film_eterna', 'Eterna for wide tonal range')
        : null
    case 'superia':
      return features.warmth > T.warmthMild && features.saturation > T.saturationVibrant
        ? make('film_superia', 'Superia for warm vibrant tones')
        : null
    case 'provia':
      return {
        factor: 'film_provia_baseline',
        weight: FILM_FALLBACK_BONUS,
        label: 'Provia as neutral baseline',
      }
    default:
      return null
  }
}

export function scoreRecipe(features: PhotoFeatures, recipe: Recipe): ScoreResult {
  const useCase = RECIPE_USE_CASES[recipe.id] ?? 'everyday'

  if (useCase === 'bw') return { score: 0, reasons: [] }

  const reasons: Reason[] = []
  let score = 0

  if (preferredUseCases(features).has(useCase)) {
    score += USE_CASE_FIT_BONUS
    reasons.push({
      factor: 'use_case_match',
      weight: USE_CASE_FIT_BONUS,
      label: `Use case ${useCase} matches scene`,
    })
  }

  const film = filmBonus(features, recipe.filmSimulation)
  if (film) {
    score += film.weight
    reasons.push(film)
  }

  const { settings } = recipe
  const exif = features.exif

  if (
    settings.whiteBalanceKelvin !== undefined &&
    exif?.colorTemperatureKelvin !== undefined &&
    Math.abs(settings.whiteBalanceKelvin - exif.colorTemperatureKelvin) < T.kelvinTolerance
  ) {
    score += RECIPE_SPECIFIC_BONUS
    reasons.push({
      factor: 'kelvin_match',
      weight: RECIPE_SPECIFIC_BONUS,
      label: 'WB Kelvin matches photo',
    })
  }

  if (settings.dynamicRange === 'DR400' && features.highlightsRatio > T.highlightsRecover) {
    score += RECIPE_SPECIFIC_BONUS
    reasons.push({
      factor: 'dr400_highlights',
      weight: RECIPE_SPECIFIC_BONUS,
      label: 'DR400 recovers blown highlights',
    })
  }

  if (
    settings.grainEffect &&
    settings.grainEffect !== 'off' &&
    exif?.iso !== undefined &&
    exif.iso > T.isoHigh
  ) {
    score += RECIPE_SPECIFIC_BONUS
    reasons.push({
      factor: 'grain_camouflage',
      weight: RECIPE_SPECIFIC_BONUS,
      label: 'Grain masks high-ISO noise',
    })
  }

  return { score, reasons }
}
