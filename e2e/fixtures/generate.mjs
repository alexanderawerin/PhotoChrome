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
  const silent = join(__dirname, 'test-video-silent.mp4')
  for (const args of [
    ['-i', output, '-c:v', 'copy', '-an', silent],
    ['-i', silent, '-itsoffset', '0.4', '-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=2.3',
      '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '128k', '-t', '3', join(__dirname, 'test-video-offset-audio.mp4')],
  ]) {
    const variant = spawnSync(ffmpeg, ['-v', 'error', '-y', ...args], { encoding: 'utf8' })
    if (variant.error || variant.status !== 0) throw new Error(`Failed to generate audio fixture: ${variant.error?.message || variant.stderr}`)
  }

  const asymmetric = join(__dirname, 'test-video-asymmetric-24.mp4')
  const variants = [
    ['-f', 'lavfi', '-i', 'color=c=red:size=320x180:rate=24:duration=2.125', '-f', 'lavfi', '-i', 'color=c=white:size=24x16:rate=24:duration=2.125', '-filter_complex',
      '[0:v]drawbox=x=160:y=0:w=160:h=90:color=lime:t=fill,drawbox=x=0:y=90:w=160:h=90:color=blue:t=fill,drawbox=x=160:y=90:w=160:h=90:color=yellow:t=fill[bg];[bg][1:v]overlay=x=24+mod(t*64\\,72):y=24:shortest=1',
      '-c:v', 'libx264', '-profile:v', 'baseline', '-pix_fmt', 'yuv420p', '-video_track_timescale', '12000', asymmetric],
    ['-i', asymmetric, '-vf', 'setpts=PTS+floor(N/12)*0.025/TB', '-fps_mode', 'vfr',
      '-c:v', 'libx264', '-profile:v', 'baseline', '-pix_fmt', 'yuv420p', '-video_track_timescale', '12000', join(__dirname, 'test-video-asymmetric-vfr.mp4')],
    ['-display_rotation', '90', '-i', asymmetric, '-c', 'copy', join(__dirname, 'test-video-rotated-24.mp4')],
  ]
  for (const args of variants) {
    const variant = spawnSync(ffmpeg, ['-v', 'error', '-y', ...args], { encoding: 'utf8' })
    if (variant.error || variant.status !== 0) throw new Error(`Failed to generate geometry fixture: ${variant.error?.message || variant.stderr}`)
  }

}

/** Geometry + sound oracle: white flashes and two gated tones share exact source times. */
function generateAudioGeometryVideo() {
  const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg'
  const pulse = '0.7*sin(2*PI*880*t)*gte(n,4800)*lt(n,10800)+0.7*sin(2*PI*1320*t)*gte(n,68800)*lt(n,74800)'
  const result = spawnSync(ffmpeg, [
    '-v', 'error', '-y',
    '-i', join(__dirname, 'test-video-asymmetric-24.mp4'),
    '-itsoffset', '0.4', '-f', 'lavfi', '-i', `aevalsrc='${pulse}':s=48000:d=1.6`,
    '-map', '0:v', '-map', '1:a',
    '-vf', "drawbox=x=0:y=0:w=iw:h=ih:color=white:t=fill:enable='between(n,12,14)+between(n,44,46)'",
    '-c:v', 'libx264', '-profile:v', 'baseline', '-pix_fmt', 'yuv420p', '-video_track_timescale', '12000',
    '-c:a', 'aac', '-b:a', '128k', '-ac', '1', '-ar', '48000', '-movflags', '+faststart',
    join(__dirname, 'test-video-asymmetric-audio.mp4'),
  ], { encoding: 'utf8' })
  if (result.error || result.status !== 0) throw new Error(`Failed to generate audio/geometry fixture: ${result.error?.message || result.stderr}`)
}

// This mode intentionally leaves every existing fixture binary unchanged.
if (process.argv.includes('--audio-geometry')) {
  generateAudioGeometryVideo()
} else {
  await generateTestImages()
  generateTestVideo()
  generateAudioGeometryVideo()
}
console.log('Test fixtures generated successfully.')
