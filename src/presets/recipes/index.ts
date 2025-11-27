import { Recipe } from '../../engine/types'
import mapleLetterData from './maple-letter.json'
import vividSunsetData from './vivid-sunset.json'
import moodyChromeData from './moody-chrome.json'

export const RECIPES: Record<string, Recipe> = {
  'maple-letter': mapleLetterData as Recipe,
  'vivid-sunset': vividSunsetData as Recipe,
  'moody-chrome': moodyChromeData as Recipe,
}

export const getRecipe = (id: string): Recipe | undefined => {
  return RECIPES[id]
}

export const getAllRecipes = (): Recipe[] => {
  return Object.values(RECIPES)
}

