import { Recipe } from '../../engine/types'
import { parseRecipe } from '../../engine/schemas'

// Provia
// import proviaCleanData from './provia-clean.json'
import proviaPortraitData from './provia-portrait.json'
import portraVibesData from './portra-vibes.json'
import proviaVividData from './provia-vivid.json'

// Velvia
// import velviaCleanData from './velvia-clean.json'
import vividSunsetData from './vivid-sunset.json'
import warmSummerData from './warm-summer.json'
import velviaSunsetData from './velvia-sunset.json'
import velviaNatureData from './velvia-nature.json'
import goldenHourData from './golden-hour.json'
import velviaVibrantData from './velvia-vibrant.json'
import velviaLandscapeData from './velvia-landscape.json'

// Astia
// import astiaCleanData from './astia-clean.json'
import astiaPortraitData from './astia-portrait.json'
import astiaSoftDaylightData from './astia-soft-daylight.json'
import astiaNaturalData from './astia-natural.json'
import astiaWarmData from './astia-warm.json'
import astiaStudioData from './astia-studio.json'

// Pro 400H
// import pro400hCleanData from './pro400h-clean.json'
import pro400hPortraitData from './pro400h-portrait.json'
import pro400hOverexposedData from './pro400h-overexposed.json'
import pro400hWeddingData from './pro400h-wedding.json'

// Superia
// import superiaCleanData from './superia-clean.json'
import superia400Data from './superia-400.json'
import superiaSummerData from './superia-summer.json'
import superiaNostalgicData from './superia-nostalgic.json'
import superiaVintageData from './superia-vintage.json'
import superiaDaylightData from './superia-daylight.json'

// Acros (B&W)
// import acrosCleanData from './acros-clean.json'
import acrosStandardData from './acros-standard.json'
import acrosHighContrastData from './acros-high-contrast.json'
import acrosSoftData from './acros-soft.json'
import acrosYellowData from './acros-yellow.json'
import acrosRedData from './acros-red.json'

// Neopan (B&W)
// import neopanCleanData from './neopan-clean.json'
import neopan400Data from './neopan-400.json'
import neopan1600Data from './neopan-1600.json'
import neopanContrastData from './neopan-contrast.json'

// Eterna (Cinema)
// import eternaCleanData from './eterna-clean.json'
import eternaCinemaData from './eterna-cinema.json'
import eternaBleachBypassData from './eterna-bleach-bypass.json'
import eternaTealOrangeData from './eterna-teal-orange.json'
import eternaMutedData from './eterna-muted.json'
import eternaNightData from './eterna-night.json'

// Classic Chrome
// import classicChromeCleanData from './classic-chrome-clean.json'
import moodyChromeData from './moody-chrome.json'
import cinematicTealData from './cinematic-teal.json'
import classicChromeWarmData from './classic-chrome-warm.json'
import classicChromeFadedData from './classic-chrome-faded.json'
import classicChromeCoolData from './classic-chrome-cool.json'
import streetClassicData from './street-classic.json'
import rainyDayData from './rainy-day.json'
import classicChromeStreetData from './classic-chrome-street.json'
import classicChromeVintageData from './classic-chrome-vintage.json'

// Classic Negative
// import classicNegCleanData from './classic-neg-clean.json'
import mapleLetterData from './maple-letter.json'
import classicNegMutedData from './classic-neg-muted.json'
import classicNegSoftData from './classic-neg-soft.json'
import classicNegStreetData from './classic-neg-street.json'
import fadedMemoriesData from './faded-memories.json'
import classicNegWarmData from './classic-neg-warm.json'
import classicNegVibrantData from './classic-neg-vibrant.json'

/**
 * Raw recipe data organized by ID.
 * Will be validated and parsed at module load time.
 */
const RAW_RECIPES: Record<string, unknown> = {
  // Provia
  // 'provia-clean': proviaCleanData,
  'provia-portrait': proviaPortraitData,
  'portra-vibes': portraVibesData,
  'provia-vivid': proviaVividData,

  // Velvia
  // 'velvia-clean': velviaCleanData,
  'vivid-sunset': vividSunsetData,
  'warm-summer': warmSummerData,
  'velvia-sunset': velviaSunsetData,
  'velvia-nature': velviaNatureData,
  'golden-hour': goldenHourData,
  'velvia-vibrant': velviaVibrantData,
  'velvia-landscape': velviaLandscapeData,
  
  // Astia
  // 'astia-clean': astiaCleanData,
  'astia-portrait': astiaPortraitData,
  'astia-soft-daylight': astiaSoftDaylightData,
  'astia-natural': astiaNaturalData,
  'astia-warm': astiaWarmData,
  'astia-studio': astiaStudioData,

  // Pro 400H
  // 'pro400h-clean': pro400hCleanData,
  'pro400h-portrait': pro400hPortraitData,
  'pro400h-overexposed': pro400hOverexposedData,
  'pro400h-wedding': pro400hWeddingData,

  // Superia
  // 'superia-clean': superiaCleanData,
  'superia-400': superia400Data,
  'superia-summer': superiaSummerData,
  'superia-nostalgic': superiaNostalgicData,
  'superia-vintage': superiaVintageData,
  'superia-daylight': superiaDaylightData,

  // Acros (B&W)
  // 'acros-clean': acrosCleanData,
  'acros-standard': acrosStandardData,
  'acros-high-contrast': acrosHighContrastData,
  'acros-soft': acrosSoftData,
  'acros-yellow': acrosYellowData,
  'acros-red': acrosRedData,

  // Neopan (B&W)
  // 'neopan-clean': neopanCleanData,
  'neopan-400': neopan400Data,
  'neopan-1600': neopan1600Data,
  'neopan-contrast': neopanContrastData,

  // Eterna (Cinema)
  // 'eterna-clean': eternaCleanData,
  'eterna-cinema': eternaCinemaData,
  'eterna-bleach-bypass': eternaBleachBypassData,
  'eterna-teal-orange': eternaTealOrangeData,
  'eterna-muted': eternaMutedData,
  'eterna-night': eternaNightData,

  // Classic Chrome
  // 'classic-chrome-clean': classicChromeCleanData,
  'moody-chrome': moodyChromeData,
  'cinematic-teal': cinematicTealData,
  'classic-chrome-warm': classicChromeWarmData,
  'classic-chrome-faded': classicChromeFadedData,
  'classic-chrome-cool': classicChromeCoolData,
  'street-classic': streetClassicData,
  'rainy-day': rainyDayData,
  'classic-chrome-street': classicChromeStreetData,
  'classic-chrome-vintage': classicChromeVintageData,

  // Classic Negative
  // 'classic-neg-clean': classicNegCleanData,
  'maple-letter': mapleLetterData,
  'classic-neg-muted': classicNegMutedData,
  'classic-neg-soft': classicNegSoftData,
  'classic-neg-street': classicNegStreetData,
  'faded-memories': fadedMemoriesData,
  'classic-neg-warm': classicNegWarmData,
  'classic-neg-vibrant': classicNegVibrantData,
}

/**
 * Parses and validates all recipe JSON files at module load time.
 * Throws early if any recipe data is invalid.
 */
function loadRecipes(): Record<string, Recipe> {
  const parsed: Record<string, Recipe> = {}
  
  for (const [key, data] of Object.entries(RAW_RECIPES)) {
    try {
      parsed[key] = parseRecipe(data)
    } catch (err) {
      console.error(`Failed to parse recipe "${key}":`, err)
      throw new Error(`Invalid recipe data for "${key}": ${err instanceof Error ? err.message : 'unknown error'}`)
    }
  }
  
  return parsed
}

/** All available recipes, validated at load time */
export const RECIPES: Record<string, Recipe> = loadRecipes()

// Названия симуляций для отображения
export const SIMULATION_NAMES: Record<string, string> = {
  // Цветные позитивные
  'provia': 'Provia',
  'velvia': 'Velvia',
  'astia': 'Astia',
  // Цветные негативные
  'pro-400h': 'Pro 400H',
  'superia': 'Superia',
  // Черно-белые
  'acros': 'Acros',
  'neopan': 'Neopan',
  // Кинопленки
  'eterna': 'Eterna',
  // Цифровые симуляции
  'classic-chrome': 'Classic Chrome',
  'classic-neg': 'Classic Neg.',
}

// Порядок отображения групп
export const SIMULATION_ORDER = [
  // Цветные позитивные (Reversal)
  'provia',
  'velvia', 
  'astia',
  // Цветные негативные
  'pro-400h',
  'superia',
  // Черно-белые
  'acros',
  'neopan',
  // Кинопленки
  'eterna',
  // Цифровые симуляции Fujifilm
  'classic-chrome',
  'classic-neg',
]

export interface RecipeGroup {
  simulationId: string
  simulationName: string
  recipes: Recipe[]
}

// Категории использования
export type UseCase = 'portrait' | 'landscape' | 'street' | 'cinema' | 'bw' | 'everyday'

export const USE_CASE_NAMES: Record<UseCase, string> = {
  'portrait': 'Portrait',
  'landscape': 'Landscape',
  'street': 'Street',
  'cinema': 'Cinema',
  'bw': 'B&W',
  'everyday': 'Everyday',
}

export const USE_CASE_ORDER: UseCase[] = [
  'portrait',
  'landscape', 
  'street',
  'cinema',
  'bw',
  'everyday',
]

// Маппинг рецептов по категориям использования
export const RECIPE_USE_CASES: Record<string, UseCase> = {
  // Portrait
  'provia-portrait': 'portrait',
  'astia-portrait': 'portrait',
  'astia-soft-daylight': 'portrait',
  'astia-natural': 'portrait',
  'astia-warm': 'portrait',
  'astia-studio': 'portrait',
  'pro400h-portrait': 'portrait',
  'pro400h-overexposed': 'portrait',
  'pro400h-wedding': 'portrait',
  'portra-vibes': 'portrait',
  
  // Landscape
  'velvia-landscape': 'landscape',
  'velvia-nature': 'landscape',
  'velvia-vibrant': 'landscape',
  'velvia-sunset': 'landscape',
  'vivid-sunset': 'landscape',
  'golden-hour': 'landscape',
  'warm-summer': 'landscape',
  'provia-vivid': 'landscape',
  
  // Street
  'classic-chrome-street': 'street',
  'classic-neg-street': 'street',
  'street-classic': 'street',
  'classic-chrome-vintage': 'street',
  'classic-chrome-faded': 'street',
  'classic-chrome-cool': 'street',
  'classic-chrome-warm': 'street',
  'classic-neg-muted': 'street',
  'classic-neg-soft': 'street',
  'classic-neg-warm': 'street',
  'classic-neg-vibrant': 'street',
  'maple-letter': 'street',
  'faded-memories': 'street',
  'rainy-day': 'street',
  
  // Cinema
  'eterna-cinema': 'cinema',
  'eterna-bleach-bypass': 'cinema',
  'eterna-teal-orange': 'cinema',
  'eterna-muted': 'cinema',
  'eterna-night': 'cinema',
  'moody-chrome': 'cinema',
  'cinematic-teal': 'cinema',
  
  // B&W
  'acros-standard': 'bw',
  'acros-high-contrast': 'bw',
  'acros-soft': 'bw',
  'acros-yellow': 'bw',
  'acros-red': 'bw',
  'neopan-400': 'bw',
  'neopan-1600': 'bw',
  'neopan-contrast': 'bw',
  
  // Everyday
  'superia-400': 'everyday',
  'superia-summer': 'everyday',
  'superia-nostalgic': 'everyday',
  'superia-vintage': 'everyday',
  'superia-daylight': 'everyday',
}

export interface UseCaseGroup {
  useCaseId: UseCase
  useCaseName: string
  recipes: Recipe[]
}

export const getRecipe = (id: string): Recipe | undefined => {
  return RECIPES[id]
}

export const getAllRecipes = (): Recipe[] => {
  return Object.values(RECIPES)
}

export const getSimulationName = (simulationId: string): string => {
  return SIMULATION_NAMES[simulationId] || simulationId
}

export const getRecipesGroupedBySimulation = (): RecipeGroup[] => {
  const groups: Record<string, Recipe[]> = {}
  
  // Группируем рецепты по симуляции
  Object.values(RECIPES).forEach(recipe => {
    const simId = recipe.filmSimulation
    if (!groups[simId]) {
      groups[simId] = []
    }
    groups[simId].push(recipe)
  })
  
  // Возвращаем в заданном порядке
  return SIMULATION_ORDER
    .filter(simId => groups[simId]?.length > 0)
    .map(simId => ({
      simulationId: simId,
      simulationName: SIMULATION_NAMES[simId] || simId,
      recipes: groups[simId]
    }))
}

export const getRecipesGroupedByUseCase = (): UseCaseGroup[] => {
  const groups: Record<UseCase, Recipe[]> = {
    portrait: [],
    landscape: [],
    street: [],
    cinema: [],
    bw: [],
    everyday: [],
  }
  
  // Группируем рецепты по категории использования
  Object.entries(RECIPES).forEach(([id, recipe]) => {
    const useCase = RECIPE_USE_CASES[id] || 'everyday'
    groups[useCase].push(recipe)
  })
  
  // Возвращаем в заданном порядке
  return USE_CASE_ORDER
    .filter(useCaseId => groups[useCaseId]?.length > 0)
    .map(useCaseId => ({
      useCaseId,
      useCaseName: USE_CASE_NAMES[useCaseId],
      recipes: groups[useCaseId]
    }))
}
