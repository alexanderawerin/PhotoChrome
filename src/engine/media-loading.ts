import { ImageProcessor } from './processor'
import { ImageItem } from './types'
import { THUMBNAIL_MAX_SIZE } from '../constants'
import {
  validateMediaSelection,
  type MediaSelectionItem,
} from './media-selection'
import { createDefaultTransformState } from './transform'
import { createVideoThumbnail, extractFirstFrame, loadVideo, releaseVideo, type VideoMetadata } from './video/frames'

const MAX_CONCURRENT_DECODES = 2

/**
 * Генерирует уникальный ID для изображения
 */
function generateImageId(): string {
  return `img_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
}

export async function decodeImages(
  files: readonly File[],
  existingItems: readonly MediaSelectionItem[] = [],
  signal?: AbortSignal,
): Promise<ImageItem[]> {
  signal?.throwIfAborted()
  const decodedItems: MediaSelectionItem[] = [
    ...existingItems,
    ...files.map(file => ({ file })),
  ]
  const initialValidation = validateMediaSelection(decodedItems)
  if (!initialValidation.valid) throw new Error(initialValidation.error.message)

  const loadedImages = new Array<ImageItem>(files.length)
  let nextIndex = 0
  let failure: unknown
  const existingCount = existingItems.length

  const decodeNext = async () => {
    while (failure === undefined) {
      const index = nextIndex++
      if (index >= files.length) return
      const file = files[index]

      try {
        signal?.throwIfAborted()
        const { original, thumbnail } = await ImageProcessor.decodeImagePair(file, THUMBNAIL_MAX_SIZE, (width, height) => {
          signal?.throwIfAborted()
          decodedItems[existingCount + index] = { file, width, height }
          const validation = validateMediaSelection(decodedItems)
          if (!validation.valid) throw new Error(validation.error.message)
        })

        signal?.throwIfAborted()
        loadedImages[index] = {
          id: generateImageId(),
          file,
          fileName: file.name,
          original,
          thumbnail,
          recipe: null,
          customSettings: {},
          transformedOriginal: original,
          transformedThumbnail: thumbnail,
          transform: createDefaultTransformState(),
        }
      } catch (error) {
        failure = error
      }
    }
  }

  await Promise.all(Array.from(
    { length: Math.min(MAX_CONCURRENT_DECODES, files.length) },
    decodeNext,
  ))
  signal?.throwIfAborted()
  if (failure !== undefined) throw failure
  return loadedImages
}

export interface VideoData {
  video: HTMLVideoElement
  metadata: VideoMetadata
  firstFrame: ImageData
  thumbnail: ImageData
}

/** Transfers ownership of the video URL only after all decoding succeeds. */
export async function decodeVideo(file: File, signal?: AbortSignal): Promise<VideoData> {
  signal?.throwIfAborted()
  const { video, metadata } = await loadVideo(file, signal)
  try {
    const firstFrame = await extractFirstFrame(video)
    signal?.throwIfAborted()
    const thumbnail = await createVideoThumbnail(video, THUMBNAIL_MAX_SIZE)
    signal?.throwIfAborted()
    return { video, metadata, firstFrame, thumbnail }
  } catch (error) {
    releaseVideo(video)
    throw error
  }
}

export async function loadDemoImages(urls: readonly string[], signal: AbortSignal): Promise<ImageItem[]> {
  const files = await Promise.all(urls.map(async (url, index) => {
    const response = await fetch(url, { signal })
    if (!response.ok) throw new Error('Failed to load demo photo')
    return new File([await response.blob()], `Demo ${index + 1}.webp`, { type: 'image/webp' })
  }))
  return decodeImages(files, [], signal)
}
