export interface VideoMuxerAudioConfig {
  numberOfChannels: number
  sampleRate: number
}

export interface VideoMuxer {
  addVideoChunk(chunk: EncodedVideoChunk, metadata?: EncodedVideoChunkMetadata): Promise<void>
  addAudioChunk(chunk: EncodedAudioChunk, metadata?: EncodedAudioChunkMetadata): Promise<void>
  finalize(): Promise<Blob>
  cancel(): Promise<void>
}

/** Mediabunny adapter for WebCodecs packets with explicit async backpressure. */
export async function createVideoMuxer(
  width: number,
  height: number,
  audio?: VideoMuxerAudioConfig
): Promise<VideoMuxer> {
  if (width <= 0 || height <= 0) throw new Error('Video dimensions must be positive')
  if (audio && (audio.numberOfChannels <= 0 || audio.sampleRate <= 0)) {
    throw new Error('Audio track metadata must be positive')
  }
  const {
    BufferTarget,
    EncodedAudioPacketSource,
    EncodedPacket,
    EncodedVideoPacketSource,
    Mp4OutputFormat,
    Output,
  } = await import('mediabunny')

  const target = new BufferTarget()
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
    target,
  })
  const videoSource = new EncodedVideoPacketSource('avc')
  const audioSource = audio ? new EncodedAudioPacketSource('aac') : null
  output.addVideoTrack(videoSource, { frameRate: 30 })
  if (audioSource) output.addAudioTrack(audioSource)
  await output.start()

  return {
    addVideoChunk: async (chunk, metadata) => {
      await videoSource.add(EncodedPacket.fromEncodedChunk(chunk), metadata)
    },
    addAudioChunk: async (chunk, metadata) => {
      if (!audioSource) throw new Error('Audio track is not configured')
      await audioSource.add(EncodedPacket.fromEncodedChunk(chunk), metadata)
    },
    finalize: async () => {
      videoSource.close()
      audioSource?.close()
      await output.finalize()
      if (!target.buffer) throw new Error('Mediabunny did not produce an MP4 buffer')
      return new Blob([target.buffer], { type: 'video/mp4' })
    },
    cancel: () => output.cancel(),
  }
}
