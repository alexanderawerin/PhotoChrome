import type { ExifSubset } from '../exif'

export type HueWeight = { hue: number; weight: number }

export type PhotoFeatures = {
  brightness: number
  contrast: number
  shadowsRatio: number
  highlightsRatio: number
  warmth: number
  saturation: number
  dominantHues: HueWeight[]
  isLowKey: boolean
  isHighKey: boolean
  isMonochromatic: boolean
  isHighContrast: boolean
  exif?: ExifSubset
}

export type Reason = {
  factor: string
  weight: number
  label: string
}

export type ScoredRecipe = {
  recipeId: string
  score: number
  reasons: Reason[]
}
