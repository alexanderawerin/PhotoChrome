import type { ImageItem, Recipe, RecipeSettings } from './types'
import {
  clampFineAngle,
  createDefaultTransformState,
  type AspectRatio,
  type ImageTransformState,
  type NormalizedCropRect,
} from './transform'

export type AdjustTool = keyof Pick<RecipeSettings,
  | 'highlight'
  | 'shadow'
  | 'color'
  | 'sharpness'
  | 'clarity'
  | 'wbShiftRed'
  | 'wbShiftBlue'
  | 'grainEffect'
  | 'grainSize'
  | 'colorChromeEffect'
  | 'colorChromeFXBlue'
  | 'dynamicRange'
  | 'whiteBalance'
  | 'whiteBalanceKelvin'
>

export interface EditOwner {
  imageId: string
  recipeId: string | null
}

export interface AdjustSession {
  kind: 'adjust'
  owner: EditOwner
  tool: AdjustTool
  before: RecipeSettings
  draft: RecipeSettings
}

export interface CropSession {
  kind: 'crop'
  owner: EditOwner
  before: ImageTransformState
  draft: ImageTransformState
}

export interface TuningSession {
  kind: 'tuning'
  owner: EditOwner
  before: RecipeSettings
  draft: RecipeSettings
}

export type EditorSession = AdjustSession | TuningSession | CropSession

export function editOwner(image: Pick<ImageItem, 'id' | 'recipe'>): EditOwner {
  return { imageId: image.id, recipeId: image.recipe?.id ?? null }
}

/** A draft cannot follow the user to another photo or another preset. */
export function activeEditorSession(session: EditorSession | null, owner: EditOwner): EditorSession | null {
  return session?.owner.imageId === owner.imageId && session.owner.recipeId === owner.recipeId
    ? session
    : null
}

/** Only the active draft is committed; Cancel simply discards it. */
export function editorSessionChanges(
  session: EditorSession | null,
  owner: EditOwner,
): { customSettings: RecipeSettings } | { transform: ImageTransformState } | null {
  const active = activeEditorSession(session, owner)
  if (!active) return null
  return active.kind === 'crop'
    ? { transform: cloneTransform(active.draft) }
    : { customSettings: cloneSettings(active.draft) }
}

export function beginTuningSession(owner: EditOwner, settings: RecipeSettings): TuningSession {
  return { kind: 'tuning', owner, before: cloneSettings(settings), draft: cloneSettings(settings) }
}

export function updateTuningSession(session: TuningSession, settings: RecipeSettings): TuningSession {
  return { ...session, draft: cloneSettings(settings) }
}

const cloneSettings = (settings: RecipeSettings): RecipeSettings => ({ ...settings })

export function beginAdjustSession(owner: EditOwner, tool: AdjustTool, settings: RecipeSettings): AdjustSession {
  return { kind: 'adjust', owner, tool, before: cloneSettings(settings), draft: cloneSettings(settings) }
}

/** Generates only values accepted by the existing processing pipeline. */
export function createRandomRecipeSettings(random: () => number = Math.random): RecipeSettings {
  const integer = (min: number, max: number) => min + Math.floor(random() * (max - min + 1))
  const choose = <T,>(values: readonly T[]): T => values[Math.min(values.length - 1, Math.floor(random() * values.length))]
  const settings: RecipeSettings = {
    highlight: integer(-2, 4),
    shadow: integer(-2, 4),
    color: integer(-4, 4),
    sharpness: integer(-4, 4),
    clarity: integer(-5, 5),
    wbShiftRed: integer(-9, 9),
    wbShiftBlue: integer(-9, 9),
    grainEffect: choose(['off', 'weak', 'strong'] as const),
    grainSize: choose(['small', 'large'] as const),
    colorChromeEffect: choose(['off', 'weak', 'strong'] as const),
    colorChromeFXBlue: choose(['off', 'weak', 'strong'] as const),
    dynamicRange: choose(['DR100', 'DR200', 'DR400'] as const),
  }
  if (random() < 0.5) {
    settings.whiteBalance = choose(['auto', 'daylight', 'shade', 'cloudy', 'tungsten', 'fluorescent'] as const)
  } else {
    settings.whiteBalanceKelvin = integer(2500, 10000)
  }
  return settings
}

export function updateAdjustSession(
  session: AdjustSession,
  value: RecipeSettings[AdjustTool],
): AdjustSession {
  const draft = { ...session.draft, [session.tool]: value }
  if (session.tool === 'whiteBalance') delete draft.whiteBalanceKelvin
  if (session.tool === 'whiteBalanceKelvin') delete draft.whiteBalance
  return { ...session, draft }
}

export function resetAdjustSession(session: AdjustSession, recipe: Recipe): AdjustSession {
  const draft = { ...session.draft }
  const recipeValue = recipe.settings[session.tool]
  if (recipeValue === undefined) delete draft[session.tool]
  else Object.assign(draft, { [session.tool]: recipeValue })
  if (session.tool === 'whiteBalance') delete draft.whiteBalanceKelvin
  if (session.tool === 'whiteBalanceKelvin') delete draft.whiteBalance
  return { ...session, draft }
}

export function beginCropSession(owner: EditOwner, transform: ImageTransformState): CropSession {
  return { kind: 'crop', owner, before: cloneTransform(transform), draft: cloneTransform(transform) }
}

export function updateCropSession(
  session: CropSession,
  update: Partial<ImageTransformState>,
): CropSession {
  return {
    ...session,
    draft: normalizeTransform({ ...session.draft, ...update }),
  }
}

export function normalizeTransform(transform: ImageTransformState): ImageTransformState {
  return {
    ...transform,
    fineAngle: clampFineAngle(transform.fineAngle),
    cropScale: Math.max(1, transform.cropScale),
    cropOffset: {
      x: clamp01(transform.cropOffset.x),
      y: clamp01(transform.cropOffset.y),
    },
    cropRect: normalizeCropRect(transform.cropRect),
  }
}

export function setCropRatio(session: CropSession, ratio: AspectRatio): CropSession {
  return updateCropSession(session, {
    cropRatio: ratio,
    cropRect: ratio === 'free'
      ? session.draft.cropRect
      : createDefaultTransformState().cropRect,
  })
}

function cloneTransform(transform: ImageTransformState): ImageTransformState {
  return {
    ...transform,
    cropOffset: { ...transform.cropOffset },
    cropRect: { ...transform.cropRect },
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function normalizeCropRect(rect: NormalizedCropRect): NormalizedCropRect {
  const x = Math.min(0.99, clamp01(rect.x))
  const y = Math.min(0.99, clamp01(rect.y))
  return {
    x,
    y,
    width: Math.max(0.01, Math.min(1 - x, rect.width)),
    height: Math.max(0.01, Math.min(1 - y, rect.height)),
  }
}
