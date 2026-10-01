import { createDefaultTransformState, getImageTransformSize, renderImageTransform, type ImageTransformState } from '../transform'

/** AVC requires even dimensions. Pad at most one pixel; never stretch or recrop. */
export function getVideoOutputSize(width: number, height: number, transform: ImageTransformState = createDefaultTransformState()) {
  const size = getImageTransformSize(width, height, transform)
  return { width: Math.ceil(size.width / 2) * 2, height: Math.ceil(size.height / 2) * 2 }
}

/** Photo and video share rotation → reflection → fine angle/zoom → crop semantics. */
export function renderVideoTransform(
  source: CanvasImageSource,
  width: number,
  height: number,
  transform: ImageTransformState = createDefaultTransformState(),
  target: HTMLCanvasElement = document.createElement('canvas'),
): HTMLCanvasElement {
  const size = getVideoOutputSize(width, height, transform)
  if (target.width !== size.width) target.width = size.width
  if (target.height !== size.height) target.height = size.height
  const targetContext = target.getContext('2d')
  if (!targetContext) throw new Error('Unable to compose video geometry. Please try again.')
  targetContext.fillStyle = '#000'
  targetContext.fillRect(0, 0, size.width, size.height)
  if (transform.quarterTurns === 0 && !transform.flipHorizontal && transform.fineAngle === 0
    && transform.cropScale === 1 && transform.cropRatio === 'original') {
    targetContext.drawImage(source, 0, 0, width, height)
    return target
  }
  const sourceCanvas = document.createElement('canvas')
  sourceCanvas.width = width
  sourceCanvas.height = height
  try {
    const sourceContext = sourceCanvas.getContext('2d', { willReadFrequently: true })
    if (!sourceContext) throw new Error('Unable to compose video geometry. Please try again.')
    sourceContext.drawImage(source, 0, 0, width, height)
    const transformed = renderImageTransform(sourceContext.getImageData(0, 0, width, height), transform)
    targetContext.putImageData(transformed, 0, 0)
    return target
  } finally {
    sourceCanvas.width = 0
    sourceCanvas.height = 0
  }
}
