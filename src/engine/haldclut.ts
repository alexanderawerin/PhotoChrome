/**
 * HaldCLUT (Hald Color Lookup Table) parser and applicator.
 *
 * A HaldCLUT of level N is an image of N^3 x N^3 pixels that encodes
 * a 3D color lookup table with N^2 entries per channel.
 *
 * Layout: pixels are arranged sequentially with R varying fastest,
 * then G, then B. For grid size G = N^2:
 *   pixel_index = b * G * G + g * G + r
 *   x = pixel_index % image_width
 *   y = floor(pixel_index / image_width)
 */

export interface HaldCLUT {
  /** HaldCLUT level (e.g. 8 for a 512x512 image) */
  level: number
  /** Colors per channel = level^2 (e.g. 64) */
  gridSize: number
  /** Image width = level^3 (e.g. 512) */
  width: number
  /** Raw RGB pixel data (width * width * 4, RGBA) */
  data: Uint8ClampedArray
}

/**
 * Parse an ImageData into a HaldCLUT structure.
 * Detects the level from image dimensions.
 */
export function parseHaldCLUT(imageData: ImageData): HaldCLUT {
  const { width, height, data } = imageData
  if (width !== height) {
    throw new Error(`HaldCLUT must be square, got ${width}x${height}`)
  }

  // Find level: width = level^3
  const level = Math.round(Math.cbrt(width))
  if (level ** 3 !== width) {
    throw new Error(`Invalid HaldCLUT dimensions: ${width} is not a perfect cube`)
  }

  return {
    level,
    gridSize: level * level,
    width,
    data,
  }
}

/**
 * Look up a single pixel from the HaldCLUT.
 * r, g, b are integer grid coordinates in [0, gridSize-1].
 */
function lutLookup(lut: HaldCLUT, r: number, g: number, b: number): [number, number, number] {
  const idx = b * lut.gridSize * lut.gridSize + g * lut.gridSize + r
  const x = idx % lut.width
  const y = (idx / lut.width) | 0
  const i = (y * lut.width + x) * 4
  return [lut.data[i], lut.data[i + 1], lut.data[i + 2]]
}

/**
 * Apply a HaldCLUT to an ImageData in-place using trilinear interpolation.
 * This replaces the curve + colorBalance + saturation steps of the simulation.
 */
export function applyHaldCLUT(imageData: ImageData, lut: HaldCLUT): void {
  const { data } = imageData
  const maxIdx = lut.gridSize - 1

  for (let i = 0; i < data.length; i += 4) {
    // Map 0-255 to 0-(gridSize-1)
    const rFloat = (data[i] / 255) * maxIdx
    const gFloat = (data[i + 1] / 255) * maxIdx
    const bFloat = (data[i + 2] / 255) * maxIdx

    // Grid coordinates (floor and ceil)
    const r0 = rFloat | 0, r1 = Math.min(r0 + 1, maxIdx)
    const g0 = gFloat | 0, g1 = Math.min(g0 + 1, maxIdx)
    const b0 = bFloat | 0, b1 = Math.min(b0 + 1, maxIdx)

    // Fractional parts
    const fr = rFloat - r0
    const fg = gFloat - g0
    const fb = bFloat - b0

    // Sample 8 corners of the interpolation cube
    const c000 = lutLookup(lut, r0, g0, b0)
    const c100 = lutLookup(lut, r1, g0, b0)
    const c010 = lutLookup(lut, r0, g1, b0)
    const c110 = lutLookup(lut, r1, g1, b0)
    const c001 = lutLookup(lut, r0, g0, b1)
    const c101 = lutLookup(lut, r1, g0, b1)
    const c011 = lutLookup(lut, r0, g1, b1)
    const c111 = lutLookup(lut, r1, g1, b1)

    // Trilinear interpolation per channel
    for (let ch = 0; ch < 3; ch++) {
      const c00 = c000[ch] + (c100[ch] - c000[ch]) * fr
      const c10 = c010[ch] + (c110[ch] - c010[ch]) * fr
      const c01 = c001[ch] + (c101[ch] - c001[ch]) * fr
      const c11 = c011[ch] + (c111[ch] - c011[ch]) * fr

      const c0 = c00 + (c10 - c00) * fg
      const c1 = c01 + (c11 - c01) * fg

      const value = c0 + (c1 - c0) * fb
      data[i + ch] = value < 0 ? 0 : value > 255 ? 255 : (value + 0.5) | 0
    }
    // Alpha unchanged
  }
}
