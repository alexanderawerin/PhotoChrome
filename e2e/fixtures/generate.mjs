/**
 * Generate minimal test JPEG images for E2E tests.
 * Uses sharp (already a dev dependency) to create color gradient images.
 *
 * Usage: node e2e/fixtures/generate.mjs
 */
import sharp from 'sharp'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { spawnSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function generateTestImages() {
  // 200x150 landscape — red-to-blue gradient
  const landscape = Buffer.alloc(200 * 150 * 3)
  for (let y = 0; y < 150; y++) {
    for (let x = 0; x < 200; x++) {
      const i = (y * 200 + x) * 3
      landscape[i] = Math.round((x / 200) * 255)     // R
      landscape[i + 1] = Math.round((y / 150) * 255)  // G
      landscape[i + 2] = 255 - Math.round((x / 200) * 255) // B
    }
  }

  await sharp(landscape, { raw: { width: 200, height: 150, channels: 3 } })
    .jpeg({ quality: 80 })
    .toFile(join(__dirname, 'test-image.jpg'))

  // 150x200 portrait — green-to-purple gradient
  const portrait = Buffer.alloc(150 * 200 * 3)
  for (let y = 0; y < 200; y++) {
    for (let x = 0; x < 150; x++) {
      const i = (y * 150 + x) * 3
      portrait[i] = Math.round((y / 200) * 200)        // R
      portrait[i + 1] = 255 - Math.round((y / 200) * 255) // G
      portrait[i + 2] = Math.round((x / 150) * 200)     // B
    }
  }

  await sharp(portrait, { raw: { width: 150, height: 200, channels: 3 } })
    .jpeg({ quality: 80 })
    .toFile(join(__dirname, 'test-image-2.jpg'))

  console.log('Test images generated successfully.')
}

function generateTestVideo() {
  const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg'
  const output = join(__dirname, 'test-video.mp4')
  const result = spawnSync(ffmpeg, [
    '-hide_banner',
    '-loglevel', 'error',
    '-f', 'lavfi',
    '-i', 'testsrc2=size=640x360:rate=30:duration=3',
    '-f', 'lavfi',
    '-i', 'sine=frequency=440:sample_rate=48000:duration=3',
    '-c:v', 'libx264',
    '-profile:v', 'baseline',
    '-pix_fmt', 'yuv420p',
    '-r', '30',
    '-c:a', 'aac',
    '-b:a', '128k',
    '-movflags', '+faststart',
    '-shortest',
    '-y', output,
  ], { encoding: 'utf8' })

  if (result.error || result.status !== 0) {
    throw new Error(
      `Failed to generate test-video.mp4. Install ffmpeg or set FFMPEG_PATH.\n${result.error?.message || result.stderr}`
    )
  }
}

await generateTestImages()
generateTestVideo()
console.log('Test fixtures generated successfully.')
