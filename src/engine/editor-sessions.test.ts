import { describe, expect, it } from 'vitest'
import {
  beginAdjustSession,
  beginCropSession,
  createRandomRecipeSettings,
  resetAdjustSession,
  setCropRatio,
  updateAdjustSession,
  updateCropSession,
} from './editor-sessions'
import { createDefaultTransformState } from './transform'
import type { Recipe } from './types'

const recipe: Recipe = {
  id: 'test',
  name: 'Test',
  filmSimulation: 'provia',
  settings: { highlight: 2, whiteBalance: 'daylight' },
}

describe('adjust sessions', () => {
  it('keeps a stable snapshot for Cancel and a separate live draft', () => {
    const session = beginAdjustSession('highlight', { highlight: -1, color: 2 })
    const changed = updateAdjustSession(session, 4)

    expect(changed.before).toEqual({ highlight: -1, color: 2 })
    expect(changed.draft).toEqual({ highlight: 4, color: 2 })
  })

  it('resets to the active recipe value instead of zero', () => {
    const session = updateAdjustSession(beginAdjustSession('highlight', {}), -2)
    expect(resetAdjustSession(session, recipe).draft.highlight).toBe(2)
  })

  it('keeps White Balance and Temperature mutually exclusive', () => {
    const temperature = updateAdjustSession(
      beginAdjustSession('whiteBalanceKelvin', { whiteBalance: 'cloudy' }),
      7200,
    )
    expect(temperature.draft).toEqual({ whiteBalanceKelvin: 7200 })

    const whiteBalance = updateAdjustSession(
      beginAdjustSession('whiteBalance', { whiteBalanceKelvin: 7200 }),
      'shade',
    )
    expect(whiteBalance.draft).toEqual({ whiteBalance: 'shade' })
  })
})

describe('random settings', () => {
  it('keeps every numeric value in range and WB modes mutually exclusive', () => {
    for (const random of [() => 0, () => 0.499, () => 0.999]) {
      const settings = createRandomRecipeSettings(random)
      expect(settings.highlight).toBeGreaterThanOrEqual(-2)
      expect(settings.highlight).toBeLessThanOrEqual(4)
      expect(settings.whiteBalance === undefined || settings.whiteBalanceKelvin === undefined).toBe(true)
      if (settings.whiteBalanceKelvin !== undefined) {
        expect(settings.whiteBalanceKelvin).toBeGreaterThanOrEqual(2500)
        expect(settings.whiteBalanceKelvin).toBeLessThanOrEqual(10000)
      }
    }
  })
})

describe('crop sessions', () => {
  it('preserves the entire entry snapshot while normalizing a draft', () => {
    const before = createDefaultTransformState()
    const changed = updateCropSession(beginCropSession(before), {
      fineAngle: 60,
      cropScale: 0.5,
      cropOffset: { x: -1, y: 2 },
    })

    expect(changed.before).toEqual(before)
    expect(changed.draft).toMatchObject({
      fineAngle: 45,
      cropScale: 1,
      cropOffset: { x: 0, y: 1 },
    })
  })

  it('retains a free frame but resets it for fixed ratios', () => {
    const free = updateCropSession(beginCropSession(createDefaultTransformState()), {
      cropRect: { x: 0.1, y: 0.2, width: 0.5, height: 0.6 },
    })
    expect(setCropRatio(free, 'free').draft.cropRect).toEqual(free.draft.cropRect)
    expect(setCropRatio(free, '1:1').draft.cropRect).toEqual({ x: 0, y: 0, width: 1, height: 1 })
  })
})
