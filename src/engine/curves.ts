import { CurvePoints } from './types'

/**
 * Создаёт LUT (lookup table) из точек кривой для быстрого применения
 * @param curvePoints Точки кривой [[x, y], ...]
 * @returns Массив значений 0-255 для каждого входного значения
 */
export function createCurveLUT(curvePoints: CurvePoints): Uint8Array {
  const lut = new Uint8Array(256)
  const points = curvePoints.points.sort((a, b) => a[0] - b[0])

  for (let i = 0; i < 256; i++) {
    lut[i] = interpolateCurve(i, points)
  }

  return lut
}

/**
 * Интерполирует значение на кривой
 */
function interpolateCurve(x: number, points: [number, number][]): number {
  // Если x меньше первой точки
  if (x <= points[0][0]) {
    return Math.max(0, Math.min(255, Math.round(points[0][1])))
  }

  // Если x больше последней точки
  if (x >= points[points.length - 1][0]) {
    return Math.max(0, Math.min(255, Math.round(points[points.length - 1][1])))
  }

  // Найдём две точки, между которыми находится x
  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i]
    const [x2, y2] = points[i + 1]

    if (x >= x1 && x <= x2) {
      // Линейная интерполяция
      const t = (x - x1) / (x2 - x1)
      const y = y1 + (y2 - y1) * t
      return Math.max(0, Math.min(255, Math.round(y)))
    }
  }

  return x // Fallback
}

/**
 * Применяет кривую к каналу изображения
 */
export function applyCurve(
  imageData: ImageData,
  curveLUT: Uint8Array,
  channel: 'r' | 'g' | 'b' | 'rgb'
): void {
  const data = imageData.data

  for (let i = 0; i < data.length; i += 4) {
    if (channel === 'rgb' || channel === 'r') {
      data[i] = curveLUT[data[i]]
    }
    if (channel === 'rgb' || channel === 'g') {
      data[i + 1] = curveLUT[data[i + 1]]
    }
    if (channel === 'rgb' || channel === 'b') {
      data[i + 2] = curveLUT[data[i + 2]]
    }
  }
}

/**
 * Создаёт линейную (identity) кривую
 */
export function createLinearCurve(): CurvePoints {
  return {
    points: [
      [0, 0],
      [255, 255]
    ]
  }
}

