import { describe, expect, it } from 'vitest'
import { clampFineAngle, createDefaultTransformState, minimumCoverScale, nextQuarterTurn, toggleHorizontalFlip } from './transform'

describe('transform state', () => {
  it('returns to the original orientation after four clockwise turns', () => {
    let angle = createDefaultTransformState().quarterTurns
    for (let index = 0; index < 4; index += 1) angle = nextQuarterTurn(angle)
    expect(angle).toBe(0)
  })

  it('returns to the original flip state after two flips', () => {
    const initial = createDefaultTransformState()
    expect(toggleHorizontalFlip(toggleHorizontalFlip(initial))).toEqual(initial)
  })

  it('clamps, rounds and snaps fine rotation', () => {
    expect(clampFineAngle(-48)).toBe(-45)
    expect(clampFineAngle(12.34)).toBe(12.3)
    expect(clampFineAngle(0.04)).toBe(0)
    expect(clampFineAngle(48)).toBe(45)
  })

  it('requires no extra scale at zero and positive cover scale at both extremes', () => {
    expect(minimumCoverScale(1600, 900, 0)).toBe(1)
    expect(minimumCoverScale(1600, 900, -45)).toBeGreaterThan(1)
    expect(minimumCoverScale(1600, 900, 45)).toBeGreaterThan(1)
  })
})
