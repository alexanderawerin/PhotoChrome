import { Recipe } from '../../engine/types'
import { parseRecipe } from '../../engine/schemas'

// Provia
import proviaPortraitData from './provia-portrait.json'
import portraVibesData from './portra-vibes.json'
import proviaVividData from './provia-vivid.json'
import proviaSlideData from './provia-slide.json'
import proviaLightData from './provia-daylight.json'
import proviaVibrantData from './provia-vibrant.json'
import proviaFilmData from './provia-film.json'
import proviaAfternoonData from './provia-afternoon.json'

// Velvia
import vividSunsetData from './vivid-sunset.json'
import warmSummerData from './warm-summer.json'
import velviaSunsetData from './velvia-sunset.json'
import velviaNatureData from './velvia-nature.json'
import goldenHourData from './golden-hour.json'
import velviaVibrantData from './velvia-vibrant.json'
import velviaLandscapeData from './velvia-landscape.json'
import velviaVividChromeData from './velvia-vivid-chrome.json'
import velviaVividData from './velvia-vivid.json'
import velviaDramaticData from './velvia-dramatic.json'
import velviaSoftData from './velvia-soft.json'
import velviaCoolData from './velvia-cool.json'

// Astia
import astiaPortraitData from './astia-portrait.json'
import astiaSoftDaylightData from './astia-soft-daylight.json'
import astiaNaturalData from './astia-natural.json'
import astiaWarmData from './astia-warm.json'
import astiaStudioData from './astia-studio.json'
import astiaCineStillData from './astia-cinestill.json'
import astiaEverydayData from './astia-everyday.json'
import astiaLightData from './astia-light.json'

// Pro 400H
import pro400hPortraitData from './pro400h-portrait.json'
import pro400hOverexposedData from './pro400h-overexposed.json'
import pro400hWeddingData from './pro400h-wedding.json'
import pro400hSummerData from './pro400h-summer.json'
import pro400hCinematicData from './pro400h-cinematic.json'
import pro400hPastelData from './pro400h-pastel.json'
import pro400hSkinData from './pro400h-skin.json'
import pro400hCoolData from './pro400h-cool.json'

// Superia
import superia400Data from './superia-400.json'
import superiaSummerData from './superia-summer.json'
import superiaNostalgicData from './superia-nostalgic.json'
import superiaVintageData from './superia-vintage.json'
import superiaDaylightData from './superia-daylight.json'
import superiaPortraitData from './superia-portrait.json'
import superiaTravelData from './superia-travel.json'
import superiaGrainData from './superia-grain.json'

// Acros (B&W)
import acrosStandardData from './acros-standard.json'
import acrosHighContrastData from './acros-high-contrast.json'
import acrosSoftData from './acros-soft.json'
import acrosYellowData from './acros-yellow.json'
import acrosRedData from './acros-red.json'
import acrosMoodyData from './acros-moody.json'
import acrosNaturalData from './acros-natural.json'

// Neopan (B&W)
import neopan400Data from './neopan-400.json'
import neopan1600Data from './neopan-1600.json'
import neopanContrastData from './neopan-contrast.json'
import neopanDocumentaryData from './neopan-documentary.json'
import neopanFineArtData from './neopan-fine-art.json'
import neopanPortraitData from './neopan-portrait.json'
import neopanStreetData from './neopan-street.json'
import neopanClassicData from './neopan-classic.json'

// Eterna (Cinema)
import eternaCinemaData from './eterna-cinema.json'
import eternaBleachBypassData from './eterna-bleach-bypass.json'
import eternaTealOrangeData from './eterna-teal-orange.json'
import eternaMutedData from './eterna-muted.json'
import eternaNightData from './eterna-night.json'
import eternaSummerData from './eterna-summer.json'
import eternaTimelessData from './eterna-timeless.json'

// Classic Chrome
import moodyChromeData from './moody-chrome.json'
import cinematicTealData from './cinematic-teal.json'
import classicChromeWarmData from './classic-chrome-warm.json'
import classicChromeFadedData from './classic-chrome-faded.json'
import classicChromeCoolData from './classic-chrome-cool.json'
import streetClassicData from './street-classic.json'
import rainyDayData from './rainy-day.json'
import classicChromeStreetData from './classic-chrome-street.json'
import classicChromeVintageData from './classic-chrome-vintage.json'
import classicColorData from './classic-color.json'
import kodakEmulsionData from './kodak-emulsion.json'
import kodakPortra800Data from './kodak-portra-800.json'
import chromePortraitData from './chrome-portrait.json'
import chromeNaturalData from './chrome-natural.json'
import chromeEverydayData from './chrome-everyday.json'

// Classic Negative
import mapleLetterData from './maple-letter.json'
import classicNegMutedData from './classic-neg-muted.json'
import classicNegSoftData from './classic-neg-soft.json'
import classicNegStreetData from './classic-neg-street.json'
import fadedMemoriesData from './faded-memories.json'
import classicNegWarmData from './classic-neg-warm.json'
import classicNegVibrantData from './classic-neg-vibrant.json'
import classicAmberData from './classic-amber.json'
import retroFujicolorData from './retro-fujicolor.json'
import classicNegEverydayData from './classic-neg-everyday.json'
import classicNegPortraitData from './classic-neg-portrait.json'
import classicNegCinemaData from './classic-neg-cinema.json'

// Superia (additional)
import reggiesuperiaData from './reggies-superia.json'
import fujicolorSuperia100Data from './fujicolor-superia-100.json'

// Eterna (Cinema) - additional
import eternaWarmNegData from './eterna-warm-neg.json'
import eternaGrainData from './eterna-grain.json'

// Acros (B&W) - additional
import acrosFilmGrainData from './acros-film-grain.json'
import acrosKodakTmaxData from './acros-kodak-tmax.json'
import acrosStreetGrainData from './acros-street-grain.json'

/**
 * Raw recipe data organized by ID.
 * Will be validated and parsed at module load time.
 */
const RAW_RECIPES: Record<string, unknown> = {
  // Provia
  'provia-portrait': proviaPortraitData,
  'portra-vibes': portraVibesData,
  'provia-vivid': proviaVividData,
  'provia-slide': proviaSlideData,
  'provia-daylight': proviaLightData,
  'provia-vibrant': proviaVibrantData,
  'provia-film': proviaFilmData,
  'provia-afternoon': proviaAfternoonData,

  // Velvia
  'vivid-sunset': vividSunsetData,
  'warm-summer': warmSummerData,
  'velvia-sunset': velviaSunsetData,
  'velvia-nature': velviaNatureData,
  'golden-hour': goldenHourData,
  'velvia-vibrant': velviaVibrantData,
  'velvia-landscape': velviaLandscapeData,
  'velvia-vivid-chrome': velviaVividChromeData,
  'velvia-vivid': velviaVividData,
  'velvia-dramatic': velviaDramaticData,
  'velvia-soft': velviaSoftData,
  'velvia-cool': velviaCoolData,
  
  // Astia
  'astia-portrait': astiaPortraitData,
  'astia-soft-daylight': astiaSoftDaylightData,
  'astia-natural': astiaNaturalData,
  'astia-warm': astiaWarmData,
  'astia-studio': astiaStudioData,
  'astia-cinestill': astiaCineStillData,
  'astia-everyday': astiaEverydayData,
  'astia-light': astiaLightData,

  // Pro 400H
  'pro400h-portrait': pro400hPortraitData,
  'pro400h-overexposed': pro400hOverexposedData,
  'pro400h-wedding': pro400hWeddingData,
  'pro400h-summer': pro400hSummerData,
  'pro400h-cinematic': pro400hCinematicData,
  'pro400h-pastel': pro400hPastelData,
  'pro400h-skin': pro400hSkinData,
  'pro400h-cool': pro400hCoolData,

  // Superia
  'superia-400': superia400Data,
  'superia-summer': superiaSummerData,
  'superia-nostalgic': superiaNostalgicData,
  'superia-vintage': superiaVintageData,
  'superia-daylight': superiaDaylightData,
  'superia-portrait': superiaPortraitData,
  'superia-travel': superiaTravelData,
  'superia-grain': superiaGrainData,

  // Acros (B&W)
  'acros-standard': acrosStandardData,
  'acros-high-contrast': acrosHighContrastData,
  'acros-soft': acrosSoftData,
  'acros-yellow': acrosYellowData,
  'acros-red': acrosRedData,
  'acros-moody': acrosMoodyData,
  'acros-natural': acrosNaturalData,

  // Neopan (B&W)
  'neopan-400': neopan400Data,
  'neopan-1600': neopan1600Data,
  'neopan-contrast': neopanContrastData,
  'neopan-documentary': neopanDocumentaryData,
  'neopan-fine-art': neopanFineArtData,
  'neopan-portrait': neopanPortraitData,
  'neopan-street': neopanStreetData,
  'neopan-classic': neopanClassicData,

  // Eterna (Cinema)
  'eterna-cinema': eternaCinemaData,
  'eterna-bleach-bypass': eternaBleachBypassData,
  'eterna-teal-orange': eternaTealOrangeData,
  'eterna-muted': eternaMutedData,
  'eterna-night': eternaNightData,
  'eterna-summer': eternaSummerData,
  'eterna-timeless': eternaTimelessData,

  // Classic Chrome
  'moody-chrome': moodyChromeData,
  'cinematic-teal': cinematicTealData,
  'classic-chrome-warm': classicChromeWarmData,
  'classic-chrome-faded': classicChromeFadedData,
  'classic-chrome-cool': classicChromeCoolData,
  'street-classic': streetClassicData,
  'rainy-day': rainyDayData,
  'classic-chrome-street': classicChromeStreetData,
  'classic-chrome-vintage': classicChromeVintageData,
  'classic-color': classicColorData,
  'kodak-emulsion': kodakEmulsionData,
  'kodak-portra-800': kodakPortra800Data,
  'chrome-portrait': chromePortraitData,
  'chrome-natural': chromeNaturalData,
  'chrome-everyday': chromeEverydayData,

  // Classic Negative
  'maple-letter': mapleLetterData,
  'classic-neg-muted': classicNegMutedData,
  'classic-neg-soft': classicNegSoftData,
  'classic-neg-street': classicNegStreetData,
  'faded-memories': fadedMemoriesData,
  'classic-neg-warm': classicNegWarmData,
  'classic-neg-vibrant': classicNegVibrantData,
  'classic-amber': classicAmberData,
  'retro-fujicolor': retroFujicolorData,
  'classic-neg-everyday': classicNegEverydayData,
  'classic-neg-portrait': classicNegPortraitData,
  'classic-neg-cinema': classicNegCinemaData,

  // Superia (additional)
  'reggies-superia': reggiesuperiaData,
  'fujicolor-superia-100': fujicolorSuperia100Data,

  // Eterna (Cinema) (additional)
  'eterna-warm-neg': eternaWarmNegData,
  'eterna-grain': eternaGrainData,

  // Acros (B&W) (additional)
  'acros-film-grain': acrosFilmGrainData,
  'acros-kodak-tmax': acrosKodakTmaxData,
  'acros-street-grain': acrosStreetGrainData,
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
  'astia-cinestill': 'portrait',
  'pro400h-portrait': 'portrait',
  'pro400h-overexposed': 'portrait',
  'pro400h-wedding': 'portrait',
  'portra-vibes': 'portrait',
  'provia-slide': 'portrait',
  'pro400h-summer': 'portrait',
  'pro400h-pastel': 'portrait',
  'pro400h-skin': 'portrait',
  'superia-portrait': 'portrait',
  'chrome-portrait': 'portrait',

  // Landscape
  'velvia-landscape': 'landscape',
  'velvia-vivid-chrome': 'landscape',
  'velvia-vivid': 'landscape',
  'velvia-dramatic': 'landscape',
  'velvia-cool': 'landscape',
  'velvia-nature': 'landscape',
  'velvia-vibrant': 'landscape',
  'velvia-sunset': 'landscape',
  'vivid-sunset': 'landscape',
  'golden-hour': 'landscape',
  'warm-summer': 'landscape',
  'provia-vivid': 'landscape',
  'provia-daylight': 'landscape',
  'provia-vibrant': 'landscape',
  'superia-travel': 'landscape',
  
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
  'kodak-emulsion': 'street',
  'classic-amber': 'street',
  
  // Cinema
  'eterna-cinema': 'cinema',
  'eterna-bleach-bypass': 'cinema',
  'eterna-teal-orange': 'cinema',
  'eterna-muted': 'cinema',
  'eterna-night': 'cinema',
  'eterna-summer': 'cinema',
  'eterna-timeless': 'cinema',
  'moody-chrome': 'cinema',
  'cinematic-teal': 'cinema',
  'pro400h-cinematic': 'cinema',
  'eterna-warm-neg': 'cinema',
  'eterna-grain': 'cinema',
  
  // B&W
  'acros-standard': 'bw',
  'acros-high-contrast': 'bw',
  'acros-soft': 'bw',
  'acros-yellow': 'bw',
  'acros-red': 'bw',
  'acros-moody': 'bw',
  'acros-natural': 'bw',
  'neopan-400': 'bw',
  'neopan-1600': 'bw',
  'neopan-contrast': 'bw',
  'neopan-documentary': 'bw',
  'neopan-fine-art': 'bw',
  'neopan-portrait': 'bw',
  'neopan-street': 'bw',
  'acros-film-grain': 'bw',
  'acros-kodak-tmax': 'bw',
  'acros-street-grain': 'bw',
  
  // Everyday
  'superia-400': 'everyday',
  'superia-summer': 'everyday',
  'superia-nostalgic': 'everyday',
  'superia-vintage': 'everyday',
  'superia-daylight': 'everyday',
  'superia-everyday': 'everyday',
  'provia-film': 'everyday',
  'classic-color': 'everyday',
  'chrome-natural': 'everyday',
  'kodak-portra-800': 'cinema',
  'velvia-soft': 'everyday',
  'retro-fujicolor': 'everyday',
  'classic-neg-everyday': 'everyday',
  'fujicolor-superia-100': 'everyday',

  // Portrait (additional)
  'reggies-superia': 'portrait',

  // Batch E additions
  'provia-afternoon': 'landscape',
  'astia-light': 'portrait',
  'pro400h-cool': 'everyday',
  'superia-grain': 'street',
  'neopan-classic': 'bw',
  'chrome-everyday': 'everyday',
  'classic-neg-portrait': 'portrait',
  'classic-neg-cinema': 'cinema',
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
