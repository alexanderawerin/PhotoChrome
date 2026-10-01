import { ALL_FORMATS, AudioSampleSink, BlobSource, Input, type InputAudioTrack } from 'mediabunny'
import { VIDEO_AUDIO_BITRATE } from '../../constants'
import { closeCodecSafely, ExportCancelledError } from './errors'

export interface SourceAudio {
  track: InputAudioTrack | null
  config: AudioEncoderConfig | null
  dispose(): void
}

/** Track presence is metadata, never inferred from whether decoding/encoding succeeds. */
export async function inspectSourceAudio(videoSrc: string): Promise<SourceAudio> {
  const response = await fetch(videoSrc)
  if (!response.ok) throw new Error('Unable to read source audio')
  const input = new Input({ source: new BlobSource(await response.blob()), formats: ALL_FORMATS })
  try {
    const track = await input.getPrimaryAudioTrack()
    const config = track ? {
      codec: 'mp4a.40.2',
      sampleRate: await track.getSampleRate(),
      numberOfChannels: await track.getNumberOfChannels(),
      bitrate: VIDEO_AUDIO_BITRATE,
    } : null
    return { track, config, dispose: () => input.dispose() }
  } catch (error) {
    input.dispose()
    throw error
  }
}

export async function supportsAudioEncoding(config: AudioEncoderConfig): Promise<boolean> {
  if (typeof AudioEncoder === 'undefined' || typeof AudioData === 'undefined') return false
  try {
    return (await AudioEncoder.isConfigSupported(config)).supported === true
  } catch {
    return false
  }
}

/** Decode timed source samples instead of flattening away track offsets/priming. */
export async function encodeAudio(
  source: SourceAudio,
  onChunk: (chunk: EncodedAudioChunk, metadata?: EncodedAudioChunkMetadata) => void | Promise<void>,
  isCancelled?: () => boolean
): Promise<void> {
  if (!source.track || !source.config) return
  let encoder: AudioEncoder | null = null
  let writes = Promise.resolve()
  let failure: Error | null = null
  const check = () => {
    if (isCancelled?.()) throw new ExportCancelledError()
    if (failure) throw failure
  }
  try {
    encoder = new AudioEncoder({
      output: (chunk, metadata) => {
        writes = writes.then(() => { check(); return onChunk(chunk, metadata) }).catch(error => {
          failure = error instanceof Error ? error : new Error(String(error))
        })
      },
      error: error => { failure = error },
    })
    encoder.configure(source.config)
    for await (const sample of new AudioSampleSink(source.track).samples()) {
      let data: AudioData | null = null
      try {
        check()
        data = sample.toAudioData()
        encoder.encode(data)
      } finally {
        data?.close()
        sample.close()
      }
      while (encoder.encodeQueueSize > 4) {
        await new Promise(resolve => setTimeout(resolve, 0))
        check()
      }
    }
    check()
    await encoder.flush()
    await writes
    check()
  } finally {
    if (encoder) closeCodecSafely(encoder)
  }
}
