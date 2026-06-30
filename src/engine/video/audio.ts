import { VIDEO_AUDIO_BITRATE, VIDEO_AUDIO_SAMPLE_RATE } from '../../constants'
import { ExportCancelledError } from './errors'

export async function extractAudioData(
  videoSrc: string,
  onProgress?: (status: string) => void
): Promise<AudioBuffer | null> {
  try {
    onProgress?.('Extracting audio...')
    const response = await fetch(videoSrc)
    const arrayBuffer = await response.arrayBuffer()
    const audioContext = new AudioContext({ sampleRate: VIDEO_AUDIO_SAMPLE_RATE })
    try {
      return await audioContext.decodeAudioData(arrayBuffer)
    } catch {
      console.log('No audio track found or unsupported audio format')
      return null
    } finally {
      await audioContext.close()
    }
  } catch (error) {
    console.warn('Failed to extract audio:', error)
    return null
  }
}

function createPlanarAudioBuffer(
  channels: Float32Array[],
  startSample: number,
  frameSamples: number,
  numberOfChannels: number
): ArrayBuffer {
  const buffer = new ArrayBuffer(frameSamples * numberOfChannels * 4)
  const view = new Float32Array(buffer)
  for (let channel = 0; channel < numberOfChannels; channel++) {
    const offset = channel * frameSamples
    for (let index = 0; index < frameSamples; index++) {
      view[offset + index] = channels[channel][startSample + index] ?? 0
    }
  }
  return buffer
}

export async function encodeAudio(
  audioBuffer: AudioBuffer,
  onChunk: (chunk: EncodedAudioChunk, metadata?: EncodedAudioChunkMetadata) => void,
  isCancelled?: () => boolean
): Promise<void> {
  const numberOfChannels = Math.min(audioBuffer.numberOfChannels, 2)
  const sampleRate = audioBuffer.sampleRate
  const encoder = new AudioEncoder({
    output: (chunk, metadata) => onChunk(chunk, metadata ?? undefined),
    error: error => console.error('Audio encoder error:', error),
  })
  encoder.configure({
    codec: 'mp4a.40.2',
    sampleRate,
    numberOfChannels,
    bitrate: VIDEO_AUDIO_BITRATE,
  })

  const samplesPerFrame = 1024
  const totalSamples = audioBuffer.length
  const channels = Array.from(
    { length: numberOfChannels },
    (_, channel) => audioBuffer.getChannelData(channel)
  )
  for (let frame = 0; frame < Math.ceil(totalSamples / samplesPerFrame); frame++) {
    if (isCancelled?.()) {
      encoder.close()
      throw new ExportCancelledError()
    }
    const startSample = frame * samplesPerFrame
    const frameSamples = Math.min(startSample + samplesPerFrame, totalSamples) - startSample
    const audioData = new AudioData({
      format: 'f32-planar',
      sampleRate,
      numberOfFrames: frameSamples,
      numberOfChannels,
      timestamp: (startSample / sampleRate) * 1_000_000,
      data: createPlanarAudioBuffer(channels, startSample, frameSamples, numberOfChannels),
    })
    encoder.encode(audioData)
    audioData.close()
    if (frame % 100 === 0) await new Promise(resolve => setTimeout(resolve, 0))
  }
  await encoder.flush()
  encoder.close()
}

export async function supportsAudioEncoding(): Promise<boolean> {
  if (typeof AudioEncoder === 'undefined') return false
  try {
    const support = await AudioEncoder.isConfigSupported({
      codec: 'mp4a.40.2',
      sampleRate: VIDEO_AUDIO_SAMPLE_RATE,
      numberOfChannels: 2,
      bitrate: VIDEO_AUDIO_BITRATE,
    })
    return support.supported === true
  } catch {
    return false
  }
}
