import { ImageProcessor, type ExifInfo } from './processor'
import type { ProcessingPlan } from './types'

export type PhotoExportErrorCode = 'processing-failed' | 'encoding-failed' | 'download-failed'

export type PhotoExportResult =
  | { status: 'success'; fileName: string }
  | { status: 'cancelled' }
  | {
      status: 'error'
      error: {
        code: PhotoExportErrorCode
        message: string
      }
    }

export interface PhotoExportRequest {
  imageData: ImageData
  plan: ProcessingPlan
  fileName: string
  watermarkText: string
  exifInfo: ExifInfo
  signal?: AbortSignal
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError'
}

export async function exportPhoto(request: PhotoExportRequest): Promise<PhotoExportResult> {
  let phase: PhotoExportErrorCode = 'processing-failed'
  try {
    const processed = await ImageProcessor.processAsync(
      request.imageData,
      request.plan,
      { signal: request.signal }
    )

    phase = 'encoding-failed'
    const withWatermark = ImageProcessor.addWatermark(processed, request.watermarkText)
    const blob = await ImageProcessor.imageDataToBlob(withWatermark, 0.95, request.exifInfo)

    phase = 'download-failed'
    const url = URL.createObjectURL(blob)
    try {
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = request.fileName
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
    } finally {
      URL.revokeObjectURL(url)
    }

    return { status: 'success', fileName: request.fileName }
  } catch (error) {
    if (isAbortError(error) || request.signal?.aborted) return { status: 'cancelled' }
    return {
      status: 'error',
      error: {
        code: phase,
        message: error instanceof Error ? error.message : 'Photo export failed',
      },
    }
  }
}
