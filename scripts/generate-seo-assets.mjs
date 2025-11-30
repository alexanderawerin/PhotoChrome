/**
 * Generate SEO assets: OG image and favicon variants
 * Run: node scripts/generate-seo-assets.mjs
 */

import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';

const PUBLIC_DIR = './public';

// Camera icon SVG for favicon
const CAMERA_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="filmGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#f5f5f5"/>
      <stop offset="100%" style="stop-color:#d4d4d4"/>
    </linearGradient>
  </defs>
  <rect x="15" y="30" width="70" height="50" rx="8" fill="#27272a"/>
  <circle cx="50" cy="55" r="18" fill="#18181b" stroke="#3f3f46" stroke-width="3"/>
  <circle cx="50" cy="55" r="12" fill="#09090b"/>
  <circle cx="50" cy="55" r="6" fill="url(#filmGradient)"/>
  <rect x="60" y="35" width="18" height="10" rx="2" fill="#18181b"/>
  <rect x="35" y="22" width="30" height="8" rx="2" fill="#3f3f46"/>
  <circle cx="72" cy="26" r="5" fill="#52525b"/>
</svg>
`;

// Maskable icon with safe zone padding
const MASKABLE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="#0a0a0a"/>
  <g transform="translate(15, 15) scale(0.7)">
    <defs>
      <linearGradient id="filmGradient" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#f5f5f5"/>
        <stop offset="100%" style="stop-color:#d4d4d4"/>
      </linearGradient>
    </defs>
    <rect x="15" y="30" width="70" height="50" rx="8" fill="#27272a"/>
    <circle cx="50" cy="55" r="18" fill="#18181b" stroke="#3f3f46" stroke-width="3"/>
    <circle cx="50" cy="55" r="12" fill="#09090b"/>
    <circle cx="50" cy="55" r="6" fill="url(#filmGradient)"/>
    <rect x="60" y="35" width="18" height="10" rx="2" fill="#18181b"/>
    <rect x="35" y="22" width="30" height="8" rx="2" fill="#3f3f46"/>
    <circle cx="72" cy="26" r="5" fill="#52525b"/>
  </g>
</svg>
`;

/**
 * Generate favicon PNG variants from SVG
 */
async function generateFavicons() {
  const sizes = [16, 32, 192, 512];
  
  for (const size of sizes) {
    await sharp(Buffer.from(CAMERA_SVG))
      .resize(size, size)
      .png()
      .toFile(path.join(PUBLIC_DIR, `favicon-${size}x${size}.png`));
    
    console.log(`✓ Generated favicon-${size}x${size}.png`);
  }
  
  // Apple touch icon (180x180)
  await sharp(Buffer.from(CAMERA_SVG))
    .resize(180, 180)
    .png()
    .toFile(path.join(PUBLIC_DIR, 'apple-touch-icon.png'));
  
  console.log('✓ Generated apple-touch-icon.png');
  
  // Maskable icon for PWA
  await sharp(Buffer.from(MASKABLE_SVG))
    .resize(512, 512)
    .png()
    .toFile(path.join(PUBLIC_DIR, 'favicon-maskable-512x512.png'));
  
  console.log('✓ Generated favicon-maskable-512x512.png');
}

/**
 * Generate OG image for social media sharing
 * Creates a 1200x630 image with app branding and sample photos
 */
async function generateOgImage() {
  const width = 1200;
  const height = 630;
  
  // Get sample card images
  const cardsDir = path.join(PUBLIC_DIR, 'cards');
  const cardFiles = await fs.readdir(cardsDir);
  const jpgCards = cardFiles.filter(f => f.endsWith('.jpg')).slice(0, 6);
  
  // Load and resize card images
  const cardSize = 180;
  const cardImages = await Promise.all(
    jpgCards.map(async (file) => {
      const buffer = await sharp(path.join(cardsDir, file))
        .resize(cardSize, cardSize, { fit: 'cover' })
        .jpeg({ quality: 90 })
        .toBuffer();
      return buffer;
    })
  );
  
  // Create base image with dark background and gradient
  const svgBackground = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#18181b"/>
          <stop offset="100%" style="stop-color:#09090b"/>
        </linearGradient>
        <radialGradient id="glow" cx="50%" cy="40%" r="60%">
          <stop offset="0%" style="stop-color:#27272a"/>
          <stop offset="100%" style="stop-color:#09090b"/>
        </radialGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#bgGrad)"/>
      <ellipse cx="${width/2}" cy="${height * 0.4}" rx="${width * 0.5}" ry="${height * 0.4}" fill="url(#glow)" opacity="0.5"/>
    </svg>
  `;
  
  // Create text overlay
  const textOverlay = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <style>
        .title { font-family: system-ui, -apple-system, sans-serif; font-weight: 700; fill: white; }
        .subtitle { font-family: system-ui, -apple-system, sans-serif; font-weight: 400; fill: #a1a1aa; }
        .badge { font-family: system-ui, -apple-system, sans-serif; font-weight: 500; fill: #71717a; }
      </style>
      <!-- Logo camera icon -->
      <g transform="translate(${width/2 - 20}, 140)">
        <rect x="5" y="10" width="30" height="22" rx="3" fill="#3f3f46"/>
        <circle cx="20" cy="21" r="8" fill="#27272a" stroke="#52525b" stroke-width="1.5"/>
        <circle cx="20" cy="21" r="4" fill="#18181b"/>
        <circle cx="20" cy="21" r="2" fill="#71717a"/>
        <rect x="27" y="12" width="6" height="4" rx="1" fill="#27272a"/>
      </g>
      <!-- Title -->
      <text x="${width/2}" y="220" text-anchor="middle" class="title" font-size="64">Photochrome</text>
      <!-- Subtitle -->
      <text x="${width/2}" y="270" text-anchor="middle" class="subtitle" font-size="24">Fujifilm film simulations for your photos</text>
      <!-- Features -->
      <text x="${width/2}" y="560" text-anchor="middle" class="badge" font-size="16">Provia • Velvia • Classic Chrome • Classic Neg • 60+ Recipes</text>
      <!-- URL -->
      <text x="${width/2}" y="600" text-anchor="middle" class="badge" font-size="14">photochrome.netdesigner.ru</text>
    </svg>
  `;
  
  // Compose the image
  const composites = [
    { input: Buffer.from(textOverlay), top: 0, left: 0 },
  ];
  
  // Add card images in a row
  const startX = (width - (cardImages.length * cardSize + (cardImages.length - 1) * 20)) / 2;
  const cardY = 330;
  
  cardImages.forEach((buffer, i) => {
    composites.push({
      input: buffer,
      top: cardY,
      left: Math.round(startX + i * (cardSize + 20)),
    });
  });
  
  // Generate final image
  await sharp(Buffer.from(svgBackground))
    .composite(composites)
    .jpeg({ quality: 90 })
    .toFile(path.join(PUBLIC_DIR, 'og-image.jpg'));
  
  console.log('✓ Generated og-image.jpg (1200x630)');
}

async function main() {
  console.log('🎨 Generating SEO assets...\n');
  
  try {
    await generateFavicons();
    console.log('');
    await generateOgImage();
    console.log('\n✅ All SEO assets generated successfully!');
  } catch (error) {
    console.error('❌ Error generating assets:', error);
    process.exit(1);
  }
}

main();

