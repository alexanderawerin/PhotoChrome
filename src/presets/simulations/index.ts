import { FilmSimulation } from '../../engine/types'
import proviaData from './provia.json'
import velviaData from './velvia.json'
import classicChromeData from './classic-chrome.json'
import classicNegData from './classic-neg.json'

export const SIMULATIONS: Record<string, FilmSimulation> = {
  provia: proviaData as FilmSimulation,
  velvia: velviaData as FilmSimulation,
  'classic-chrome': classicChromeData as FilmSimulation,
  'classic-neg': classicNegData as FilmSimulation,
}

export const getSimulation = (id: string): FilmSimulation | undefined => {
  return SIMULATIONS[id]
}

export const getAllSimulations = (): FilmSimulation[] => {
  return Object.values(SIMULATIONS)
}

