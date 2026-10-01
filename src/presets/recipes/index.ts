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
  const ids = new Set<string>()
  
  for (const [key, data] of Object.entries(RAW_RECIPES)) {
    try {
      const recipe = parseRecipe(data)
      if (recipe.id !== key) {
        throw new Error(`recipe id "${recipe.id}" does not match registry key "${key}"`)
      }
      if (ids.has(recipe.id)) {
        throw new Error(`duplicate recipe id "${recipe.id}"`)
      }
      ids.add(recipe.id)
      parsed[key] = recipe
    } catch (err) {
      console.error(`Failed to parse recipe "${key}":`, err)
      throw new Error(`Invalid recipe data for "${key}": ${err instanceof Error ? err.message : 'unknown error'}`)
    }
  }
  
  return parsed
}

/** All available recipes, validated at load time */
export const RECIPES: Record<string, Recipe> = loadRecipes()

export const getRecipe = (id: string): Recipe | undefined => {
  return RECIPES[id]
}

export const getAllRecipes = (): Recipe[] => {
  return Object.values(RECIPES)
}
