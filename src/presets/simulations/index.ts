import { FilmSimulation } from '../../engine/types'
import { parseFilmSimulation } from '../../engine/schemas'
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

