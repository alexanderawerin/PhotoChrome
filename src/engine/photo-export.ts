import { ImageProcessor, type ExifInfo } from './processor'
import type { ProcessingPlan } from './types'
import { prepareProcessingPlanResources } from './processing-plan'

type PhotoExportErrorCode = 'processing-failed' | 'encoding-failed' | 'download-failed'

const EXPORT_PREVIEW_MAX_SIZE = 480

export interface ExportPreview {
  fileName: string
  imageData: ImageData
}

export type PhotoExportResult =
  | { status: 'success'; fileName: string; preview: ExportPreview | null }
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

export async function createExportPreview(blob: Blob, fileName: string): Promise<ExportPreview | null> {
  try {
    const file = new File([blob], fileName, { type: blob.type || 'image/jpeg' })
    return {
      fileName,
      imageData: await ImageProcessor.createThumbnail(file, EXPORT_PREVIEW_MAX_SIZE),
    }
  } catch {
    // A preview is a convenience for completion UI; it must not invalidate a saved export.
    return null
  }
}

export async function exportPhoto(request: PhotoExportRequest): Promise<PhotoExportResult> {
  let phase: PhotoExportErrorCode = 'processing-failed'
  try {
    const plan = await prepareProcessingPlanResources(request.plan, { signal: request.signal })
    const processed = await ImageProcessor.processAsync(
      request.imageData,
      plan,
      { signal: request.signal }
    )

    phase = 'encoding-failed'
    const withWatermark = ImageProcessor.addWatermark(processed, request.watermarkText)
    const blob = await ImageProcessor.imageDataToBlob(withWatermark, 0.95, request.exifInfo)

    request.signal?.throwIfAborted()
    phase = 'download-failed'
    const url = URL.createObjectURL(blob)
    try {
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = request.fileName
      document.body.appendChild(anchor)
      try {
        request.signal?.throwIfAborted()
        anchor.click()
      } finally {
        anchor.remove()
      }
    } finally {
      URL.revokeObjectURL(url)
    }

    return {
      status: 'success',
      fileName: request.fileName,
      preview: await createExportPreview(blob, request.fileName),
    }
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
