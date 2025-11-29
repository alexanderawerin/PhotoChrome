import { Recipe } from '../../engine/types'
import { parseRecipe } from '../../engine/schemas'

// Classic Negative
import mapleLetterData from './maple-letter.json'
import classicNegMutedData from './classic-neg-muted.json'
import classicNegSoftData from './classic-neg-soft.json'
import classicNegStreetData from './classic-neg-street.json'

// Classic Chrome
import moodyChromeData from './moody-chrome.json'
import cinematicTealData from './cinematic-teal.json'
import classicChromeWarmData from './classic-chrome-warm.json'
import classicChromeFadedData from './classic-chrome-faded.json'
import classicChromeCoolData from './classic-chrome-cool.json'
import streetClassicData from './street-classic.json'
import rainyDayData from './rainy-day.json'

// Velvia
import vividSunsetData from './vivid-sunset.json'
import warmSummerData from './warm-summer.json'
import velviaSunsetData from './velvia-sunset.json'
import velviaNatureData from './velvia-nature.json'
import goldenHourData from './golden-hour.json'

// Provia
import portraVibesData from './portra-vibes.json'
import proviaPortraitData from './provia-portrait.json'
import proviaCleanData from './provia-clean.json'
import fadedMemoriesData from './faded-memories.json'

// Acros (B&W)
import acrosStandardData from './acros-standard.json'
import acrosHighContrastData from './acros-high-contrast.json'
import acrosSoftData from './acros-soft.json'

// Astia
import astiaPortraitData from './astia-portrait.json'
import astiaSoftDaylightData from './astia-soft-daylight.json'

// Pro 400H
import pro400hPortraitData from './pro400h-portrait.json'
import pro400hOverexposedData from './pro400h-overexposed.json'
import pro400hWeddingData from './pro400h-wedding.json'

// Superia
import superia400Data from './superia-400.json'
import superiaSummerData from './superia-summer.json'
import superiaNostalgicData from './superia-nostalgic.json'

// Eterna (Cinema)
import eternaCinemaData from './eterna-cinema.json'
import eternaBleachBypassData from './eterna-bleach-bypass.json'
import eternaTealOrangeData from './eterna-teal-orange.json'

/**
 * Raw recipe data organized by ID.
 * Will be validated and parsed at module load time.
 */
const RAW_RECIPES: Record<string, unknown> = {
  // Classic Negative based
  'maple-letter': mapleLetterData,
  'classic-neg-muted': classicNegMutedData,
  'classic-neg-soft': classicNegSoftData,
  'classic-neg-street': classicNegStreetData,
  
  // Classic Chrome based
  'moody-chrome': moodyChromeData,
  'cinematic-teal': cinematicTealData,
  'classic-chrome-warm': classicChromeWarmData,
  'classic-chrome-faded': classicChromeFadedData,
  'classic-chrome-cool': classicChromeCoolData,
  'street-classic': streetClassicData,
  'rainy-day': rainyDayData,
  
  // Velvia based
  'vivid-sunset': vividSunsetData,
  'warm-summer': warmSummerData,
  'velvia-sunset': velviaSunsetData,
  'velvia-nature': velviaNatureData,
  'golden-hour': goldenHourData,
  
  // Provia based
  'portra-vibes': portraVibesData,
  'provia-portrait': proviaPortraitData,
  'provia-clean': proviaCleanData,
  'faded-memories': fadedMemoriesData,

  // Acros (B&W) based
  'acros-standard': acrosStandardData,
  'acros-high-contrast': acrosHighContrastData,
  'acros-soft': acrosSoftData,

  // Astia based
  'astia-portrait': astiaPortraitData,
  'astia-soft-daylight': astiaSoftDaylightData,

  // Pro 400H based
  'pro400h-portrait': pro400hPortraitData,
  'pro400h-overexposed': pro400hOverexposedData,
  'pro400h-wedding': pro400hWeddingData,

  // Superia based
  'superia-400': superia400Data,
  'superia-summer': superiaSummerData,
  'superia-nostalgic': superiaNostalgicData,

  // Eterna (Cinema) based
  'eterna-cinema': eternaCinemaData,
  'eterna-bleach-bypass': eternaBleachBypassData,
  'eterna-teal-orange': eternaTealOrangeData,
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
