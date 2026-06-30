import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MEDIA_SELECTION_LIMITS,
  validateMediaSelection,
  type MediaSelectionItem,
} from './media-selection'

const image = (
  name: string,
  options: { type?: string; size?: number; width?: number; height?: number } = {}
): MediaSelectionItem => ({
  file: new File([new Uint8Array(options.size ?? 1)], name, { type: options.type ?? 'image/jpeg' }),
  width: options.width,
  height: options.height,
})

describe('validateMediaSelection', () => {
  it('accepts JPEG, PNG, WebP, and GIF selections within all limits', () => {
    const result = validateMediaSelection([
      image('a.jpg', { type: 'image/jpeg', width: 4_000, height: 3_000 }),
      image('b.png', { type: 'image/png', width: 2_000, height: 1_000 }),
      image('c.webp', { type: 'image/webp', width: 100, height: 100 }),
      image('d.gif', { type: 'image/gif', width: 10, height: 10 }),
    ])

    expect(result).toEqual({ valid: true, totalPixels: 14_010_100 })
  })

  it('rejects the whole selection above 20 files', () => {
    const result = validateMediaSelection(Array.from({ length: 21 }, (_, index) => image(`${index}.jpg`)))
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.error.code).toBe('too-many-files')
  })

  it('rejects an unsupported type anywhere in the selection', () => {
    const result = validateMediaSelection([image('ok.jpg'), image('bad.avif', { type: 'image/avif' })])
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.error).toMatchObject({ code: 'unsupported-type', fileName: 'bad.avif' })
  })

  it('enforces the 25 MB per-file limit', () => {
    const limits = DEFAULT_MEDIA_SELECTION_LIMITS
    const result = validateMediaSelection([image('large.jpg', { size: limits.maxBytesPerFile + 1 })])
    expect(result.valid).toBe(false)
    if (!result.valid) expect(result.error.code).toBe('file-too-large')
  })

  it('enforces 64 MP per file and 200 MP across the selection independently', () => {
    const oversized = validateMediaSelection([image('large.jpg', { width: 8_001, height: 8_000 })])
    expect(oversized.valid).toBe(false)
    if (!oversized.valid) expect(oversized.error.code).toBe('too-many-pixels')

    const total = validateMediaSelection(Array.from(
      { length: 4 },
      (_, index) => image(`${index}.jpg`, { width: 8_000, height: 8_000 })
    ))
    expect(total.valid).toBe(false)
    if (!total.valid) expect(total.error.code).toBe('too-many-total-pixels')
  })
})
