/**
 * Дополнительные эффекты: Clarity, Sharpness, Color Chrome
 */

/**
 * Применяет эффект Clarity (микроконтраст)
 * @param amount -5 to +5
 */
export function applyClarity(imageData: ImageData, amount: number): void {
  if (amount === 0) return

  const data = imageData.data
  const factor = amount * 0.1 // Масштабируем

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]

    // Вычисляем яркость
    const luminance = 0.299 * r + 0.587 * g + 0.114 * b

    // Увеличиваем контраст относительно среднего значения
    const mid = 128
    const diff = luminance - mid

    data[i] = clamp(r + diff * factor)
    data[i + 1] = clamp(g + diff * factor)
    data[i + 2] = clamp(b + diff * factor)
  }
}

/**
 * Применяет простой эффект Sharpness
 * @param amount -4 to +4
 */
export function applySharpness(imageData: ImageData, amount: number): void {
  if (amount === 0) return

  // Для упрощения, применим unsharp mask через контраст краёв
  const data = imageData.data
  const factor = amount * 0.15

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]

    // Простейшая версия - усиливаем контраст
    data[i] = clamp(r + (r - 128) * factor)
    data[i + 1] = clamp(g + (g - 128) * factor)
    data[i + 2] = clamp(b + (b - 128) * factor)
  }
}

/**
 * Применяет Color Chrome Effect (усиление насыщенности в цветных областях)
 * @param strength 'off' | 'weak' | 'strong'
 */
export function applyColorChrome(
  imageData: ImageData,
  strength: 'off' | 'weak' | 'strong'
): void {
  if (strength === 'off') return

  const factor = strength === 'weak' ? 0.1 : 0.2
  const data = imageData.data

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]

    // Вычисляем насыщенность
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const chroma = max - min

    // Усиливаем насыщенность только в цветных областях
    if (chroma > 10) {
      const gray = 0.299 * r + 0.587 * g + 0.114 * b
      const boost = 1 + factor * (chroma / 255)

      data[i] = clamp(gray + (r - gray) * boost)
      data[i + 1] = clamp(gray + (g - gray) * boost)
      data[i + 2] = clamp(gray + (b - gray) * boost)
    }
  }
}

/**
 * Применяет Color Chrome FX Blue (усиление синих тонов)
 */
export function applyColorChromeFXBlue(
  imageData: ImageData,
  strength: 'off' | 'weak' | 'strong'
): void {
  if (strength === 'off') return

  const factor = strength === 'weak' ? 1.05 : 1.1
  const data = imageData.data

  for (let i = 0; i < data.length; i += 4) {
    const b = data[i + 2]
    const r = data[i]
    const g = data[i + 1]

    // Усиливаем синий канал, если он доминирует
    if (b > r && b > g) {
      data[i + 2] = clamp(b * factor)
    }
  }
}

function clamp(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

