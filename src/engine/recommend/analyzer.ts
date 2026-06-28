import type { PhotoFeatures, HueWeight } from './features'
import type { ExifSubset } from '../exif'

const TARGET_SAMPLES = 50_000
const SHADOW_THRESHOLD = 0.2
const HIGHLIGHT_THRESHOLD = 0.8

/**
 * Извлекает статистику фото для рекомендаций.
 * Один проход с адаптивным subsample (~50k точек независимо от размера).
 */
export function extractFeatures(imageData: ImageData, exif?: ExifSubset): PhotoFeatures {
  const { data, width, height } = imageData
  const totalPixels = width * height
  const stride = Math.max(1, Math.floor(Math.sqrt(totalPixels / TARGET_SAMPLES)))

  let sumR = 0, sumB = 0
  let sumL = 0, sumL2 = 0
  let shadowCount = 0, highlightCount = 0
  let sumSat = 0
  let count = 0
  const hueHistogram = new Array(36).fill(0)

  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const i = (y * width + x) * 4
      const r = data[i] / 255
      const g = data[i + 1] / 255
      const b = data[i + 2] / 255

      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b
      sumR += r; sumB += b
      sumL += l
      sumL2 += l * l
      if (l < SHADOW_THRESHOLD) shadowCount++
      if (l > HIGHLIGHT_THRESHOLD) highlightCount++

      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      const sat = max === 0 ? 0 : (max - min) / max
      sumSat += sat

      if (sat > 0.1) {
        const delta = max - min
        let h: number
        if (max === r) h = ((g - b) / delta) % 6
        else if (max === g) h = ((b - r) / delta) + 2
        else h = ((r - g) / delta) + 4
        h *= 60
        if (h < 0) h += 360
        const bin = Math.min(35, Math.floor(h / 10))
        hueHistogram[bin] += sat
      }

      count++
    }
  }

  const brightness = sumL / count
  const variance = sumL2 / count - brightness * brightness
  const contrast = Math.min(1, Math.sqrt(Math.max(0, variance)) * 2)
  const shadowsRatio = shadowCount / count
  const highlightsRatio = highlightCount / count
  const warmth = (sumR - sumB) / count
  const saturation = sumSat / count

  const sortedBins = hueHistogram
    .map((weight, idx) => ({ hue: idx * 10 + 5, weight }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
  const totalHueWeight = sortedBins.reduce((s, b) => s + b.weight, 0)
  const dominantHues: HueWeight[] = totalHueWeight > 0
    ? sortedBins
        .filter(b => b.weight > 0)
        .map(b => ({ hue: b.hue, weight: b.weight / totalHueWeight }))
    : []

  const isLowKey = brightness < 0.3 && contrast < 0.3
  const isHighKey = brightness > 0.7 && contrast < 0.3
  const isMonochromatic = saturation < 0.1
  const isHighContrast = contrast > 0.6

  return {
    brightness,
    contrast,
    shadowsRatio,
    highlightsRatio,
    warmth,
    saturation,
    dominantHues,
    isLowKey,
    isHighKey,
    isMonochromatic,
    isHighContrast,
    exif,
  }
}
