/**
 * Runtime validation schemas for JSON data.
 * Ensures type safety when loading external JSON files.
 */

import { FilmSimulation, Recipe, RecipeSettings, CurvePoints, ColorBalanceConfig, EffectStrength, GrainSize } from './types'

/**
 * Validates that a value is a valid CurvePoints object.
 */
function isValidCurvePoints(value: unknown): value is CurvePoints {
  if (!value || typeof value !== 'object') return false
  const obj = value as Record<string, unknown>
  
  if (!Array.isArray(obj.points)) return false
  
  return obj.points.every(
    (point): point is [number, number] =>
      Array.isArray(point) &&
      point.length === 2 &&
      typeof point[0] === 'number' &&
      typeof point[1] === 'number'
  )
}

/**
 * Validates that a value is a valid ColorBalanceConfig object.
 */
function isValidColorBalanceConfig(value: unknown): value is ColorBalanceConfig {
  if (!value || typeof value !== 'object') return false
  const obj = value as Record<string, unknown>
  
  const isValidColorBalance = (cb: unknown): boolean => {
    if (!cb || typeof cb !== 'object') return false
    const c = cb as Record<string, unknown>
    return (
      typeof c.r === 'number' &&
      typeof c.g === 'number' &&
      typeof c.b === 'number'
    )
  }
  
  return isValidColorBalance(obj.shadows) && isValidColorBalance(obj.highlights)
}

/**
 * Validates and parses a FilmSimulation from unknown data.
 * @throws Error if validation fails
 */
export function parseFilmSimulation(data: unknown): FilmSimulation {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid simulation data: expected object')
  }
  
  const obj = data as Record<string, unknown>
  
  if (typeof obj.id !== 'string' || obj.id.length === 0) {
    throw new Error('Invalid simulation: missing or invalid id')
  }
  
  if (typeof obj.name !== 'string' || obj.name.length === 0) {
    throw new Error('Invalid simulation: missing or invalid name')
  }
  
  // Either curve or lutImage must be present
  const hasCurve = isValidCurvePoints(obj.curve)
  const hasLut = typeof obj.lutImage === 'string' && obj.lutImage.length > 0

  if (!hasCurve && !hasLut) {
    throw new Error('Invalid simulation: must have either curve or lutImage')
  }

  const simulation: FilmSimulation = {
    id: obj.id,
    name: obj.name,
  }

  if (hasCurve) {
    simulation.curve = obj.curve as FilmSimulation['curve']
  }

  if (hasLut) {
    simulation.lutImage = obj.lutImage as string
  }
  
  if (obj.colorBalance !== undefined) {
    if (!isValidColorBalanceConfig(obj.colorBalance)) {
      throw new Error('Invalid simulation: invalid colorBalance')
    }
    simulation.colorBalance = obj.colorBalance
  }
  
  if (obj.saturation !== undefined) {
    if (typeof obj.saturation !== 'number') {
      throw new Error('Invalid simulation: saturation must be a number')
    }
    simulation.saturation = obj.saturation
  }
  
  return simulation
}

const VALID_EFFECT_STRENGTHS: EffectStrength[] = ['off', 'weak', 'strong']
const VALID_GRAIN_SIZES: GrainSize[] = ['small', 'large']
const VALID_DYNAMIC_RANGE = ['DR100', 'DR200', 'DR400']
const VALID_WHITE_BALANCE = ['auto', 'daylight', 'shade', 'cloudy', 'tungsten', 'fluorescent']

function checkOptionalNumber(
  obj: Record<string, unknown>,
  field: string,
  min: number,
  max: number
): boolean {
  const value = obj[field]
  return value === undefined || (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max
  )
}

function checkOptionalOneOf(obj: Record<string, unknown>, field: string, valid: string[]): boolean {
  return obj[field] === undefined || valid.includes(obj[field] as string)
}

/**
 * Validates RecipeSettings
 */
function isValidRecipeSettings(value: unknown): value is RecipeSettings {
  if (!value || typeof value !== 'object') return false
  const obj = value as Record<string, unknown>

  if (!checkOptionalOneOf(obj, 'dynamicRange', VALID_DYNAMIC_RANGE)) return false
  if (!checkOptionalNumber(obj, 'highlight', -2, 4)) return false
  if (!checkOptionalNumber(obj, 'shadow', -2, 4)) return false
  if (!checkOptionalNumber(obj, 'color', -4, 4)) return false
  if (!checkOptionalNumber(obj, 'sharpness', -4, 4)) return false
  if (!checkOptionalNumber(obj, 'clarity', -5, 5)) return false
  if (!checkOptionalOneOf(obj, 'grainEffect', VALID_EFFECT_STRENGTHS)) return false
  if (!checkOptionalOneOf(obj, 'grainSize', VALID_GRAIN_SIZES)) return false
  if (!checkOptionalOneOf(obj, 'colorChromeEffect', VALID_EFFECT_STRENGTHS)) return false
  if (!checkOptionalOneOf(obj, 'colorChromeFXBlue', VALID_EFFECT_STRENGTHS)) return false
  if (!checkOptionalOneOf(obj, 'whiteBalance', VALID_WHITE_BALANCE)) return false
  if (!checkOptionalNumber(obj, 'wbShiftRed', -9, 9)) return false
  if (!checkOptionalNumber(obj, 'wbShiftBlue', -9, 9)) return false

  // Validate whiteBalanceKelvin range
  if (obj.whiteBalanceKelvin !== undefined) {
    if (typeof obj.whiteBalanceKelvin !== 'number' ||
        !Number.isFinite(obj.whiteBalanceKelvin) ||
        obj.whiteBalanceKelvin < 2500 || obj.whiteBalanceKelvin > 10000) {
      return false
    }
  }

  return true
}

/**
 * Validates and parses a Recipe from unknown data.
 * @throws Error if validation fails
 */
export function parseRecipe(data: unknown): Recipe {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid recipe data: expected object')
  }
  
  const obj = data as Record<string, unknown>
  
  if (typeof obj.id !== 'string' || obj.id.length === 0) {
    throw new Error('Invalid recipe: missing or invalid id')
  }
  
  if (typeof obj.name !== 'string' || obj.name.length === 0) {
    throw new Error('Invalid recipe: missing or invalid name')
  }
  
  if (typeof obj.filmSimulation !== 'string' || obj.filmSimulation.length === 0) {
    throw new Error('Invalid recipe: missing or invalid filmSimulation')
  }
  
  if (!isValidRecipeSettings(obj.settings)) {
    throw new Error('Invalid recipe: invalid settings')
  }
  
  const recipe: Recipe = {
    id: obj.id,
    name: obj.name,
    filmSimulation: obj.filmSimulation,
    settings: obj.settings as RecipeSettings
  }
  
  if (obj.author !== undefined) {
    if (typeof obj.author !== 'string') {
      throw new Error('Invalid recipe: author must be a string')
    }
    recipe.author = obj.author
  }

  if (obj.sourceUrl !== undefined) {
    if (typeof obj.sourceUrl !== 'string') throw new Error('Invalid recipe: sourceUrl must be a string')
    recipe.sourceUrl = obj.sourceUrl
  }
  if (obj.description !== undefined) {
    if (typeof obj.description !== 'string') throw new Error('Invalid recipe: description must be a string')
    recipe.description = obj.description
  }
  if (obj.cameraModel !== undefined) {
    if (typeof obj.cameraModel !== 'string') throw new Error('Invalid recipe: cameraModel must be a string')
    recipe.cameraModel = obj.cameraModel
  }

  return recipe
}
