/**
 * Генерирует и накладывает плёночное зерно на изображение
 */

import { clamp } from './utils'
import type { EffectStrength, GrainSize } from './types'

/**
 * Применяет эффект зерна к изображению
 * @param strength 0 to 1 (0 = no grain, 1 = maximum grain)
 * @param size 0.5 to 2 (размер зёрен: 1.0 = normal, >1 = larger grains)
 */
export function applyGrain(
  imageData: ImageData,
  strength: number,
  size: number = 1.0
): void {
  if (strength === 0) return

  const data = imageData.data
  const width = imageData.width
  const height = imageData.height

  // Интенсивность шума
  const grainIntensity = strength * 30

  // Для крупного зерна создаём шум в уменьшенном разрешении и масштабируем
  if (size > 1.0) {
    // Вычисляем размер уменьшенной сетки шума
    const scaleFactor = size
    const noiseWidth = Math.max(1, Math.ceil(width / scaleFactor))
    const noiseHeight = Math.max(1, Math.ceil(height / scaleFactor))

    // Генерируем уменьшенную карту шума
    const noiseMap = new Float32Array(noiseWidth * noiseHeight)
    for (let i = 0; i < noiseMap.length; i++) {
      noiseMap[i] = (Math.random() - 0.5) * grainIntensity * 2
    }

    // Применяем с билинейной интерполяцией для плавности
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4

        // Координаты в карте шума
        const nx = x / scaleFactor
        const ny = y / scaleFactor

        // Индексы для билинейной интерполяции
        const x0 = Math.floor(nx)
        const y0 = Math.floor(ny)
        const x1 = Math.min(x0 + 1, noiseWidth - 1)
        const y1 = Math.min(y0 + 1, noiseHeight - 1)

        const fx = nx - x0
        const fy = ny - y0

        // Билинейная интерполяция
        const n00 = noiseMap[y0 * noiseWidth + x0]
        const n10 = noiseMap[y0 * noiseWidth + x1]
        const n01 = noiseMap[y1 * noiseWidth + x0]
        const n11 = noiseMap[y1 * noiseWidth + x1]

        const noise = 
          n00 * (1 - fx) * (1 - fy) +
          n10 * fx * (1 - fy) +
          n01 * (1 - fx) * fy +
          n11 * fx * fy

        data[idx] = clamp(data[idx] + noise)
        data[idx + 1] = clamp(data[idx + 1] + noise)
        data[idx + 2] = clamp(data[idx + 2] + noise)
      }
    }
  } else {
    // Стандартное мелкое зерно - попиксельный шум
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * grainIntensity * 2
      data[i] = clamp(data[i] + noise)
      data[i + 1] = clamp(data[i + 1] + noise)
      data[i + 2] = clamp(data[i + 2] + noise)
    }
  }
}

/**
 * Преобразует настройки Fuji в параметры зерна
 */
export function grainEffectToStrength(effect: EffectStrength): number {
  switch (effect) {
    case 'off':
      return 0
    case 'weak':
      return 0.3
    case 'strong':
      return 0.6
    default:
      return 0
  }
}

export function grainSizeToNumber(size: GrainSize): number {
  return size === 'small' ? 1.0 : 2.0
}
