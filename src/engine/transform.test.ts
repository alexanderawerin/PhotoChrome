import { afterEach, describe, expect, it, vi } from 'vitest'
import { clampFineAngle, createDefaultTransformState, getImageTransformSize, minimumCoverScale, nextQuarterTurn, renderImageTransform, toggleHorizontalFlip } from './transform'

afterEach(() => vi.unstubAllGlobals())

describe('transform canvas ownership', () => {
  function canvasFixture(failReadback = false) {
    const canvases: { width: number; height: number; getContext: () => typeof context }[] = []
    const context = {
      putImageData: vi.fn(), translate: vi.fn(), scale: vi.fn(), rotate: vi.fn(), drawImage: vi.fn(),
      getImageData: vi.fn((_x: number, _y: number, width: number, height: number) => {
        if (failReadback) throw new Error('Readback failed')
        return { width, height, data: new Uint8ClampedArray(4) } as ImageData
      }),
    }
    vi.stubGlobal('document', { createElement: () => {
      const canvas = { width: 0, height: 0, getContext: () => context }
      canvases.push(canvas)
      return canvas
    } })
    return canvases
  }

  const source = { width: 400, height: 300, data: new Uint8ClampedArray(4) } as ImageData

  it('releases every backing canvas after combined geometry while retaining output dimensions', () => {
    const canvases = canvasFixture()
    const state = {
      ...createDefaultTransformState(), quarterTurns: 90 as const, flipHorizontal: true,
      fineAngle: 12, cropRatio: 'free' as const, cropRect: { x: 0.1, y: 0.2, width: 0.6, height: 0.7 },
    }
    const output = renderImageTransform(source, state)
    expect({ width: output.width, height: output.height }).toEqual(getImageTransformSize(source.width, source.height, state))
    expect(canvases.length).toBeGreaterThan(0)
    for (const canvas of canvases) expect(canvas).toMatchObject({ width: 0, height: 0 })
  })

  it.each([
    { quarterTurns: 90 as const }, { flipHorizontal: true }, { fineAngle: 10 }, { cropRatio: '1:1' as const },
  ])('releases temporary geometry canvases when readback fails for %j', update => {
    const canvases = canvasFixture(true)
    expect(() => renderImageTransform(source, { ...createDefaultTransformState(), ...update })).toThrow('Readback failed')
    expect(canvases.length).toBeGreaterThan(0)
    for (const canvas of canvases) expect(canvas).toMatchObject({ width: 0, height: 0 })
  })
})

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
