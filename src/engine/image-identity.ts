const imageKeys = new WeakMap<ImageData, string>()
let nextImageKey = 0

/**
 * Preview sources are immutable: decoding and geometry changes produce new
 * ImageData objects. Identity avoids pixel-sampling collisions and does not
 * keep discarded images alive. Callers must replace a source after editing it.
 */
export function getImageKey(imageData: ImageData): string {
  let key = imageKeys.get(imageData)
  if (key === undefined) {
    key = String(++nextImageKey)
    imageKeys.set(imageData, key)
  }
  return key
}
