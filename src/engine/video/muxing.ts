export interface VideoMuxerAudioConfig {
  numberOfChannels: number
  sampleRate: number
}

export interface VideoMuxer {
  addVideoChunk(chunk: EncodedVideoChunk, metadata?: EncodedVideoChunkMetadata): void
  addAudioChunk(chunk: EncodedAudioChunk, metadata?: EncodedAudioChunkMetadata): void
  finalize(): Blob
}

/** mp4-muxer adapter. Kept isolated so muxing can change without touching orchestration. */
export async function createVideoMuxer(
  width: number,
  height: number,
  audio?: VideoMuxerAudioConfig
): Promise<VideoMuxer> {
  const { Muxer, ArrayBufferTarget } = await import('mp4-muxer')
  const target = new ArrayBufferTarget()
  const muxer = new Muxer({
    target,
    video: { codec: 'avc', width, height },
    ...(audio ? { audio: { codec: 'aac' as const, ...audio } } : {}),
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset',
  })

  return {
    addVideoChunk: (chunk, metadata) => muxer.addVideoChunk(chunk, metadata),
    addAudioChunk: (chunk, metadata) => muxer.addAudioChunk(chunk, metadata),
    finalize: () => {
      muxer.finalize()
      return new Blob([target.buffer], { type: 'video/mp4' })
    },
  }
}
