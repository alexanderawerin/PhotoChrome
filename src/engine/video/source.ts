import { ALL_FORMATS, BlobSource, EncodedPacketSink, Input, VideoSampleSink, type VideoSample } from 'mediabunny'
import { VIDEO_MAX_DURATION } from '../../constants'
import { ExportCancelledError } from './errors'

export interface SourceVideo {
  width: number
  height: number
  frameRate: number
  packetCount: number
  duration: number
  samples(): AsyncGenerator<VideoSample, void, unknown>
  dispose(): void
}

/** Decode source samples in presentation order, retaining each sample's own timing. */
export async function inspectSourceVideo(src: string, isCancelled?: () => boolean): Promise<SourceVideo> {
  const response = await fetch(src)
  if (!response.ok) throw new Error('Unable to read source video. Please reload the clip and retry.')
  const input = new Input({ source: new BlobSource(await response.blob()), formats: ALL_FORMATS })
  const check = () => { if (isCancelled?.()) throw new ExportCancelledError() }
  try {
    check()
    const track = await input.getPrimaryVideoTrack()
    if (!track || !await track.canDecode()) throw new Error('This source video cannot be decoded for MP4 export. Please try another browser or clip.')
    let packetCount = 0
    let duration = 0
    let frameRate = 0
    for await (const packet of new EncodedPacketSink(track).packets()) {
      check()
      packetCount++
      duration = Math.max(duration, packet.timestamp + packet.duration)
      if (packet.duration > 0) frameRate = Math.max(frameRate, 1 / packet.duration)
    }
    if (!packetCount || !Number.isFinite(duration) || duration <= 0) throw new Error('The source video has no usable frames.')
    if (duration > VIDEO_MAX_DURATION + 1e-6) throw new Error('Video export supports clips up to 30 seconds. Please choose a shorter clip.')
    if (!frameRate) frameRate = (await track.computePacketStats()).averagePacketRate
    const width = await track.getDisplayWidth()
    const height = await track.getDisplayHeight()
    check()
    return { width, height, frameRate, packetCount, duration,
      samples: () => new VideoSampleSink(track).samples(), dispose: () => input.dispose() }
  } catch (error) {
    input.dispose()
    throw error
  }
}
