import { APP_URL } from '../constants'
import { createProcessingPlan } from './processing-plan'
import { ImageProcessor } from './processor'
import type { ImageItem } from './types'
import { loadSimulationLUT } from '../presets/simulations'

export interface BatchExportProgress {
  current: number
  total: number
  fileName: string | null
  exported: number
  skipped: number
  errors: number
}

export interface BatchExportIssue {
  fileName: string
  reason: string
}

export type BatchExportResult =
  | {
      status: 'success'
      archiveName: string
      blob: Blob
      exported: number
      skipped: number
      errors: number
      report: string | null
    }
  | {
      status: 'cancelled'
      exported: number
      skipped: number
      errors: number
    }
  | {
      status: 'error'
      message: string
      exported: number
      skipped: number
      errors: number
    }

export interface BatchExportOptions {
  signal?: AbortSignal
  onProgress?: (progress: BatchExportProgress) => void
  now?: Date
}

function pad(value: number): string {
  return value.toString().padStart(2, '0')
}

export function createBatchArchiveName(date: Date): string {
  return `photochrome_batch_${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}.zip`
}

function sanitizeFilePart(value: string): string {
  return value.replace(/[\\/:*?"<>|%]/g, '_').trim() || 'photo'
}

export function createBatchPhotoName(fileName: string, recipeId: string): string {
  const baseName = sanitizeFilePart(fileName.replace(/\.[^.]+$/, ''))
  return `photochrome_${sanitizeFilePart(recipeId)}_${baseName}.jpg`
}

export function createUniqueFileName(desiredName: string, usedNames: Set<string>): string {
  const normalized = desiredName.toLowerCase()
  if (!usedNames.has(normalized)) {
    usedNames.add(normalized)
    return desiredName
  }
  const extensionIndex = desiredName.lastIndexOf('.')
  const base = extensionIndex > 0 ? desiredName.slice(0, extensionIndex) : desiredName
  const extension = extensionIndex > 0 ? desiredName.slice(extensionIndex) : ''
  let suffix = 2
  while (usedNames.has(`${base}_${suffix}${extension}`.toLowerCase())) suffix++
  const uniqueName = `${base}_${suffix}${extension}`
  usedNames.add(uniqueName.toLowerCase())
  return uniqueName
}

export function createBatchExportReport(
  exported: number,
  skipped: BatchExportIssue[],
  errors: BatchExportIssue[]
): string {
  const lines = [
    'Photochrome batch export report',
    '',
    `Exported: ${exported}`,
    `Skipped: ${skipped.length}`,
    `Errors: ${errors.length}`,
  ]
  if (skipped.length > 0) {
    lines.push('', 'Skipped files:')
    for (const issue of skipped) lines.push(`- ${issue.fileName}: ${issue.reason}`)
  }
  if (errors.length > 0) {
    lines.push('', 'Errors:')
    for (const issue of errors) lines.push(`- ${issue.fileName}: ${issue.reason}`)
  }
  return `${lines.join('\n')}\n`
}

function isAbortError(error: unknown, signal?: AbortSignal): boolean {
  return signal?.aborted === true || (error instanceof Error && error.name === 'AbortError')
}

export async function exportPhotoBatch(
  images: readonly ImageItem[],
  options: BatchExportOptions = {}
): Promise<BatchExportResult> {
  const { Zip, ZipPassThrough, strToU8 } = await import('fflate')
  const chunks: Uint8Array[] = []
  let completeZip: ((blob: Blob) => void) | null = null
  let failZip: ((error: Error) => void) | null = null
  const zipResult = new Promise<Blob>((resolve, reject) => {
    completeZip = resolve
    failZip = reject
  })
  const zip = new Zip((error, data, final) => {
    if (error) {
      failZip?.(error)
      return
    }
    chunks.push(data)
    if (final) completeZip?.(new Blob(chunks, { type: 'application/zip' }))
  })

  const skipped: BatchExportIssue[] = []
  const errors: BatchExportIssue[] = []
  const usedNames = new Set<string>()
  let exported = 0

  const progress = (current: number, fileName: string | null) => options.onProgress?.({
    current,
    total: images.length,
    fileName,
    exported,
    skipped: skipped.length,
    errors: errors.length,
  })

  try {
    progress(0, null)
    for (let index = 0; index < images.length; index++) {
      if (options.signal?.aborted) throw new DOMException('Batch export cancelled', 'AbortError')
      const image = images[index]
      if (!image.recipe) {
        skipped.push({ fileName: image.fileName, reason: 'No recipe selected' })
        progress(index + 1, image.fileName)
        continue
      }

      try {
        await loadSimulationLUT(image.recipe.filmSimulation)
        const plan = createProcessingPlan(
          image.recipe,
          image.transformedOriginal,
          image.customSettings
        )
        const processed = await ImageProcessor.processAsync(
          image.transformedOriginal,
          plan,
          { signal: options.signal }
        )
        if (options.signal?.aborted) throw new DOMException('Batch export cancelled', 'AbortError')
        const watermarked = ImageProcessor.addWatermark(processed, APP_URL)
        const blob = await ImageProcessor.imageDataToBlob(watermarked, 0.95, {
          recipeName: image.recipe.name,
          recipeId: image.recipe.id,
          settings: plan.settings,
        })
        const name = createUniqueFileName(
          createBatchPhotoName(image.fileName, image.recipe.id),
          usedNames
        )
        const entry = new ZipPassThrough(name)
        zip.add(entry)
        entry.push(new Uint8Array(await blob.arrayBuffer()), true)
        exported++
      } catch (error) {
        if (isAbortError(error, options.signal)) throw error
        errors.push({
          fileName: image.fileName,
          reason: error instanceof Error ? error.message : 'Unknown export error',
        })
      }
      progress(index + 1, image.fileName)
    }

    const report = skipped.length > 0 || errors.length > 0
      ? createBatchExportReport(exported, skipped, errors)
      : null
    if (report) {
      const reportEntry = new ZipPassThrough('export-report.txt')
      zip.add(reportEntry)
      reportEntry.push(strToU8(report), true)
    }
    if (options.signal?.aborted) throw new DOMException('Batch export cancelled', 'AbortError')
    zip.end()
    const blob = await zipResult
    progress(images.length, null)
    return {
      status: 'success',
      archiveName: createBatchArchiveName(options.now ?? new Date()),
      blob,
      exported,
      skipped: skipped.length,
      errors: errors.length,
      report,
    }
  } catch (error) {
    zip.terminate()
    chunks.length = 0
    if (isAbortError(error, options.signal)) {
      return { status: 'cancelled', exported, skipped: skipped.length, errors: errors.length }
    }
    return {
      status: 'error',
      message: error instanceof Error ? error.message : 'Failed to build ZIP archive',
      exported,
      skipped: skipped.length,
      errors: errors.length,
    }
  }
}
