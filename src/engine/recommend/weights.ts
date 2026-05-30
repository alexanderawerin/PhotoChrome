export const USE_CASE_FIT_BONUS = 0.4
export const FILM_FIT_BONUS = 0.4
export const FILM_FALLBACK_BONUS = 0.1
export const RECIPE_SPECIFIC_BONUS = 0.08

export const THRESHOLDS = {
  warmthWarm: 0.3,
  warmthSlight: 0.1,
  warmthMild: 0.2,
  saturationHigh: 0.5,
  saturationVibrant: 0.4,
  saturationMuted: 0.3,
  saturationMidLow: 0.2,
  contrastMid: 0.4,
  contrastLow: 0.3,
  highlightsRecover: 0.15,
  shadowsRecover: 0.1,
  isoHigh: 1600,
  kelvinTolerance: 500,
  monochromatic: 0.1,
  dominantHueCountHigh: 3,
}

export const DIVERSITY = {
  lambda: 0.8,
  sameFilmPenalty: 0.7,
  sameUseCasePenalty: 0.5,
}

export const PICKS_COUNT = 5
export const CANDIDATE_POOL_SIZE = 15
