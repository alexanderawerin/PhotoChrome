import { ImageProcessor } from './processor'
import { renderImageTransform } from './transform'
import type { ImageItem } from './types'

/** Decode only the current export's immutable file, then render its committed
 * geometry. The decoder owns and closes the temporary bitmap on every path. */
export async function materializePhotoPixels(
  image: Pick<ImageItem, 'file' | 'sourceSize' | 'transform'>,
  signal?: AbortSignal,
): Promise<ImageData> {
  signal?.throwIfAborted()
  const file = image.file
  const sourceSize = { ...image.sourceSize }
  const transform = structuredClone(image.transform)
  if (!Number.isInteger(sourceSize.width) || !Number.isInteger(sourceSize.height) || sourceSize.width <= 0 || sourceSize.height <= 0) {
    throw new Error('Source photo dimensions must be positive integers')
  }
  const validateDimensions = (width: number, height: number) => {
    if (width !== sourceSize.width || height !== sourceSize.height) {
      throw new Error(`Source photo dimensions changed: expected ${sourceSize.width}×${sourceSize.height}, decoded ${width}×${height}`)
    }
  }
  const original = await ImageProcessor.decodeImageOriginal(file, signal, validateDimensions)
  signal?.throwIfAborted()
  validateDimensions(original.width, original.height)
  const transformed = renderImageTransform(original, transform)
  signal?.throwIfAborted()
  return transformed
}
