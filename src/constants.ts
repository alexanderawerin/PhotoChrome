/**
 * Application-wide constants.
 * Centralizes magic numbers and configuration values for maintainability.
 */

// ============================================================================
// App Info
// ============================================================================

/** Application version */
export const APP_VERSION = '1.0'

/** Application URL for watermark */
export const APP_URL = 'photochrome.netdesigner.ru'

// ============================================================================
// Image Processing
// ============================================================================

/** Maximum size of thumbnail for editor preview (pixels) */
export const THUMBNAIL_MAX_SIZE = 1600

/** Size of small preview images in recipe cards (pixels) */
export const RECIPE_CARD_PREVIEW_SIZE = 250

/** JPEG export quality (0.0 - 1.0) */
export const EXPORT_JPEG_QUALITY = 0.95

// ============================================================================
// UI Timing
// ============================================================================

/** Delay before generating preview to prioritize UI responsiveness (ms) */
export const PREVIEW_GENERATION_DELAY = 50

/** Debounce delay for resize events (ms) */
export const RESIZE_DEBOUNCE_DELAY = 100

// ============================================================================
// Cache Configuration
// ============================================================================

/** Maximum number of processed preview images to cache */
export const PREVIEW_CACHE_MAX_SIZE = 100

/** Maximum number of small images to cache */
export const SMALL_IMAGE_CACHE_MAX_SIZE = 100

/** Number of sample points for image hashing (for cache key generation) */
export const IMAGE_HASH_SAMPLE_COUNT = 16

// ============================================================================
// Image Effects
// ============================================================================

/** Grain intensity multiplier */
export const GRAIN_INTENSITY_MULTIPLIER = 30

/** Color saturation normalization factor (maps -4..+4 to -0.4..+0.4) */
export const SATURATION_NORMALIZATION_FACTOR = 10

/** Tone adjustment multiplier for highlights/shadows */
export const TONE_ADJUSTMENT_MULTIPLIER = 8

/** Clarity effect factor */
export const CLARITY_EFFECT_FACTOR = 0.08

/** Sharpness strength multiplier */
export const SHARPNESS_STRENGTH_MULTIPLIER = 0.5

/** White balance shift scale factor */
export const WB_SHIFT_SCALE_FACTOR = 2.5

// ============================================================================
// UI Layout
// ============================================================================

/** Recipe panel width (px) */
export const RECIPE_PANEL_WIDTH = 288 // w-72 = 18rem = 288px

/** Circle animation parameters */
export const PHOTO_ARC = {
  /** Mobile settings */
  MOBILE: {
    CARD_COUNT: 12,
    RADIUS: 200,
    CARD_SIZE: 80,
  },
  /** Desktop settings */
  DESKTOP: {
    CARD_COUNT: 16,
    RADIUS: 320,
    CARD_SIZE: 100,
  },
} as const

// ============================================================================
// Keyboard Shortcuts
// ============================================================================

export const KEYBOARD_SHORTCUTS = {
  ROTATE_CLOCKWISE: 'r',
  ROTATE_COUNTER_CLOCKWISE: 'R', // Shift+R
  CROP: 'c',
  CANCEL: 'Escape',
  APPLY: 'Enter',
  COMPARE: ' ', // Space
  EXPORT: 's', // Ctrl/Cmd+S
} as const

