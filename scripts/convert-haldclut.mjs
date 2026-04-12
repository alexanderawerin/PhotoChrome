/**
 * Convert Level 12 HaldCLUT PNGs (1728x1728) to Level 8 (512x512).
 *
 * HaldCLUT layout for level N:
 * - Image dimensions: N^3 x N^3
 * - Grid size (colors per channel): N^2
 * - Organized as N^2 x N^2 grid of N x N blocks
 * - For each pixel at (x, y):
 *   - blockX = floor(x / N), blockY = floor(y / N)
 *   - innerX = x % N, innerY = y % N
 *   - blue = blockY * N^2 + blockX (select block from grid)
 *   - Wait — actually the mapping is:
 *     The pixel at position (x, y) represents input color:
 *     - red = x % N^2 (position within row, wrapped)
 *     - green = y % N^2
 *     - blue = floor(x / N^2) + floor(y / N^2) * N
 *     No — let's use the standard sequential layout:
 *
 * Standard HaldCLUT: pixels are laid out sequentially, with R varying fastest,
 * then G, then B. For grid size G = N^2:
 *   pixel index = b * G * G + g * G + r
 *   x = index % width, y = floor(index / width)
 *
 * Usage: node scripts/convert-haldclut.mjs
 */
import sharp from 'sharp'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { readdirSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC_DIR = join(__dirname, '..', 'src/presets/simulations/lut-originals')
const OUT_DIR = join(__dirname, '..', 'src/presets/simulations/lut')

const SRC_LEVEL = 12
const DST_LEVEL = 8
const SRC_GRID = SRC_LEVEL * SRC_LEVEL  // 144
const DST_GRID = DST_LEVEL * DST_LEVEL  // 64
const SRC_WIDTH = SRC_LEVEL ** 3         // 1728
const DST_WIDTH = DST_LEVEL ** 3         // 512

/**
 * For a HaldCLUT of level N (grid = N^2, width = N^3):
 * Given input (r, g, b) in range [0, grid-1], find the pixel in the image.
 */
function haldPixelIndex(r, g, b, grid, width) {
  const index = b * grid * grid + g * grid + r
  const x = index % width
  const y = Math.floor(index / width)
  return { x, y }
}

/**
 * Sample a pixel from the source HaldCLUT with trilinear interpolation.
 * Input (r, g, b) are in [0, DST_GRID-1] range (destination grid).
 * Maps to source grid coordinates and interpolates.
 */
function sampleLUT(srcData, srcWidth, r, g, b) {
  // Map from dst grid [0, DST_GRID-1] to src grid [0, SRC_GRID-1]
  const scale = (SRC_GRID - 1) / (DST_GRID - 1)
  const sr = r * scale
  const sg = g * scale
  const sb = b * scale

  const r0 = Math.floor(sr), r1 = Math.min(r0 + 1, SRC_GRID - 1)
  const g0 = Math.floor(sg), g1 = Math.min(g0 + 1, SRC_GRID - 1)
  const b0 = Math.floor(sb), b1 = Math.min(b0 + 1, SRC_GRID - 1)

  const fr = sr - r0, fg = sg - g0, fb = sb - b0

  // Sample 8 corners
  const corners = [
    getPixel(srcData, srcWidth, r0, g0, b0),
    getPixel(srcData, srcWidth, r1, g0, b0),
    getPixel(srcData, srcWidth, r0, g1, b0),
    getPixel(srcData, srcWidth, r1, g1, b0),
    getPixel(srcData, srcWidth, r0, g0, b1),
    getPixel(srcData, srcWidth, r1, g0, b1),
    getPixel(srcData, srcWidth, r0, g1, b1),
    getPixel(srcData, srcWidth, r1, g1, b1),
  ]

  // Trilinear interpolation
  const result = [0, 0, 0]
  for (let ch = 0; ch < 3; ch++) {
    const c00 = corners[0][ch] * (1 - fr) + corners[1][ch] * fr
    const c10 = corners[2][ch] * (1 - fr) + corners[3][ch] * fr
    const c01 = corners[4][ch] * (1 - fr) + corners[5][ch] * fr
    const c11 = corners[6][ch] * (1 - fr) + corners[7][ch] * fr

    const c0 = c00 * (1 - fg) + c10 * fg
    const c1 = c01 * (1 - fg) + c11 * fg

    result[ch] = Math.round(c0 * (1 - fb) + c1 * fb)
  }

  return result
}

function getPixel(data, width, r, g, b) {
  const { x, y } = haldPixelIndex(r, g, b, SRC_GRID, SRC_WIDTH)
  const i = (y * width + x) * 3
  return [data[i], data[i + 1], data[i + 2]]
}

async function convertFile(filename) {
  const srcPath = join(SRC_DIR, filename)
  const dstPath = join(OUT_DIR, filename)

  // Load source Level 12 PNG as raw RGB
  const { data: srcData } = await sharp(srcPath)
    .raw()
    .toBuffer({ resolveWithObject: true })

  // Create destination Level 8 buffer
  const dstData = Buffer.alloc(DST_WIDTH * DST_WIDTH * 3)

  // For each pixel in destination HaldCLUT
  for (let b = 0; b < DST_GRID; b++) {
    for (let g = 0; g < DST_GRID; g++) {
      for (let r = 0; r < DST_GRID; r++) {
        const { x, y } = haldPixelIndex(r, g, b, DST_GRID, DST_WIDTH)
        const [outR, outG, outB] = sampleLUT(srcData, SRC_WIDTH, r, g, b)
        const i = (y * DST_WIDTH + x) * 3
        dstData[i] = outR
        dstData[i + 1] = outG
        dstData[i + 2] = outB
      }
    }
  }

  await sharp(dstData, { raw: { width: DST_WIDTH, height: DST_WIDTH, channels: 3 } })
    .png({ compressionLevel: 9 })
    .toFile(dstPath)

  const srcStat = (await sharp(srcPath).toBuffer()).length
  const dstStat = (await sharp(dstPath).toBuffer()).length
  console.log(`  ${filename}: ${(srcStat / 1024).toFixed(0)}KB → ${(dstStat / 1024).toFixed(0)}KB`)
}

async function main() {
  const files = readdirSync(SRC_DIR).filter(f => f.endsWith('.png'))
  console.log(`Converting ${files.length} HaldCLUT files (Level ${SRC_LEVEL} → Level ${DST_LEVEL})...`)

  for (const file of files) {
    await convertFile(file)
  }

  console.log('Done!')
}

main()
