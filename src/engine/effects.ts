/**
 * Дополнительные эффекты: Clarity, Sharpness, Color Chrome
 */

import { clamp, luminance } from './utils'
import type { EffectStrength } from './types'

/**
 * Применяет эффект Clarity (микроконтраст / локальный контраст)
 * Работает на средних тонах, не затрагивая тени и света
 * @param amount -5 to +5
 */
export function applyClarity(imageData: ImageData, amount: number): void {
  if (amount === 0) return

  const data = imageData.data
  const factor = amount * 0.08

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]

    // Вычисляем яркость
    const lum = luminance(r, g, b)

    // Clarity влияет сильнее на средние тона (midtones)
    // Используем параболу с максимумом в середине
    const midtoneFactor = 1 - Math.abs(lum - 128) / 128
    const adjustedFactor = factor * midtoneFactor

    // Усиливаем контраст относительно среднего
    const diff = lum - 128

    data[i] = clamp(r + diff * adjustedFactor)
    data[i + 1] = clamp(g + diff * adjustedFactor)
    data[i + 2] = clamp(b + diff * adjustedFactor)
  }
}

/**
 * Применяет Unsharp Mask для резкости
 * @param amount -4 to +4
 */
export function applySharpness(imageData: ImageData, amount: number): void {
  if (amount === 0) return

  const { width, height, data } = imageData

  // Создаём копию яркостного канала
  const luminanceChannel = new Float32Array(width * height)
  for (let i = 0; i < width * height; i++) {
    const idx = i * 4
    luminanceChannel[i] = luminance(data[idx], data[idx + 1], data[idx + 2])
  }

  // Размываем яркостный канал (простой box blur 3x3)
  const blurred = new Float32Array(width * height)
  const radius = 1

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0
      let count = 0

      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const nx = x + dx
          const ny = y + dy
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            sum += luminanceChannel[ny * width + nx]
            count++
          }
        }
      }

      blurred[y * width + x] = sum / count
    }
  }

  // Unsharp mask: original + amount * (original - blurred)
  const strength = amount * 0.5 // Масштабируем для более мягкого эффекта

  for (let i = 0; i < width * height; i++) {
    const idx = i * 4
    const diff = luminanceChannel[i] - blurred[i]
    const sharpening = diff * strength

    data[idx] = clamp(data[idx] + sharpening)
    data[idx + 1] = clamp(data[idx + 1] + sharpening)
    data[idx + 2] = clamp(data[idx + 2] + sharpening)
  }
}

/**
 * Применяет Color Chrome Effect (усиление насыщенности в цветных областях)
 * Имитирует богатство цвета плёнки Fujifilm
 * @param strength 'off' | 'weak' | 'strong'
 */
export function applyColorChrome(
  imageData: ImageData,
  strength: EffectStrength
): void {
  if (strength === 'off') return

  const factor = strength === 'weak' ? 0.12 : 0.25
  const data = imageData.data

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]

    // Вычисляем насыщенность (chroma)
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const chroma = max - min

    // Color Chrome усиливает насыщенность только в уже насыщенных областях
    // и особенно в тёмных тонах (как плёнка)
    if (chroma > 15) {
      const gray = luminance(r, g, b)
      
      // Сильнее влияет на тёмные и средние тона
      const toneFactor = 1 - Math.pow(gray / 255, 0.5) * 0.5
      const boost = 1 + factor * (chroma / 255) * toneFactor

      data[i] = clamp(gray + (r - gray) * boost)
      data[i + 1] = clamp(gray + (g - gray) * boost)
      data[i + 2] = clamp(gray + (b - gray) * boost)
    }
  }
}

/**
 * Применяет Color Chrome FX Blue (усиление и углубление синих тонов)
 * Делает небо и синие оттенки более глубокими
 */
export function applyColorChromeFXBlue(
  imageData: ImageData,
  strength: EffectStrength
): void {
  if (strength === 'off') return

  const satBoost = strength === 'weak' ? 1.08 : 1.15
  const deepenFactor = strength === 'weak' ? 0.03 : 0.06
  const data = imageData.data

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]

    // Определяем "синевизну" пикселя
    // Синий доминирует, красный и зелёный ниже
    const blueRatio = b / (Math.max(r, g) + 1)
    
    if (blueRatio > 1.1 && b > 50) {
      const gray = luminance(r, g, b)
      
      // Усиливаем насыщенность синего
      data[i] = clamp(gray + (r - gray) * satBoost)
      data[i + 1] = clamp(gray + (g - gray) * satBoost)
      data[i + 2] = clamp(gray + (b - gray) * satBoost)

      // Дополнительно углубляем синий (чуть уменьшаем red/green)
      data[i] = clamp(data[i] - data[i] * deepenFactor)
      data[i + 1] = clamp(data[i + 1] - data[i + 1] * deepenFactor * 0.5)
    }
  }
}
