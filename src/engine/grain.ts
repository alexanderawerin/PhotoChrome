/**
 * Генерирует и накладывает плёночное зерно на изображение
 */

/**
 * Применяет эффект зерна к изображению
 * @param strength 0 to 1 (0 = no grain, 1 = maximum grain)
 * @param size 0.5 to 2 (размер зёрен)
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

  // Генерируем шум
  const grainIntensity = strength * 25 // Масштабируем до подходящего диапазона

  for (let i = 0; i < data.length; i += 4) {
    // Простой монохромный шум (одинаковый для всех каналов)
    const noise = (Math.random() - 0.5) * grainIntensity * 2

    data[i] = clamp(data[i] + noise)       // R
    data[i + 1] = clamp(data[i + 1] + noise) // G
    data[i + 2] = clamp(data[i + 2] + noise) // B
  }
}

/**
 * Преобразует настройки Fuji в параметры зерна
 */
export function grainEffectToStrength(effect: 'off' | 'weak' | 'strong'): number {
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

export function grainSizeToNumber(size: 'small' | 'large'): number {
  return size === 'small' ? 1.0 : 1.5
}

function clamp(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

