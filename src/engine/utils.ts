/**
 * Общие утилиты для движка обработки изображений
 */

/**
 * Clamp значение в диапазоне 0-255
 */
export function clamp(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)))
}

/**
 * Clamp значение в произвольном диапазоне
 */
export function clampRange(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Линейная интерполяция
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

/**
 * Вычисление яркости пикселя (ITU-R BT.601)
 */
export function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

