import { describe, expect, it } from 'vitest'
import { getImageKey } from './image-identity'

function solidImage(green: number, blue: number): ImageData {
  return {
    width: 16,
    height: 16,
    data: Uint8ClampedArray.from({ length: 16 * 16 * 4 }, (_, i) => [0, green, blue, 255][i % 4]),
  } as ImageData
}

describe('image identity used by recipe preview caches', () => {
  it('does not reuse green pixels for a blue photo with the same size and red samples', () => {
    const green = solidImage(255, 0)
    const blue = solidImage(0, 255)
    const previews = new Map([[getImageKey(green), green]])

    expect(previews.get(getImageKey(blue))).toBeUndefined()
    expect(previews.get(getImageKey(green))).toBe(green)
  })

  it('keeps a stable identity for shared source data but invalidates a new transform result', () => {
    const source = solidImage(255, 0)
    const transformed = { ...source, data: source.data.slice() } as ImageData
    transformed.data[2] = 255

    expect(getImageKey(source)).toBe(getImageKey(source))
    expect(getImageKey(transformed)).not.toBe(getImageKey(source))
  })
})
