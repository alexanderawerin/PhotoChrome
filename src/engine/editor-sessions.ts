import type { ImageItem, Recipe, RecipeSettings } from './types'
import { getBaseFilm } from './film-profiles'
import {
  clampFineAngle,
  createDefaultTransformState,
  type AspectRatio,
  type ImageTransformState,
  type NormalizedCropRect,
} from './transform'

export interface EditOwner {
  imageId: string
  recipeId: string | null
}

export interface CropSession {
  kind: 'crop'
  owner: EditOwner
  draft: ImageTransformState
}

export interface TuningSession {
  kind: 'tuning'
  owner: EditOwner
  draft: RecipeSettings
  profile: Recipe | null
}

export type EditorSession = TuningSession | CropSession

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
): { customSettings: RecipeSettings; recipe?: Recipe | null } | { transform: ImageTransformState } | null {
  const active = activeEditorSession(session, owner)
  if (!active) return null
  return active.kind === 'crop'
    ? { transform: cloneTransform(active.draft) }
    : { recipe: cloneProfile(active.profile), customSettings: cloneSettings(active.draft) }
}

export function beginTuningSession(owner: EditOwner, settings: RecipeSettings, profile: Recipe | null = null): TuningSession {
  return { kind: 'tuning', owner: { ...owner }, draft: cloneSettings(settings), profile: cloneProfile(profile) }
}

/** Recipe previews retain committed ownership while replacing the color draft. */
export function selectTuningProfile(session: TuningSession, profile: Recipe): TuningSession {
  if (!session.profile || profile.filmSimulation !== session.profile.filmSimulation) return session
  return { ...session, profile: cloneProfile(profile), draft: {} }
}

export function restoreTuningBase(session: TuningSession): TuningSession {
  const base = session.profile && getBaseFilm(session.profile.filmSimulation)
  return base ? selectTuningProfile(session, base) : session
}

const cloneProfile = (profile: Recipe | null): Recipe | null => profile ? { ...profile, settings: { ...profile.settings } } : null

export function updateTuningSession(session: TuningSession, settings: RecipeSettings): TuningSession {
  return { ...session, draft: cloneSettings(settings) }
}

const cloneSettings = (settings: RecipeSettings): RecipeSettings => ({ ...settings })

export function beginCropSession(owner: EditOwner, transform: ImageTransformState): CropSession {
  return { kind: 'crop', owner, draft: cloneTransform(transform) }
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

function normalizeTransform(transform: ImageTransformState): ImageTransformState {
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
