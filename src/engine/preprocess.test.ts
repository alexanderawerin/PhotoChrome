import { describe, expect, it } from 'vitest'
import { applyPreprocessSettings, needsPreprocess } from './preprocess'

function imageData(r: number, g: number, b: number): ImageData {
  return {
    data: new Uint8ClampedArray([r, g, b, 255]),
    width: 1,
    height: 1,
    colorSpace: 'srgb',
  } as ImageData
}

describe('image preprocessing', () => {
  it('recognizes settings that must run before the simulation pipeline', () => {
    expect(needsPreprocess()).toBe(false)
    expect(needsPreprocess({ dynamicRange: 'DR100', whiteBalance: 'auto' })).toBe(false)
    expect(needsPreprocess({ dynamicRange: 'DR200' })).toBe(true)
    expect(needsPreprocess({ whiteBalanceKelvin: 5300 })).toBe(true)
  })

  it('applies Kelvin white balance for both sync and worker pipelines', () => {
    const image = imageData(100, 100, 100)

    applyPreprocessSettings(image, { whiteBalanceKelvin: 3000 })

    expect(image.data[0]).toBeGreaterThan(image.data[2])
  })
})
