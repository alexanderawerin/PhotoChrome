import { SMALL_IMAGE_CACHE_MAX_SIZE } from '../constants'
import { getImageKey } from './image-identity'

export const processedPreviewCache = new Map<string, ImageData>()

const resizedPreviewCache = new Map<string, ImageData>()

export function clearPreviewCaches(): void {
  processedPreviewCache.clear()
  resizedPreviewCache.clear()
}

export function previewSize(width: number, height: number, maxDimension: number): { width: number; height: number } {
  const scale = Math.min(1, maxDimension / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

/** Resize before color processing. Temporary large canvas backing is released immediately. */
export function resizePreviewImage(source: ImageData, maxDimension: number): ImageData {
  const size = previewSize(source.width, source.height, maxDimension)
  if (size.width === source.width && size.height === source.height) return source
  const key = `${getImageKey(source)}_${maxDimension}`
  const cached = resizedPreviewCache.get(key)
  if (cached) return cached
  const sourceCanvas = document.createElement('canvas')
  const targetCanvas = document.createElement('canvas')
  try {
    sourceCanvas.width = source.width
    sourceCanvas.height = source.height
    targetCanvas.width = size.width
    targetCanvas.height = size.height
    const sourceContext = sourceCanvas.getContext('2d')
    const targetContext = targetCanvas.getContext('2d')
    if (!sourceContext || !targetContext) throw new Error('Preview canvas unavailable')
    sourceContext.putImageData(source, 0, 0)
    targetContext.drawImage(sourceCanvas, 0, 0, size.width, size.height)
    const result = targetContext.getImageData(0, 0, size.width, size.height)
    if (resizedPreviewCache.size >= SMALL_IMAGE_CACHE_MAX_SIZE) {
      const oldest = resizedPreviewCache.keys().next().value
      if (oldest) resizedPreviewCache.delete(oldest)
    }
    resizedPreviewCache.set(key, result)
    return result
  } finally {
    sourceCanvas.width = sourceCanvas.height = 0
    targetCanvas.width = targetCanvas.height = 0
  }
}
