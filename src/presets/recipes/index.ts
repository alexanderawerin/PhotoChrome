import { Recipe } from '../../engine/types'

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

export const RECIPES: Record<string, Recipe> = {
  // Classic Negative based
  'maple-letter': mapleLetterData as Recipe,
  'classic-neg-muted': classicNegMutedData as Recipe,
  'classic-neg-soft': classicNegSoftData as Recipe,
  'classic-neg-street': classicNegStreetData as Recipe,
  
  // Classic Chrome based
  'moody-chrome': moodyChromeData as Recipe,
  'cinematic-teal': cinematicTealData as Recipe,
  'classic-chrome-warm': classicChromeWarmData as Recipe,
  'classic-chrome-faded': classicChromeFadedData as Recipe,
  'classic-chrome-cool': classicChromeCoolData as Recipe,
  'street-classic': streetClassicData as Recipe,
  'rainy-day': rainyDayData as Recipe,
  
  // Velvia based
  'vivid-sunset': vividSunsetData as Recipe,
  'warm-summer': warmSummerData as Recipe,
  'velvia-sunset': velviaSunsetData as Recipe,
  'velvia-nature': velviaNatureData as Recipe,
  'golden-hour': goldenHourData as Recipe,
  
  // Provia based
  'portra-vibes': portraVibesData as Recipe,
  'provia-portrait': proviaPortraitData as Recipe,
  'provia-clean': proviaCleanData as Recipe,
  'faded-memories': fadedMemoriesData as Recipe,
}

// Названия симуляций для отображения
export const SIMULATION_NAMES: Record<string, string> = {
  'classic-neg': 'Classic Neg.',
  'classic-chrome': 'Classic Chrome',
  'velvia': 'Velvia',
  'provia': 'Provia',
}

// Порядок отображения групп
export const SIMULATION_ORDER = ['classic-neg', 'classic-chrome', 'velvia', 'provia']

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
