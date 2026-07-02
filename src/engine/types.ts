// Типы для движка обработки изображений

import type { ExifSubset } from './exif'
import type { HaldCLUT } from './haldclut'
import type { ImageTransformState } from './transform'

export type EffectStrength = 'off' | 'weak' | 'strong'
export type GrainSize = 'small' | 'large'
export type Rotation = 0 | 90 | 180 | 270

export interface CurvePoints {
  points: [number, number][]
}

export interface ColorBalance {
  r: number
  g: number
  b: number
}

export interface ColorBalanceConfig {
  shadows: ColorBalance
  highlights: ColorBalance
}

export interface GrainConfig {
  strength: number
  size: number
}

export interface FilmSimulation {
  id: string
  name: string
  // Curve-based approach (used when no HaldCLUT is loaded)
  curve?: CurvePoints
  colorBalance?: ColorBalanceConfig
  saturation?: number
  // HaldCLUT approach (path to PNG asset, resolved at runtime)
  lutImage?: string
}

export interface RecipeSettings {
  dynamicRange?: 'DR100' | 'DR200' | 'DR400'
  highlight?: number  // -2 to +4
  shadow?: number     // -2 to +4
  color?: number      // -4 to +4
  sharpness?: number  // -4 to +4
  clarity?: number    // -5 to +5
  grainEffect?: EffectStrength
  grainSize?: GrainSize
  colorChromeEffect?: EffectStrength
  colorChromeFXBlue?: EffectStrength
  whiteBalance?: 'auto' | 'daylight' | 'shade' | 'cloudy' | 'tungsten' | 'fluorescent'
  whiteBalanceKelvin?: number  // 2500-10000, overrides whiteBalance when set
  wbShiftRed?: number   // -9 to +9
  wbShiftBlue?: number  // -9 to +9
}

export interface Recipe {
  id: string
  name: string
  author?: string
  filmSimulation: string
  settings: RecipeSettings
  // Optional metadata
  sourceUrl?: string     // e.g. "https://fujixweekly.com/..."
  description?: string   // max ~120 chars
  cameraModel?: string   // e.g. "X-T5"
}

export interface ProcessingTargetSize {
  width: number
  height: number
}

export interface ProcessingRecipeIdentity {
  id: string
  name: string
  simulationId: string
}

/**
 * Structured-clone-safe description consumed unchanged by CPU, worker and
 * WebGL processing paths.
 */
export interface ProcessingPlan {
  version: 1
  recipe: ProcessingRecipeIdentity
  simulation: FilmSimulation
  settings: RecipeSettings
  lut: HaldCLUT | null
  targetSize: ProcessingTargetSize
}

/**
 * Представляет отдельное изображение в мульти-режиме
 * со всеми его настройками и состоянием
 */
export interface ImageItem {
  /** Уникальный идентификатор */
  id: string
  /** Оригинальный файл */
  file: File
  /** Имя файла для отображения */
  fileName: string
  /** Полноразмерное изображение */
  original: ImageData
  /** Превью для быстрой обработки */
  thumbnail: ImageData
  /** EXIF-данные (ISO, цветовая температура) для рекомендаций */
  exif?: ExifSubset

  /** Выбранный рецепт для этого изображения */
  recipe: Recipe | null
  /** Пользовательские настройки тюнинга */
  customSettings: RecipeSettings

  /** Трансформированное полноразмерное изображение */
  transformedOriginal: ImageData
  /** Трансформированное превью */
  transformedThumbnail: ImageData
  /** Текущий угол поворота */
  rotation: Rotation
  /** Недеструктивное состояние геометрии для mobile editor. */
  transform: ImageTransformState
}

/**
 * Состояние для работы с множественными изображениями
 */
export interface MultiImageState {
  /** Массив загруженных изображений */
  images: ImageItem[]
  /** Индекс текущего активного изображения */
  currentIndex: number
}
