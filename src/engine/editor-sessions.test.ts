import { describe, expect, it } from 'vitest'
import {
  activeEditorSession,
  beginAdjustSession,
  beginCropSession,
  beginTuningSession,
  editorSessionChanges,
  resetAdjustSession,
  setCropRatio,
  updateAdjustSession,
  updateCropSession,
  updateTuningSession,
  selectTuningProfile,
  restoreTuningBase,
} from './editor-sessions'
import { createDefaultTransformState } from './transform'
import type { Recipe } from './types'
import { getBaseFilm } from './film-profiles'

const owner = { imageId: 'photo-a', recipeId: 'test' }

const recipe: Recipe = {
  id: 'test',
  name: 'Test',
  filmSimulation: 'provia',
  settings: { highlight: 2, whiteBalance: 'daylight' },
}

describe('adjust sessions', () => {
  it('keeps committed settings unchanged while editing a separate draft', () => {
    const saved = { highlight: -1, color: 2 }
    const session = beginAdjustSession(owner, 'highlight', saved)
    const changed = updateAdjustSession(session, 4)

    expect(saved).toEqual({ highlight: -1, color: 2 })
    expect(session.draft).not.toBe(saved)
    expect(changed.draft).toEqual({ highlight: 4, color: 2 })
  })

  it('resets to the active recipe value instead of zero', () => {
    const session = updateAdjustSession(beginAdjustSession(owner, 'highlight', {}), -2)
    expect(resetAdjustSession(session, recipe).draft.highlight).toBe(2)
  })

  it('keeps White Balance and Temperature mutually exclusive', () => {
    const temperature = updateAdjustSession(
      beginAdjustSession(owner, 'whiteBalanceKelvin', { whiteBalance: 'cloudy' }),
      7200,
    )
    expect(temperature.draft).toEqual({ whiteBalanceKelvin: 7200 })

    const whiteBalance = updateAdjustSession(
      beginAdjustSession(owner, 'whiteBalance', { whiteBalanceKelvin: 7200 }),
      'shade',
    )
    expect(whiteBalance.draft).toEqual({ whiteBalance: 'shade' })
  })
})

describe('crop sessions', () => {
  it('preserves committed geometry while normalizing a separate draft', () => {
    const before = createDefaultTransformState()
    const changed = updateCropSession(beginCropSession(owner, before), {
      fineAngle: 60,
      cropScale: 0.5,
      cropOffset: { x: -1, y: 2 },
    })

    expect(before).toEqual(createDefaultTransformState())
    expect(changed.draft.cropOffset).not.toBe(before.cropOffset)
    expect(changed.draft.cropRect).not.toBe(before.cropRect)
    expect(changed.draft).toMatchObject({
      fineAngle: 45,
      cropScale: 1,
      cropOffset: { x: 0, y: 1 },
    })
  })

  it('retains a free frame but resets it for fixed ratios', () => {
    const free = updateCropSession(beginCropSession(owner, createDefaultTransformState()), {
      cropRect: { x: 0.1, y: 0.2, width: 0.5, height: 0.6 },
    })
    expect(setCropRatio(free, 'free').draft.cropRect).toEqual(free.draft.cropRect)
    expect(setCropRatio(free, '1:1').draft.cropRect).toEqual({ x: 0, y: 0, width: 1, height: 1 })
  })

  it('keeps the free frame inside the image even when dragged to the far corner', () => {
    const changed = updateCropSession(beginCropSession(owner, createDefaultTransformState()), {
      cropRect: { x: 1, y: 1, width: 0.5, height: 0.5 },
    })
    const rect = changed.draft.cropRect
    expect(rect.width).toBeGreaterThan(0)
    expect(rect.height).toBeGreaterThan(0)
    expect(rect.x + rect.width).toBeLessThanOrEqual(1)
    expect(rect.y + rect.height).toBeLessThanOrEqual(1)
  })
})

describe('committing the active photo session', () => {
  it('keeps desktop changes out of committed settings until Apply', () => {
    const saved = { highlight: 1, color: 2 }
    const session = updateTuningSession(beginTuningSession(owner, saved, recipe), { highlight: 4, color: -1 })

    expect(saved).toEqual({ highlight: 1, color: 2 })
    expect(editorSessionChanges(session, owner)).toEqual({ recipe, customSettings: { highlight: 4, color: -1 } })
    expect(editorSessionChanges(null, owner)).toBeNull() // Cancel writes nothing.
  })

  it('previews a film recipe and manual edits together without changing committed ownership', () => {
    const base = getBaseFilm('provia')!
    const baseOwner = { imageId: 'photo-a', recipeId: base.id }
    const saved = { color: 1 }
    const opened = beginTuningSession(baseOwner, saved, base)
    const selected = selectTuningProfile(opened, recipe)
    expect(selected.owner).toEqual(baseOwner)
    expect(selected.profile).toEqual(recipe)
    expect(selected.draft).toEqual({})
    expect(activeEditorSession(selected, baseOwner)).toBe(selected)
    const manual = updateTuningSession(selected, { shadow: 3 })
    expect(editorSessionChanges(manual, baseOwner)).toEqual({ recipe, customSettings: { shadow: 3 } })
    expect(saved).toEqual({ color: 1 })
    expect(base.settings.color).toBe(0)
    expect(editorSessionChanges(null, baseOwner)).toBeNull()
    expect(selectTuningProfile(manual, { ...recipe, id: 'another-recipe' }).draft).toEqual({})
    expect(selectTuningProfile(manual, getBaseFilm('velvia')!)).toBe(manual)
  })

  it('restores the neutral film in the draft and isolates saved snapshots', () => {
    const settings = { color: 2 }
    const opened = beginTuningSession(owner, settings, recipe)
    settings.color = 4
    expect(opened.draft.color).toBe(2)
    const restored = restoreTuningBase(opened)
    expect(restored.owner).toEqual(owner)
    expect(restored.profile).toEqual(getBaseFilm('provia'))
    expect(restored.draft).toEqual({})
    const changes = editorSessionChanges(restored, owner)
    if (!changes || !('customSettings' in changes) || !changes.recipe) throw new Error('Missing applied color snapshot')
    changes.recipe.settings.color = 4
    expect(restored.profile?.settings.color).toBe(0)
    expect(editorSessionChanges(restored, { ...owner, imageId: 'new-media' })).toBeNull()
    expect(editorSessionChanges(restored, { ...owner, recipeId: 'new-film' })).toBeNull()
  })

  it.each(['adjust', 'tuning', 'crop'] as const)('rejects a %s draft after changing photos or presets', kind => {
    const session = kind === 'crop'
      ? beginCropSession(owner, createDefaultTransformState())
      : kind === 'adjust'
        ? beginAdjustSession(owner, 'highlight', { highlight: 4 })
        : beginTuningSession(owner, { highlight: 4 })

    for (const otherOwner of [
      { ...owner, imageId: 'photo-b' },
      { ...owner, recipeId: 'another-preset' },
    ]) {
      expect(activeEditorSession(session, otherOwner)).toBeNull()
      expect(editorSessionChanges(session, otherOwner)).toBeNull()
    }
  })

  it('commits Crop geometry without copying Adjust settings, and leaves Cancel reversible', () => {
    const saved = createDefaultTransformState()
    const session = updateCropSession(beginCropSession(owner, saved), {
      quarterTurns: 90, flipHorizontal: true, fineAngle: 12.3, cropRatio: '1:1',
    })

    expect(saved).toEqual(createDefaultTransformState())
    expect(editorSessionChanges(session, owner)).toEqual({ transform: session.draft })
    expect(editorSessionChanges(null, owner)).toBeNull()
  })
})
