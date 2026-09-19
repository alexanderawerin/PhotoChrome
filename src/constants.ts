/**
 * Application-wide constants.
 * Centralizes magic numbers and configuration values for maintainability.
 */

// ============================================================================
// App Info
// ============================================================================

/** Application version */
export const APP_VERSION = '1.6'

/** Application URL for watermark */
export const APP_URL = 'photochrome.netdesigner.ru'

/** GitHub repository URL */
export const GITHUB_REPO_URL = 'https://github.com/alexanderawerin/photochrome'

// ============================================================================
// Image Processing
// ============================================================================

/** Maximum size of thumbnail for editor preview (pixels) */
export const THUMBNAIL_MAX_SIZE = 1600

/** Size of small preview images in recipe cards (pixels) */
export const RECIPE_CARD_PREVIEW_SIZE = 250

// ============================================================================
// Video Processing
// ============================================================================

/** Maximum video duration in seconds */
export const VIDEO_MAX_DURATION = 30

/** Video export FPS */
export const VIDEO_EXPORT_FPS = 30

/** Video export bitrate (5 Mbps) */
export const VIDEO_EXPORT_BITRATE = 5_000_000

/** Audio export bitrate (128 kbps) */
export const VIDEO_AUDIO_BITRATE = 128_000

/** Audio export sample rate (48 kHz - standard for video) */
export const VIDEO_AUDIO_SAMPLE_RATE = 48_000

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
