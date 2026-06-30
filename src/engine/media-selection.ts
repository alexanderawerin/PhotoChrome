export const SUPPORTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const

export interface MediaSelectionLimits {
  maxFiles: number
  maxBytesPerFile: number
  maxPixelsPerFile: number
  maxTotalPixels: number
  acceptedMimeTypes: readonly string[]
}

export const DEFAULT_MEDIA_SELECTION_LIMITS: MediaSelectionLimits = {
  maxFiles: 20,
  maxBytesPerFile: 25 * 1024 * 1024,
  maxPixelsPerFile: 64_000_000,
  maxTotalPixels: 200_000_000,
  acceptedMimeTypes: SUPPORTED_IMAGE_TYPES,
}

export interface MediaSelectionItem {
  file: File
  width?: number
  height?: number
}

export type MediaValidationErrorCode =
  | 'empty-selection'
  | 'too-many-files'
  | 'unsupported-type'
  | 'file-too-large'
  | 'invalid-dimensions'
  | 'too-many-pixels'
  | 'too-many-total-pixels'

export type MediaValidationResult =
  | { valid: true; totalPixels: number }
  | {
      valid: false
      error: {
        code: MediaValidationErrorCode
        message: string
        fileName?: string
      }
    }

const megapixels = (pixels: number) => `${Math.round(pixels / 100_000) / 10} MP`

/** Validates the entire selection. No subset is returned or accepted. */
export function validateMediaSelection(
  items: readonly MediaSelectionItem[],
  limits: MediaSelectionLimits = DEFAULT_MEDIA_SELECTION_LIMITS
): MediaValidationResult {
  if (items.length === 0) {
    return { valid: false, error: { code: 'empty-selection', message: 'No images selected.' } }
  }
  if (items.length > limits.maxFiles) {
    return {
      valid: false,
      error: { code: 'too-many-files', message: `Select no more than ${limits.maxFiles} images.` },
    }
  }

  let totalPixels = 0
  for (const { file, width, height } of items) {
    if (!limits.acceptedMimeTypes.includes(file.type.toLowerCase())) {
      return {
        valid: false,
        error: {
          code: 'unsupported-type',
          fileName: file.name,
          message: `${file.name} is not a supported JPEG, PNG, WebP, or GIF image.`,
        },
      }
    }
    if (file.size > limits.maxBytesPerFile) {
      return {
        valid: false,
        error: {
          code: 'file-too-large',
          fileName: file.name,
          message: `${file.name} exceeds the 25 MB file limit.`,
        },
      }
    }

    if (width === undefined && height === undefined) continue
    if (!Number.isInteger(width) || !Number.isInteger(height) || width! <= 0 || height! <= 0) {
      return {
        valid: false,
        error: { code: 'invalid-dimensions', fileName: file.name, message: `${file.name} has invalid dimensions.` },
      }
    }

    const pixels = width! * height!
    if (!Number.isSafeInteger(pixels) || pixels > limits.maxPixelsPerFile) {
      return {
        valid: false,
        error: {
          code: 'too-many-pixels',
          fileName: file.name,
          message: `${file.name} is ${megapixels(pixels)}; the limit is ${megapixels(limits.maxPixelsPerFile)}.`,
        },
      }
    }
    totalPixels += pixels
  }

  if (totalPixels > limits.maxTotalPixels) {
    return {
      valid: false,
      error: {
        code: 'too-many-total-pixels',
        message: `The selected images total ${megapixels(totalPixels)}; the limit is ${megapixels(limits.maxTotalPixels)}.`,
      },
    }
  }

  return { valid: true, totalPixels }
}
