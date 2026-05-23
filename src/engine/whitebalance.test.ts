import { describe, it, expect } from 'vitest'
import { kelvinToRGBMultipliers } from './whitebalance'

describe('kelvinToRGBMultipliers', () => {
  it('returns [1, 1, 1] at ~5500K neutral', () => {
    const [r, g, b] = kelvinToRGBMultipliers(5500)
    expect(g).toBe(1)
    expect(r).toBeCloseTo(1, 0)  // roughly 1 at neutral
    expect(b).toBeGreaterThan(0)
  })

  it('is warm (R > B) at 3000K', () => {
    const [r, _g, b] = kelvinToRGBMultipliers(3000)
    expect(r).toBeGreaterThan(b)
  })

  it('is cool (B > R) at 8000K', () => {
    const [r, _g, b] = kelvinToRGBMultipliers(8000)
    expect(b).toBeGreaterThan(r)
  })

  it('blue channel is 0 below 1900K', () => {
    const [_r, _g, b] = kelvinToRGBMultipliers(1500)
    expect(b).toBe(0)
  })

  it('G is always 1', () => {
    for (const k of [2500, 4000, 5500, 6500, 10000]) {
      const [_r, g, _b] = kelvinToRGBMultipliers(k)
      expect(g).toBe(1)
    }
  })
})
