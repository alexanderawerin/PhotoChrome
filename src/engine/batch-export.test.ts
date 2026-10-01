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
  it('includes Original and geometry-only photos with explicit Original metadata', async () => {
    const original = item('original.jpg', false)
    const geometry = item('geometry.jpg', false)
    geometry.transformedOriginal = { width: 2, height: 1, data: new Uint8ClampedArray(8) } as ImageData
    const process = vi.spyOn(ImageProcessor, 'processAsync').mockImplementation(async data => data)
    vi.spyOn(ImageProcessor, 'addWatermark').mockImplementation(data => data)
    const encode = vi.spyOn(ImageProcessor, 'imageDataToBlob').mockResolvedValue(new Blob(['jpeg']))
    vi.spyOn(ImageProcessor, 'createThumbnail').mockResolvedValue(imageData)
    const result = await exportPhotoBatch([original, geometry])
    expect(result).toMatchObject({ status: 'success', exported: 2, skipped: 0, errors: 0 })
    if (result.status !== 'success') throw new Error('Expected successful archive')
    expect(Object.keys(unzipSync(new Uint8Array(await result.blob.arrayBuffer())))).toEqual([
      'photochrome_original_original.jpg', 'photochrome_original_geometry.jpg',
    ])
    expect(process.mock.calls[1][0]).toBe(geometry.transformedOriginal)
    expect(process.mock.calls[1][1]).toMatchObject({ colorMode: 'original', targetSize: { width: 2, height: 1 } })
    expect(encode.mock.calls[1][2]).toEqual({ recipeName: 'Original', recipeId: 'original', settings: {} })
  })

  it('snapshots every applied profile and geometry before processing the first photo', async () => {
    const first = item('one.jpg')
    const second = item('two.jpg')
    second.recipe = structuredClone(recipe)
    second.customSettings = { color: 3 }
    const geometry = second.transformedOriginal
    let release!: () => void
    let started!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    const processing = new Promise<void>(resolve => { started = resolve })
    const process = vi.spyOn(ImageProcessor, 'processAsync').mockImplementationOnce(async () => {
      started()
      await gate
      return imageData
    }).mockResolvedValue(imageData)
    vi.spyOn(ImageProcessor, 'addWatermark').mockReturnValue(imageData)
    vi.spyOn(ImageProcessor, 'imageDataToBlob').mockResolvedValue(new Blob(['jpeg']))
    vi.spyOn(ImageProcessor, 'createThumbnail').mockResolvedValue(imageData)
    const pending = exportPhotoBatch([first, second])
    await processing
    second.recipe!.id = 'changed'
    second.recipe = null
    second.customSettings.color = 9
    second.transformedOriginal = { width: 2, height: 2, data: new Uint8ClampedArray(16) } as ImageData
    release()
    const result = await pending
    expect(result.status).toBe('success')
    expect(process.mock.calls[1][1].recipe.id).toBe('classic-neg-cinema')
    expect(process.mock.calls[1][1].settings.color).toBe(3)
    expect(process.mock.calls[1][0]).toBe(geometry)
  })

  it('returns an actionable error with no ZIP or previews when every photo fails', async () => {
    vi.spyOn(ImageProcessor, 'processAsync').mockRejectedValue(new Error('Required film resource failed'))
    const encode = vi.spyOn(ImageProcessor, 'imageDataToBlob')
    const result = await exportPhotoBatch([item('one.jpg'), item('two.jpg', false)])
    expect(result).toMatchObject({ status: 'error', exported: 0, skipped: 0, errors: 2 })
    if (result.status !== 'error') throw new Error('Expected failure')
    expect(result.message).toContain('one.jpg: Required film resource failed')
    expect(result.message).toContain('two.jpg: Required film resource failed')
    expect('blob' in result).toBe(false)
    expect('previews' in result).toBe(false)
    expect(encode).not.toHaveBeenCalled()
  })

  it('cancels during the encoded byte read without writing a ZIP member or preview', async () => {
    const controller = new AbortController()
    vi.spyOn(ImageProcessor, 'processAsync').mockResolvedValue(imageData)
    vi.spyOn(ImageProcessor, 'addWatermark').mockReturnValue(imageData)
    const blob = new Blob(['jpeg'])
    vi.spyOn(blob, 'arrayBuffer').mockImplementation(async () => {
      controller.abort()
      return new ArrayBuffer(4)
    })
    vi.spyOn(ImageProcessor, 'imageDataToBlob').mockResolvedValue(blob)
    const preview = vi.spyOn(ImageProcessor, 'createThumbnail')
    const result = await exportPhotoBatch([item('one.jpg')], { signal: controller.signal })
    expect(result).toEqual({ status: 'cancelled', exported: 0, skipped: 0, errors: 0 })
    expect(preview).not.toHaveBeenCalled()
    expect('blob' in result).toBe(false)
  })

  it('continues after a file error and includes Original with a failure report', async () => {
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

    expect(result).toMatchObject({ status: 'success', exported: 2, skipped: 0, errors: 1 })
    if (result.status !== 'success') throw new Error('Expected successful archive')
    const entries = unzipSync(new Uint8Array(await result.blob.arrayBuffer()))
    expect(Object.keys(entries).filter(name => name.endsWith('.jpg'))).toHaveLength(2)
    expect(entries['photochrome_original_plain.jpg']).toBeDefined()
    expect(strFromU8(entries['export-report.txt'])).toContain('broken.jpg: Worker crashed')
    expect(strFromU8(entries['export-report.txt'])).toContain('Skipped: 0')
  })

  it('returns previews from archived outputs, capped at four and excluding failures', async () => {
    const thumbnail = vi.spyOn(ImageProcessor, 'createThumbnail').mockImplementation(async (file, maxSize) => {
      expect(maxSize).toBe(480)
      if (file.name.includes('success-1')) throw new Error('Preview decode failed')
      return { width: 480, height: 320, data: new Uint8ClampedArray(480 * 320 * 4) } as ImageData
    })
    vi.spyOn(ImageProcessor, 'processAsync')
      .mockRejectedValueOnce(new Error('Worker crashed'))
      .mockResolvedValue(imageData)
    vi.spyOn(ImageProcessor, 'addWatermark').mockReturnValue(imageData)
    vi.spyOn(ImageProcessor, 'imageDataToBlob').mockResolvedValue(new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }))
    const progress: Array<{ current: number; fileName: string | null; exported: number }> = []

    const result = await exportPhotoBatch([
      item('failed.jpg'),
      item('original.jpg', false),
      item('success-1.jpg'),
      item('success-2.jpg'),
      item('success-3.jpg'),
      item('success-4.jpg'),
      item('success-5.jpg'),
    ], {
      now: new Date(2026, 5, 30, 9, 7),
      onProgress: ({ current, fileName, exported }) => progress.push({ current, fileName, exported }),
    })

    expect(result).toMatchObject({ status: 'success', exported: 6, skipped: 0, errors: 1 })
    if (result.status !== 'success') throw new Error('Expected successful archive')
    expect(result.previews.map(preview => preview.fileName)).toEqual([
      'photochrome_original_original.jpg',
      'photochrome_classic-neg-cinema_success-2.jpg',
      'photochrome_classic-neg-cinema_success-3.jpg',
      'photochrome_classic-neg-cinema_success-4.jpg',
    ])
    expect(thumbnail).toHaveBeenCalledTimes(5)

    const firstProcessingUpdate = progress.findIndex(update => update.fileName === 'success-2.jpg' && update.current === 3)
    const firstFinishedUpdate = progress.findIndex(update => update.fileName === 'success-2.jpg' && update.current === 4)
    expect(firstProcessingUpdate).toBeGreaterThanOrEqual(0)
    expect(firstFinishedUpdate).toBeGreaterThan(firstProcessingUpdate)
    expect(progress[firstFinishedUpdate].exported).toBe(3)
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

  it('cancels before writing an archive entry when encoding aborts', async () => {
    const controller = new AbortController()
    const process = vi.spyOn(ImageProcessor, 'processAsync').mockResolvedValue(imageData)
    vi.spyOn(ImageProcessor, 'addWatermark').mockReturnValue(imageData)
    vi.spyOn(ImageProcessor, 'imageDataToBlob').mockImplementation(async () => {
      controller.abort()
      return new Blob([new Uint8Array([1])], { type: 'image/jpeg' })
    })
    const thumbnail = vi.spyOn(ImageProcessor, 'createThumbnail')

    const result = await exportPhotoBatch([item('one.jpg')], { signal: controller.signal })

    expect(result).toEqual({ status: 'cancelled', exported: 0, skipped: 0, errors: 0 })
    expect(process).toHaveBeenCalledOnce()
    expect(thumbnail).not.toHaveBeenCalled()
    expect('blob' in result).toBe(false)
  })

  it('cancels after the final progress callback instead of returning the ZIP', async () => {
    const controller = new AbortController()
    vi.spyOn(ImageProcessor, 'processAsync').mockResolvedValue(imageData)
    vi.spyOn(ImageProcessor, 'addWatermark').mockReturnValue(imageData)
    vi.spyOn(ImageProcessor, 'imageDataToBlob').mockResolvedValue(new Blob([new Uint8Array([1])], { type: 'image/jpeg' }))
    vi.spyOn(ImageProcessor, 'createThumbnail').mockResolvedValue(imageData)

    const result = await exportPhotoBatch([item('one.jpg')], {
      signal: controller.signal,
      onProgress: progress => {
        if (progress.current === progress.total && progress.fileName === null) controller.abort()
      },
    })

    expect(result).toEqual({ status: 'cancelled', exported: 1, skipped: 0, errors: 0 })
    expect('blob' in result).toBe(false)
  })
})
