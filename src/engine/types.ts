// Типы для движка обработки изображений

export interface Point {
  x: number
  y: number
}

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
  curve: CurvePoints
  colorBalance?: ColorBalanceConfig
  saturation?: number
}

export interface RecipeSettings {
  dynamicRange?: 'DR100' | 'DR200' | 'DR400'
  highlight?: number  // -2 to +4
  shadow?: number     // -2 to +4
  color?: number      // -4 to +4
  sharpness?: number  // -4 to +4
  clarity?: number    // -5 to +5
  grainEffect?: 'off' | 'weak' | 'strong'
  grainSize?: 'small' | 'large'
  colorChromeEffect?: 'off' | 'weak' | 'strong'
  colorChromeFXBlue?: 'off' | 'weak' | 'strong'
  whiteBalance?: 'auto' | 'daylight' | 'shade' | 'cloudy' | 'tungsten' | 'fluorescent'
  wbShiftRed?: number   // -9 to +9
  wbShiftBlue?: number  // -9 to +9
}

export interface Recipe {
  id: string
  name: string
  author?: string
  filmSimulation: string
  settings: RecipeSettings
}

export interface ProcessingOptions {
  simulation: FilmSimulation
  settings?: RecipeSettings
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

  /** Выбранный рецепт для этого изображения */
  recipe: Recipe | null
  /** Пользовательские настройки тюнинга */
  customSettings: RecipeSettings

  /** Трансформированное полноразмерное изображение */
  transformedOriginal: ImageData
  /** Трансформированное превью */
  transformedThumbnail: ImageData
  /** Текущий угол поворота */
  rotation: 0 | 90 | 180 | 270
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

