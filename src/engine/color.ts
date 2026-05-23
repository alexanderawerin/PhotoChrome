import { ColorBalanceConfig } from './types'
import { clamp, luminance } from './utils'
import { kelvinToRGBMultipliers } from './whitebalance'

/**
 * Эмулирует расширение динамического диапазона Fujifilm (DR100/200/400).
 * DR200 и DR400 поднимают тени и слегка компрессируют света.
 */
export function applyDynamicRange(
  imageData: ImageData,
  dr: 'DR100' | 'DR200' | 'DR400'
): void {
  if (dr === 'DR100') return

  const data = imageData.data
  const shadowLift = dr === 'DR200' ? 15 : 30
  const highlightCompress = dr === 'DR200' ? 0.06 : 0.12

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const lum = luminance(r, g, b)
    const normalized = lum / 255

    const shadowWeight = Math.pow(1 - normalized, 2)
    const lift = shadowLift * shadowWeight

    const highlightWeight = Math.pow(normalized, 2)
    const compress = -highlightCompress * 255 * highlightWeight

    data[i]     = clamp(r + lift + compress)
    data[i + 1] = clamp(g + lift + compress)
    data[i + 2] = clamp(b + lift + compress)
  }
}

/**
 * Сдвиги R/B в единицах wbShift (-9..+9) для пресетов баланса белого.
 * Относительно автоматического (нейтрального) баланса.
 */
const WB_PRESET_SHIFTS: Record<string, { r: number; b: number }> = {
  auto:         { r:  0, b:  0 },
  daylight:     { r:  0, b:  0 },  // Reference point (~5500K)
  shade:        { r:  3, b: -3 },  // Warmer (~7000K)
  cloudy:       { r:  1, b: -1 },  // Slightly warmer (~6500K)
  tungsten:     { r: -6, b:  5 },  // Much cooler/blue (~3200K)
  fluorescent:  { r: -3, b:  2 },  // Cool-ish (~4000K)
}

/**
 * Применяет пресет баланса белого (daylight, shade, cloudy, tungsten, fluorescent).
 * Конвертирует температурный пресет в R/B сдвиг.
 */
export function applyWhiteBalancePreset(
  imageData: ImageData,
  preset: string
): void {
  const shift = WB_PRESET_SHIFTS[preset]
  if (!shift || (shift.r === 0 && shift.b === 0)) return
  applyWhiteBalanceShift(imageData, shift.r, shift.b)
}

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
    const lum = luminance(r, g, b)
    const normalized = lum / 255

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
    const gray = luminance(r, g, b)

    // Интерполируем между серым и исходным цветом
    data[i] = clamp(gray + (r - gray) * multiplier)
    data[i + 1] = clamp(gray + (g - gray) * multiplier)
    data[i + 2] = clamp(gray + (b - gray) * multiplier)
  }
}

/**
 * Applies white balance correction based on a color temperature in Kelvin.
 * Uses Tanner Helland's approximation. Kelvin range: 2500-10000.
 */
export function applyWhiteBalanceKelvin(imageData: ImageData, kelvin: number): void {
  const [rMult, , bMult] = kelvinToRGBMultipliers(kelvin)
  // Normalize relative to 5500K (daylight neutral)
  const [rRef, , bRef] = kelvinToRGBMultipliers(5500)
  const rScale = rMult / rRef
  const bScale = bMult / bRef

  const data = imageData.data
  for (let i = 0; i < data.length; i += 4) {
    data[i]     = Math.max(0, Math.min(255, data[i]     * rScale))
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] * bScale))
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
    const lum = luminance(r, g, b)
    const normalized = lum / 255

    // Применяем корректировки с мягкими переходами
    // Shadows влияют на тёмные области (кубическая функция для плавности)
    const shadowWeight = Math.pow(1 - normalized, 2)
    const shadowMult = shadowAdjust * shadowWeight * 8

    // Highlights влияют на светлые области
    const highlightWeight = Math.pow(normalized, 2)
    const highlightMult = highlightAdjust * highlightWeight * 8

    data[i] = clamp(r + shadowMult + highlightMult)
    data[i + 1] = clamp(g + shadowMult + highlightMult)
    data[i + 2] = clamp(b + shadowMult + highlightMult)
  }
}
