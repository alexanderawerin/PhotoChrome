/**
 * Runtime validation schemas for JSON data.
 * Ensures type safety when loading external JSON files.
 */

import { FilmSimulation, Recipe, RecipeSettings, CurvePoints, ColorBalanceConfig } from './types'

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
  
  if (!isValidCurvePoints(obj.curve)) {
    throw new Error('Invalid simulation: missing or invalid curve')
  }
  
  const simulation: FilmSimulation = {
    id: obj.id,
    name: obj.name,
    curve: obj.curve
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

/**
 * Validates RecipeSettings
 */
function isValidRecipeSettings(value: unknown): value is RecipeSettings {
  if (!value || typeof value !== 'object') return false
  const obj = value as Record<string, unknown>
  
  // All fields are optional, but if present, must be correct type
  const validDynamicRange = ['DR100', 'DR200', 'DR400']
  const validEffectStrength = ['off', 'weak', 'strong']
  const validGrainSize = ['small', 'large']
  const validWhiteBalance = ['auto', 'daylight', 'shade', 'cloudy', 'tungsten', 'fluorescent']
  
  if (obj.dynamicRange !== undefined && !validDynamicRange.includes(obj.dynamicRange as string)) {
    return false
  }
  
  if (obj.highlight !== undefined && typeof obj.highlight !== 'number') return false
  if (obj.shadow !== undefined && typeof obj.shadow !== 'number') return false
  if (obj.color !== undefined && typeof obj.color !== 'number') return false
  if (obj.sharpness !== undefined && typeof obj.sharpness !== 'number') return false
  if (obj.clarity !== undefined && typeof obj.clarity !== 'number') return false
  
  if (obj.grainEffect !== undefined && !validEffectStrength.includes(obj.grainEffect as string)) {
    return false
  }
  
  if (obj.grainSize !== undefined && !validGrainSize.includes(obj.grainSize as string)) {
    return false
  }
  
  if (obj.colorChromeEffect !== undefined && !validEffectStrength.includes(obj.colorChromeEffect as string)) {
    return false
  }
  
  if (obj.colorChromeFXBlue !== undefined && !validEffectStrength.includes(obj.colorChromeFXBlue as string)) {
    return false
  }
  
  if (obj.whiteBalance !== undefined && !validWhiteBalance.includes(obj.whiteBalance as string)) {
    return false
  }
  
  if (obj.wbShiftRed !== undefined && typeof obj.wbShiftRed !== 'number') return false
  if (obj.wbShiftBlue !== undefined && typeof obj.wbShiftBlue !== 'number') return false
  
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
  
  return recipe
}

