import { describe, expect, it } from 'vitest'
import { createDefaultTransformState, getImageTransformSize } from '../transform'
import { getVideoOutputSize } from './geometry'

describe('composed video dimensions', () => {
  it('swaps source axes before applying portrait crop', () => {
    const transform = { ...createDefaultTransformState(), quarterTurns: 90 as const, cropRatio: '9:16' as const }
    expect(getVideoOutputSize(640, 360, transform)).toEqual({ width: 360, height: 640 })
  })
  it('pads odd free-crop dimensions without stretching or changing the photo crop', () => {
    const transform = { ...createDefaultTransformState(), cropRatio: 'free' as const,
      cropRect: { x: .1, y: .1, width: .503, height: .503 } }
    expect(getImageTransformSize(640, 360, transform)).toEqual({ width: 322, height: 181 })
    expect(getVideoOutputSize(640, 360, transform)).toEqual({ width: 322, height: 182 })
  })
  it('fine angle, reflection and zoom do not change composed dimensions', () => {
    const transform = { ...createDefaultTransformState(), fineAngle: 35, flipHorizontal: true, cropScale: 1.7, cropOffset: { x: .2, y: .8 } }
    expect(getVideoOutputSize(640, 360, transform)).toEqual({ width: 640, height: 360 })
  })
})
