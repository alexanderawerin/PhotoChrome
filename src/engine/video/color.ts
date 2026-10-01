import { VideoSample } from 'mediabunny'

/** HTML playback and WebCodecs can choose different matrices for untagged input. */
export function readPlaybackColorSpace(video: HTMLVideoElement): VideoColorSpaceInit | undefined {
  const frame = new VideoFrame(video, { timestamp: 0 })
  try {
    const color = frame.colorSpace?.toJSON()
    return color?.matrix && color.matrix !== 'rgb' ? color : undefined
  } finally {
    frame.close()
  }
}

/** Match the timed decoder's raw planes to the color interpretation used by preview. */
export async function drawSourceSample(
  sample: VideoSample,
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  playbackColor?: VideoColorSpaceInit,
): Promise<void> {
  const color = sample.colorSpace
  if (!playbackColor || color.matrix === 'rgb' || (
    color.matrix === playbackColor.matrix && color.primaries === playbackColor.primaries
    && color.transfer === playbackColor.transfer && color.fullRange === playbackColor.fullRange
  )) {
    sample.draw(context, 0, 0, width, height)
    return
  }
  let original: VideoFrame | null = null
  let corrected: VideoFrame | null = null
  let correctedSample: VideoSample | null = null
  try {
    original = sample.toVideoFrame()
    if (!original.format || !original.visibleRect) throw new Error('Unable to preserve source video colors. Please try another browser.')
    const data = new Uint8Array(original.allocationSize())
    const layout = await original.copyTo(data)
    corrected = new VideoFrame(data, {
      format: original.format,
      layout,
      codedWidth: original.visibleRect.width,
      codedHeight: original.visibleRect.height,
      displayWidth: original.displayWidth,
      displayHeight: original.displayHeight,
      timestamp: sample.microsecondTimestamp,
      duration: sample.microsecondDuration,
      colorSpace: playbackColor,
    })
    correctedSample = new VideoSample(corrected, { rotation: sample.rotation })
    corrected = null // VideoSample owns the corrected frame.
    correctedSample.draw(context, 0, 0, width, height)
  } finally {
    correctedSample?.close()
    corrected?.close()
    original?.close()
  }
}
