import { afterEach, describe, expect, it, vi } from 'vitest'
import { strFromU8, unzipSync } from 'fflate'
import {
  createBatchArchiveName,
  createBatchExportReport,
  createBatchPhotoName,
  createUniqueFileName,
  exportPhotoBatch,
} from './batch-export'
import { ImageProcessor } from './processor'
import { getRecipe } from '../presets/recipes'
import { createDefaultTransformState } from './transform'
import type { ImageItem } from './types'

const recipe = getRecipe('classic-neg-cinema')!
const imageData = { width: 1, height: 1, data: new Uint8ClampedArray([1, 2, 3, 255]) } as ImageData
const item = (fileName: string, withRecipe = true): ImageItem => ({
  id: fileName,
  file: new File(['image'], fileName, { type: 'image/jpeg' }),
  fileName,
  original: imageData,
  thumbnail: imageData,
  recipe: withRecipe ? recipe : null,
  customSettings: {},
  transformedOriginal: imageData,
  transformedThumbnail: imageData,
  rotation: 0,
  transform: createDefaultTransformState(),
})

afterEach(() => vi.restoreAllMocks())

describe('batch export naming', () => {
  it('creates the required timestamped archive name', () => {
    expect(createBatchArchiveName(new Date(2026, 5, 30, 9, 7))).toBe(
      'photochrome_batch_2026-06-30_09-07.zip'
    )
  })

  it('sanitizes photo names and suffixes duplicates case-insensitively', () => {
    const used = new Set<string>()
    const desired = createBatchPhotoName('trip/photo?.png', 'classic:neg')
    expect(desired).toBe('photochrome_classic_neg_trip_photo_.jpg')
    expect(createUniqueFileName(desired, used)).toBe(desired)
    expect(createUniqueFileName(desired.toUpperCase(), used)).toBe('PHOTOCHROME_CLASSIC_NEG_TRIP_PHOTO__2.JPG')
    expect(createUniqueFileName(desired, used)).toBe('photochrome_classic_neg_trip_photo__3.jpg')
  })
})

describe('batch export report', () => {
  it('lists counts, skips, and errors', () => {
    const report = createBatchExportReport(
      2,
      [{ fileName: 'plain.jpg', reason: 'No recipe selected' }],
      [{ fileName: 'broken.jpg', reason: 'Worker crashed' }]
    )
    expect(report).toContain('Exported: 2')
    expect(report).toContain('Skipped: 1')
    expect(report).toContain('- plain.jpg: No recipe selected')
    expect(report).toContain('- broken.jpg: Worker crashed')
  })
})

describe('exportPhotoBatch', () => {
  it('continues after a file error and adds a report for errors and skips', async () => {
    vi.spyOn(ImageProcessor, 'processAsync')
      .mockRejectedValueOnce(new Error('Worker crashed'))
      .mockResolvedValue(imageData)
    vi.spyOn(ImageProcessor, 'addWatermark').mockReturnValue(imageData)
    vi.spyOn(ImageProcessor, 'imageDataToBlob').mockResolvedValue(new Blob([new Uint8Array([1, 2, 3])]))

    const result = await exportPhotoBatch([
      item('broken.jpg'),
      item('good.jpg'),
      item('plain.jpg', false),
    ], { now: new Date(2026, 5, 30, 9, 7) })

    expect(result).toMatchObject({ status: 'success', exported: 1, skipped: 1, errors: 1 })
    if (result.status !== 'success') throw new Error('Expected successful archive')
    const entries = unzipSync(new Uint8Array(await result.blob.arrayBuffer()))
    expect(Object.keys(entries).filter(name => name.endsWith('.jpg'))).toHaveLength(1)
    expect(strFromU8(entries['export-report.txt'])).toContain('broken.jpg: Worker crashed')
    expect(strFromU8(entries['export-report.txt'])).toContain('plain.jpg: No recipe selected')
  })

  it('aborts without returning a partial ZIP or starting another file', async () => {
    const controller = new AbortController()
    const process = vi.spyOn(ImageProcessor, 'processAsync').mockResolvedValue(imageData)
    vi.spyOn(ImageProcessor, 'addWatermark').mockReturnValue(imageData)
    vi.spyOn(ImageProcessor, 'imageDataToBlob').mockResolvedValue(new Blob([new Uint8Array([1])]))

    const result = await exportPhotoBatch([item('one.jpg'), item('two.jpg')], {
      signal: controller.signal,
      onProgress: progress => {
        if (progress.current === 1) controller.abort()
      },
    })

    expect(result).toEqual({ status: 'cancelled', exported: 1, skipped: 0, errors: 0 })
    expect(process).toHaveBeenCalledOnce()
    expect('blob' in result).toBe(false)
  })
})
