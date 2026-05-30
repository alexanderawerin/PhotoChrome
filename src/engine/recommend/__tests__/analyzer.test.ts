import { describe, it, expect } from 'vitest'
import { extractFeatures } from '../analyzer'

function makeImageData(width: number, height: number, fillFn: (x: number, y: number) => [number, number, number]): ImageData {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const [r, g, b] = fillFn(x, y)
      data[i] = r
      data[i + 1] = g
      data[i + 2] = b
      data[i + 3] = 255
    }
  }
  return { data, width, height } as ImageData
}

describe('extractFeatures', () => {
  it('returns brightness=1, isHighKey=true for fully white image', () => {
    const img = makeImageData(100, 100, () => [255, 255, 255])
    const f = extractFeatures(img)
    expect(f.brightness).toBeCloseTo(1, 1)
    expect(f.highlightsRatio).toBeCloseTo(1, 1)
    expect(f.saturation).toBeCloseTo(0, 1)
    expect(f.isHighKey).toBe(true)
    expect(f.isLowKey).toBe(false)
  })

  it('returns brightness=0, isLowKey=true for fully black image', () => {
    const img = makeImageData(100, 100, () => [0, 0, 0])
    const f = extractFeatures(img)
    expect(f.brightness).toBeCloseTo(0, 1)
    expect(f.shadowsRatio).toBeCloseTo(1, 1)
    expect(f.isLowKey).toBe(true)
  })

  it('returns warm features for fully red image', () => {
    const img = makeImageData(100, 100, () => [255, 0, 0])
    const f = extractFeatures(img)
    expect(f.warmth).toBeGreaterThan(0.5)
    expect(f.saturation).toBeCloseTo(1, 1)
    expect(f.dominantHues.length).toBeGreaterThan(0)
    expect(f.dominantHues[0].hue).toBeGreaterThanOrEqual(0)
    expect(f.dominantHues[0].hue).toBeLessThanOrEqual(20)
  })

  it('detects isHighContrast on black/white checkerboard', () => {
    const img = makeImageData(100, 100, (x, y) => {
      const v = (x + y) % 2 === 0 ? 0 : 255
      return [v, v, v]
    })
    const f = extractFeatures(img)
    expect(f.contrast).toBeGreaterThan(0.6)
    expect(f.isHighContrast).toBe(true)
    expect(f.brightness).toBeCloseTo(0.5, 1)
  })

  it('detects multiple dominant hues for radial rainbow', () => {
    const img = makeImageData(120, 120, (x, _y) => {
      const hue = (x / 120) * 360
      const c = 1
      const hp = hue / 60
      const xv = c * (1 - Math.abs((hp % 2) - 1))
      let r = 0, g = 0, b = 0
      if (hp < 1) { r = c; g = xv }
      else if (hp < 2) { r = xv; g = c }
      else if (hp < 3) { g = c; b = xv }
      else if (hp < 4) { g = xv; b = c }
      else if (hp < 5) { r = xv; b = c }
      else { r = c; b = xv }
      return [r * 255, g * 255, b * 255]
    })
    const f = extractFeatures(img)
    expect(f.dominantHues.length).toBeGreaterThanOrEqual(3)
    expect(f.saturation).toBeGreaterThan(0.5)
  })

  it('attaches exif when provided', () => {
    const img = makeImageData(50, 50, () => [128, 128, 128])
    const f = extractFeatures(img, { iso: 3200, colorTemperatureKelvin: 6500 })
    expect(f.exif?.iso).toBe(3200)
    expect(f.exif?.colorTemperatureKelvin).toBe(6500)
  })

  it('detects isMonochromatic for grayscale image', () => {
    const img = makeImageData(100, 100, () => [128, 128, 128])
    const f = extractFeatures(img)
    expect(f.saturation).toBeCloseTo(0, 1)
    expect(f.isMonochromatic).toBe(true)
  })
})
