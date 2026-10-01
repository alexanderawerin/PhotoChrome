import type { Recipe, RecipeSettings } from './types'

/** The canonical additions for every base film, independent of detailed recipes. */
export const NEUTRAL_FILM_SETTINGS: Readonly<RecipeSettings> = Object.freeze({
  dynamicRange: 'DR100', highlight: 0, shadow: 0, color: 0,
  sharpness: 0, clarity: 0, wbShiftRed: 0, wbShiftBlue: 0,
  grainEffect: 'off', grainSize: 'small', colorChromeEffect: 'off',
  colorChromeFXBlue: 'off', whiteBalance: 'auto',
})

const FILMS = [
  ['provia', 'Provia'], ['velvia', 'Velvia'], ['astia', 'Astia'],
  ['pro-400h', 'Pro 400H'], ['superia', 'Superia'], ['acros', 'Acros'],
  ['neopan', 'Neopan'], ['eterna', 'Eterna'],
  ['classic-chrome', 'Classic Chrome'], ['classic-neg', 'Classic Neg'],
] as const

const BASE_FILMS: Recipe[] = FILMS.map(([filmSimulation, name]) => ({
  id: `base-${filmSimulation}`, name, filmSimulation, profileKind: 'base',
  settings: { ...NEUTRAL_FILM_SETTINGS },
}))

/** Returns profiles separately from the unchanged 100-recipe catalog. */
export function getBaseFilms(): Recipe[] {
  return BASE_FILMS.map(profile => ({ ...profile, settings: { ...profile.settings } }))
}

export function getBaseFilm(simulationId: string): Recipe | undefined {
  return getBaseFilms().find(profile => profile.filmSimulation === simulationId)
}

export function isBaseProfile(profile: Recipe | null | undefined): boolean {
  return profile?.profileKind === 'base'
}

export function getProfileName(profile: Recipe | null): string {
  if (!profile) return 'Original'
  const film = FILMS.find(([id]) => id === profile.filmSimulation)?.[1] ?? profile.filmSimulation
  return isBaseProfile(profile) ? film : `${film} · ${profile.name}`
}

/** Compare effective color values; explicit neutral overrides are not modifications. */
export function hasModifiedSettings(profile: Recipe | null, overrides: RecipeSettings): boolean {
  if (!profile) return false
  const normalize = (settings: RecipeSettings): RecipeSettings => {
    const normalized = { ...NEUTRAL_FILM_SETTINGS }
    for (const key of Object.keys(settings) as (keyof RecipeSettings)[]) {
      if (settings[key] !== undefined) Object.assign(normalized, { [key]: settings[key] })
    }
    if (normalized.grainEffect === 'off') normalized.grainSize = 'small'
    if (normalized.whiteBalanceKelvin !== undefined) normalized.whiteBalance = 'auto'
    return normalized
  }
  const reference = normalize(profile.settings)
  const effective = normalize({ ...profile.settings, ...overrides })
  const keys = new Set([...Object.keys(reference), ...Object.keys(effective)] as (keyof RecipeSettings)[])
  return [...keys].some(key => effective[key] !== reference[key])
}
