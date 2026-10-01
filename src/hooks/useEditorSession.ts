import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ImageItem, Recipe, RecipeSettings } from '../engine/types'
import {
  activeEditorSession,
  beginCropSession,
  beginTuningSession,
  editOwner,
  editorSessionChanges,
  setCropRatio,
  updateCropSession,
  updateTuningSession,
  selectTuningProfile,
  restoreTuningBase,
  type EditorSession,
} from '../engine/editor-sessions'
import { nextQuarterTurn, renderImageTransform, toggleHorizontalFlip, type ImageTransformState } from '../engine/transform'

/**
 * ImageItem owns committed edits. This hook owns at most one temporary draft;
 * it never writes that draft back while a slider, crop, or desktop inspector
 * is being edited. Switching photos/presets discards the old draft.
 */
export function useEditorSession(
  image: ImageItem,
  onImageUpdate: (id: string, updates: Partial<ImageItem>) => void,
) {
  const [draft, setDraft] = useState<EditorSession | null>(null)
  const owner = editOwner(image)
  const session = activeEditorSession(draft, owner)
  const settings = session?.kind === 'tuning' ? session.draft : image.customSettings
  const profile = session?.kind === 'tuning' ? session.profile : image.recipe
  const transformState = session?.kind === 'crop' ? session.draft : image.transform
  const transformedThumbnail = useMemo(() => (
    transformState === image.transform
      ? image.transformedThumbnail
      : renderImageTransform(image.thumbnail, transformState)
  ), [image.thumbnail, image.transform, image.transformedThumbnail, transformState])

  useEffect(() => setDraft(null), [image.id, image.recipe?.id])

  const cancel = useCallback(() => setDraft(null), [])

  const commit = () => {
    const changes = editorSessionChanges(session, owner)
    if (changes) {
      if ('transform' in changes) {
        onImageUpdate(image.id, {
          ...changes,
          transformedThumbnail,
        })
      } else {
        onImageUpdate(image.id, changes)
      }
    }
    setDraft(null)
  }

  const changeCrop = (update: Partial<ImageTransformState>) => {
    setDraft(previous => {
      const current = activeEditorSession(previous, owner)
      if (current?.kind !== 'crop') return current
      const next = update.cropRatio === undefined ? current : setCropRatio(current, update.cropRatio)
      return updateCropSession(next, update)
    })
  }

  const changeGeometry = (update: Partial<ImageTransformState>) => {
    if (session?.kind === 'crop') {
      changeCrop(update)
      return
    }
    const next = { ...image.transform, ...update }
    onImageUpdate(image.id, {
      transform: next,
      transformedThumbnail: renderImageTransform(image.thumbnail, next),
    })
  }

  return {
    session,
    settings,
    profile,
    transformState,
    transformedThumbnail,
    cancel,
    commit,
    openTuning: () => { if (image.recipe) setDraft(beginTuningSession(owner, image.customSettings, image.recipe)) },
    selectDraftProfile: (next: Recipe) => setDraft(previous => {
      const current = activeEditorSession(previous, owner)
      return current?.kind === 'tuning' ? selectTuningProfile(current, next) : current
    }),
    restoreDraftBase: () => setDraft(previous => {
      const current = activeEditorSession(previous, owner)
      return current?.kind === 'tuning' ? restoreTuningBase(current) : current
    }),
    changeSettings: (next: RecipeSettings) => setDraft(previous => {
      const current = activeEditorSession(previous, owner)
      if (!image.recipe) return current
      const tuning = current?.kind === 'tuning' ? current : beginTuningSession(owner, image.customSettings, image.recipe)
      return updateTuningSession(tuning, next)
    }),
    openCrop: () => setDraft(beginCropSession(owner, image.transform)),
    changeCrop,
    rotate: (angle: 90 | 270) => changeGeometry({
      quarterTurns: angle === 90 ? nextQuarterTurn(transformState.quarterTurns)
        : ((transformState.quarterTurns + angle) % 360) as ImageTransformState['quarterTurns'],
    }),
    flip: () => changeGeometry({ flipHorizontal: toggleHorizontalFlip(transformState).flipHorizontal }),

  }
}
