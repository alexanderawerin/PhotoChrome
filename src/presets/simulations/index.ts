import { FilmSimulation } from '../../engine/types'
import { parseFilmSimulation } from '../../engine/schemas'
import { HaldCLUT, parseHaldCLUT } from '../../engine/haldclut'
import proviaData from './provia.json'
import velviaData from './velvia.json'
import classicChromeData from './classic-chrome.json'
import classicNegData from './classic-neg.json'
import acrosData from './acros.json'
import neopanData from './neopan.json'
import astiaData from './astia.json'
import pro400hData from './pro-400h.json'
import superiaData from './superia.json'
import eternaData from './eterna.json'

// LUT PNG URLs (Vite resolves these at build time)
import lutProviaUrl from './lut/provia.png'
import lutVelviaUrl from './lut/velvia.png'
import lutAstiaUrl from './lut/astia.png'
import lutClassicChromeUrl from './lut/classic-chrome.png'
import lutAcrosUrl from './lut/acros.png'
import lutNeopanUrl from './lut/neopan.png'
import lutSuperiaUrl from './lut/superia.png'
import lutPro400hUrl from './lut/pro400h.png'

const lutUrls: Record<string, string> = {
  provia: lutProviaUrl,
  velvia: lutVelviaUrl,
  astia: lutAstiaUrl,
  'classic-chrome': lutClassicChromeUrl,
  acros: lutAcrosUrl,
  neopan: lutNeopanUrl,
  superia: lutSuperiaUrl,
  'pro-400h': lutPro400hUrl,
}

/**
 * Parses and validates all simulation JSON files at module load time.
 * Throws early if any simulation data is invalid.
 */
function loadSimulations(): Record<string, FilmSimulation> {
  const rawSimulations = {
    // Цветные позитивные (Reversal)
    provia: proviaData,
    velvia: velviaData,
    astia: astiaData,
    // Цветные негативные (Color Negative)
    'pro-400h': pro400hData,
    superia: superiaData,
    // Черно-белые
    acros: acrosData,
    neopan: neopanData,
    // Кинопленки
    eterna: eternaData,
    // Цифровые симуляции Fujifilm
    'classic-chrome': classicChromeData,
    'classic-neg': classicNegData,
  }

  const parsed: Record<string, FilmSimulation> = {}

  for (const [key, data] of Object.entries(rawSimulations)) {
    try {
      parsed[key] = parseFilmSimulation(data)
    } catch (err) {
      console.error(`Failed to parse simulation "${key}":`, err)
      throw new Error(`Invalid simulation data for "${key}": ${err instanceof Error ? err.message : 'unknown error'}`)
    }
  }

  return parsed
}

/** All available film simulations, validated at load time */
export const SIMULATIONS: Record<string, FilmSimulation> = loadSimulations()

/**
 * Gets a simulation by its ID.
 * @returns The simulation or undefined if not found
 */
export const getSimulation = (id: string): FilmSimulation | undefined => {
  return SIMULATIONS[id]
}

/**
 * Gets all available simulations.
 */
export const getAllSimulations = (): FilmSimulation[] => {
  return Object.values(SIMULATIONS)
}

// ============================================================================
// HaldCLUT loading (lazy, cached)
// ============================================================================

const lutCache = new Map<string, HaldCLUT>()
const lutLoading = new Map<string, Promise<HaldCLUT | null>>()

/**
 * Load an image URL as ImageData via Canvas.
 */
function loadImageAsImageData(url: string): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) return reject(new Error('Failed to get canvas context'))
      ctx.drawImage(img, 0, 0)
      resolve(ctx.getImageData(0, 0, img.width, img.height))
    }
    img.onerror = () => reject(new Error(`Failed to load LUT image: ${url}`))
    img.src = url
  })
}

/**
 * Load the HaldCLUT for a simulation by its ID.
 * Returns cached result on subsequent calls. Returns null if no LUT is available.
 */
export async function loadSimulationLUT(simulationId: string): Promise<HaldCLUT | null> {
  // Already cached
  if (lutCache.has(simulationId)) {
    return lutCache.get(simulationId)!
  }

  // Already loading — deduplicate
  if (lutLoading.has(simulationId)) {
    return lutLoading.get(simulationId)!
  }

  const simulation = SIMULATIONS[simulationId]
  if (!simulation?.lutImage) {
    return null
  }

  // Get pre-resolved URL for this simulation's LUT
  const url = lutUrls[simulationId]
  if (!url) {
    console.warn(`LUT URL not found for "${simulationId}"`)
    return null
  }

  const promise = (async () => {
    try {
      const imageData = await loadImageAsImageData(url)
      const lut = parseHaldCLUT(imageData)
      lutCache.set(simulationId, lut)
      return lut
    } catch (err) {
      console.warn(`Failed to load LUT for "${simulationId}":`, err)
      return null
    } finally {
      lutLoading.delete(simulationId)
    }
  })()

  lutLoading.set(simulationId, promise)
  return promise
}

/**
 * Get the cached HaldCLUT for a simulation (synchronous, returns null if not loaded yet).
 */
export function getCachedLUT(simulationId: string): HaldCLUT | null {
  return lutCache.get(simulationId) ?? null
}
