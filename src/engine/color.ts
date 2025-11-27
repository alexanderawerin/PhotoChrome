import { ColorBalanceConfig } from './types'

/**
 * Применяет цветовой баланс (split-toning) к изображению
 * Shadows применяются к тёмным областям, highlights к светлым
 */
export function applyColorBalance(
  imageData: ImageData,
  colorBalance: ColorBalanceConfig
): void {
  const data = imageData.data

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]

    // Вычисляем яркость пикселя для определения shadow/highlight
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b
    const normalized = luminance / 255

    // Вес для теней и светов (shadows сильнее в тёмных областях)
    const shadowWeight = 1 - normalized
    const highlightWeight = normalized

    // Применяем сдвиги цвета
    data[i] = clamp(
      r +
        colorBalance.shadows.r * shadowWeight +
        colorBalance.highlights.r * highlightWeight
    )
    data[i + 1] = clamp(
      g +
        colorBalance.shadows.g * shadowWeight +
        colorBalance.highlights.g * highlightWeight
    )
    data[i + 2] = clamp(
      b +
        colorBalance.shadows.b * shadowWeight +
        colorBalance.highlights.b * highlightWeight
    )
  }
}

/**
 * Применяет коррекцию насыщенности
 * @param factor -1 (полная десатурация) до +1 (удвоенная насыщенность)
 */
export function applySaturation(imageData: ImageData, factor: number): void {
  const data = imageData.data
  const multiplier = 1 + factor

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]

    // Вычисляем яркость (grayscale)
    const gray = 0.299 * r + 0.587 * g + 0.114 * b

    // Интерполируем между серым и исходным цветом
    data[i] = clamp(gray + (r - gray) * multiplier)
    data[i + 1] = clamp(gray + (g - gray) * multiplier)
    data[i + 2] = clamp(gray + (b - gray) * multiplier)
  }
}

/**
 * Применяет сдвиг баланса белого
 */
export function applyWhiteBalanceShift(
  imageData: ImageData,
  redShift: number,
  blueShift: number
): void {
  const data = imageData.data

  // Нормализуем сдвиги (диапазон -9 до +9, масштабируем к меньшим значениям)
  const rShift = redShift * 2.5
  const bShift = blueShift * 2.5

  for (let i = 0; i < data.length; i += 4) {
    data[i] = clamp(data[i] + rShift)     // Red
    data[i + 2] = clamp(data[i + 2] + bShift) // Blue
  }
}

/**
 * Применяет Highlight/Shadow tone adjustment
 */
export function applyToneAdjustment(
  imageData: ImageData,
  highlightAdjust: number, // -2 to +4
  shadowAdjust: number     // -2 to +4
): void {
  const data = imageData.data

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]

    // Вычисляем яркость
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b
    const normalized = luminance / 255

    // Применяем корректировки
    // Shadows влияют на тёмные области
    const shadowMult = shadowAdjust * (1 - normalized) * 5
    // Highlights влияют на светлые области
    const highlightMult = highlightAdjust * normalized * 5

    data[i] = clamp(r + shadowMult + highlightMult)
    data[i + 1] = clamp(g + shadowMult + highlightMult)
    data[i + 2] = clamp(b + shadowMult + highlightMult)
  }
}

/**
 * Clamp значение в диапазоне 0-255
 */
function clamp(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

