// Типы для движка обработки изображений

import type { HaldCLUT } from './haldclut'
import type { ImageTransformState } from './transform'

export type EffectStrength = 'off' | 'weak' | 'strong'
export type GrainSize = 'small' | 'large'

export interface CurvePoints {
  points: [number, number][]
}

interface ColorBalance {
  r: number
  g: number
  b: number
}

export interface ColorBalanceConfig {
  shadows: ColorBalance
  highlights: ColorBalance
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
  /** Base film adapter; detailed catalog recipes leave this absent. */
  profileKind?: 'base'
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

interface ProcessingRecipeIdentity {
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
  /** Absent on older film plans; Original explicitly bypasses color processing. */
  colorMode?: 'film' | 'original'
  recipe: ProcessingRecipeIdentity
  simulation: FilmSimulation
  settings: RecipeSettings
  lut: HaldCLUT | null
  targetSize: ProcessingTargetSize
  /** Immutable video geometry snapshot; color selection never changes composition. */
  geometry?: ImageTransformState
}

/**
 * Представляет отдельное изображение в мульти-режиме
 * со всеми его настройками и состоянием
 */
export interface ImageItem {
  /** Уникальный идентификатор */
  id: string
  /** Оригинальный файл */
  readonly file: File
  /** Имя файла для отображения */
  fileName: string
  /** Full source dimensions; full-resolution pixels are decoded only for export. */
  readonly sourceSize: { readonly width: number; readonly height: number }
  /** Превью для быстрой обработки */
  thumbnail: ImageData

  /** Выбранный рецепт для этого изображения */
  recipe: Recipe | null
  /** Пользовательские настройки тюнинга */
  customSettings: RecipeSettings

  /** Трансформированное превью */
  transformedThumbnail: ImageData
  /** Недеструктивное состояние геометрии изображения. */
  transform: ImageTransformState
}
