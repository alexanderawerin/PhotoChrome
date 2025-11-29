/**
 * Script to process images for landing page cards.
 * 
 * Takes photos from img/ folder, applies random film simulation-like
 * color grading, crops to square, and resizes for retina displays.
 * 
 * Usage: node scripts/process-card-images.mjs
 */

import sharp from 'sharp'
import fs from 'fs/promises'
import path from 'path'

// Configuration
const INPUT_DIR = 'img'
const OUTPUT_DIR = 'public/cards'
const OUTPUT_SIZE = 400 // 400x400 for 4x high-density displays (covers 80-100px at up to 4x DPR)
const JPEG_QUALITY = 85

/**
 * Film simulation presets for color grading.
 * Each preset defines color adjustments inspired by real film stocks.
 * Uses recomb matrix for color channel mixing (more accurate than tint).
 */
const FILM_PRESETS = [
  // Provia-like: Neutral, balanced, slightly warm
  {
    name: 'provia',
    modulate: { brightness: 1.0, saturation: 1.1, hue: 0 },
    // Slight warm cast
    recomb: [
      [1.02, 0, 0],
      [0, 1.0, 0],
      [0, 0, 0.95],
    ],
  },
  // Velvia-like: High saturation, vivid colors, warm
  {
    name: 'velvia',
    modulate: { brightness: 1.0, saturation: 1.35, hue: 5 },
    // Boost reds and yellows
    recomb: [
      [1.1, 0.05, 0],
      [0, 1.05, 0],
      [0, 0, 0.9],
    ],
  },
  // Astia-like: Soft, portrait-friendly, natural skin tones
  {
    name: 'astia',
    modulate: { brightness: 1.02, saturation: 1.0, hue: -2 },
    // Neutral with slight magenta
    recomb: [
      [1.0, 0.02, 0],
      [0, 0.98, 0],
      [0, 0.02, 1.0],
    ],
  },
  // Pro 400H-like: Pastel, soft, slight cyan in shadows
  {
    name: 'pro400h',
    modulate: { brightness: 1.05, saturation: 0.9, hue: -5 },
    // Slight cyan/green cast
    recomb: [
      [0.95, 0, 0.02],
      [0.02, 1.02, 0.02],
      [0, 0.02, 1.0],
    ],
  },
  // Classic Chrome-like: Muted, desaturated, earthy tones
  {
    name: 'classic-chrome',
    modulate: { brightness: 0.98, saturation: 0.85, hue: 8 },
    // Muted with warm shadows
    recomb: [
      [1.0, 0.05, 0],
      [0.02, 0.98, 0.02],
      [0, 0, 0.92],
    ],
  },
  // Classic Negative-like: Warm shadows, desaturated highlights
  {
    name: 'classic-neg',
    modulate: { brightness: 1.0, saturation: 0.95, hue: 12 },
    // Warm cast with cyan highlights
    recomb: [
      [1.05, 0.03, 0],
      [0.02, 1.0, 0],
      [0, 0.05, 0.95],
    ],
  },
  // Eterna-like: Cinematic, low saturation, cool tones
  {
    name: 'eterna',
    modulate: { brightness: 0.97, saturation: 0.8, hue: -8 },
    // Cool, cinematic look
    recomb: [
      [0.95, 0, 0.02],
      [0, 0.98, 0.02],
      [0.02, 0.02, 1.02],
    ],
  },
  // Superia-like: Warm, nostalgic, punchy colors
  {
    name: 'superia',
    modulate: { brightness: 1.0, saturation: 1.15, hue: 15 },
    // Warm nostalgic look
    recomb: [
      [1.08, 0.02, 0],
      [0.02, 1.0, 0],
      [0, 0, 0.88],
    ],
  },
  // Acros-like: Black and white, medium contrast
  {
    name: 'acros',
    modulate: { brightness: 1.0, saturation: 0, hue: 0 },
    gamma: 1.1,
    grayscale: true,
  },
  // Neopan-like: High contrast B&W
  {
    name: 'neopan',
    modulate: { brightness: 1.05, saturation: 0, hue: 0 },
    gamma: 1.2,
    grayscale: true,
  },
]

/**
 * Get a random element from an array
 */
function getRandomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

/**
 * Process a single image with a random film preset
 */
async function processImage(inputPath, outputPath) {
  const preset = getRandomElement(FILM_PRESETS)
  
  // Read image and get metadata
  const image = sharp(inputPath)
  const metadata = await image.metadata()
  
  // Calculate center crop dimensions for square
  const size = Math.min(metadata.width, metadata.height)
  const left = Math.floor((metadata.width - size) / 2)
  const top = Math.floor((metadata.height - size) / 2)
  
  // Build processing pipeline
  let pipeline = image
    // Center crop to square
    .extract({ left, top, width: size, height: size })
    // Resize to target size
    .resize(OUTPUT_SIZE, OUTPUT_SIZE, {
      fit: 'cover',
      position: 'center',
    })
  
  // Apply grayscale first if B&W preset
  if (preset.grayscale) {
    pipeline = pipeline.grayscale()
  }
  
  // Apply color modulation (saturation, brightness, hue)
  pipeline = pipeline.modulate(preset.modulate)
  
  // Apply color matrix transformation for color grading (not for B&W)
  if (preset.recomb) {
    pipeline = pipeline.recomb(preset.recomb)
  }
  
  // Apply gamma adjustment (mainly for B&W contrast)
  if (preset.gamma) {
    pipeline = pipeline.gamma(preset.gamma)
  }
  
  // Add slight sharpening
  pipeline = pipeline.sharpen({ sigma: 0.5 })
  
  // Output as JPEG
  await pipeline
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toFile(outputPath)
  
  return preset.name
}

/**
 * Main function
 */
async function main() {
  console.log('🎞️  Processing images for landing page cards...\n')
  
  // Ensure output directory exists
  await fs.mkdir(OUTPUT_DIR, { recursive: true })
  
  // Get list of input images
  const files = await fs.readdir(INPUT_DIR)
  const imageFiles = files.filter(f => 
    /\.(jpg|jpeg|png|webp)$/i.test(f)
  )
  
  if (imageFiles.length === 0) {
    console.log('No images found in', INPUT_DIR)
    return
  }
  
  console.log(`Found ${imageFiles.length} images to process\n`)
  
  // Process each image
  const results = []
  for (let i = 0; i < imageFiles.length; i++) {
    const file = imageFiles[i]
    const inputPath = path.join(INPUT_DIR, file)
    const outputName = `card-${String(i + 1).padStart(2, '0')}.jpg`
    const outputPath = path.join(OUTPUT_DIR, outputName)
    
    const presetName = await processImage(inputPath, outputPath)
    results.push({ original: file, output: outputName, preset: presetName })
    
    console.log(`✓ ${file} → ${outputName} (${presetName})`)
  }
  
  // Generate manifest file for the app to know available images
  const manifest = {
    generated: new Date().toISOString(),
    count: results.length,
    images: results.map(r => r.output),
  }
  
  await fs.writeFile(
    path.join(OUTPUT_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  )
  
  console.log(`\n✨ Done! Processed ${results.length} images to ${OUTPUT_DIR}`)
  console.log('📄 Manifest written to', path.join(OUTPUT_DIR, 'manifest.json'))
}

main().catch(console.error)

