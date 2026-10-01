import type { ProcessingPlan } from '../types'
import { WebGLContextLostError, WebGLProcessor } from '../webgl/processor'
import { VIDEO_EXPORT_BITRATE } from '../../constants'
import { encodeAudio, inspectSourceAudio, supportsAudioEncoding, type SourceAudio } from './audio'
import { drawSourceSample, readPlaybackColorSpace } from './color'
import { getExportCapabilities, isSafari } from './capabilities'
import { AudioPreservationError, closeCodecSafely, ExportCancelledError } from './errors'
import { getVideoOutputSize, renderVideoTransform } from './geometry'
import { createVideoMuxer, type VideoMuxer } from './muxing'
import { inspectSourceVideo, type SourceVideo } from './source'

export async function exportVideo(
  video: HTMLVideoElement,
  plan: ProcessingPlan,
  onProgress: (progress: number, status: string) => void,
  isCancelled?: () => boolean,
  options: { allowSilentAudio?: boolean } = {},
): Promise<Blob> {
  if (typeof VideoEncoder === 'undefined') {
    throw new Error('Video export is not supported in this browser. Please use a browser with H.264 MP4 encoding support.')
  }
  let sourceVideo: SourceVideo | null = null
  let sourceAudio: SourceAudio | null = null
  let processor: WebGLProcessor | null = null
  let muxer: VideoMuxer | null = null
  let encoder: VideoEncoder | null = null
  let sourceCanvas: HTMLCanvasElement | null = null
  let composedCanvas: HTMLCanvasElement | null = null
  let failure: Error | null = null
  let writes = Promise.resolve()
  const timings = new Map<number, number>()
  const check = () => {
    if (isCancelled?.()) throw new ExportCancelledError()
    if (failure) throw failure
  }
  try {
    check()
    onProgress(0, 'Checking source video...')
    sourceVideo = await inspectSourceVideo(video.currentSrc || video.src, isCancelled)
    check()
    const { width, height } = getVideoOutputSize(sourceVideo.width, sourceVideo.height, plan.geometry)
    const playbackColor = readPlaybackColorSpace(video)
    const frameRate = sourceVideo.frameRate
    const composedPlan: ProcessingPlan = { ...plan, targetSize: { width, height } }
    const capabilities = await getExportCapabilities({ width, height, framerate: frameRate, bitrate: VIDEO_EXPORT_BITRATE })
    if (!capabilities.recommendedCodec) {
      throw new Error('H.264 MP4 encoding is not supported for this output size and frame rate. Try another browser or a smaller crop.')
    }
    check()
    onProgress(1, 'Checking source sound...')
    let hasAudio = false
    if (!options.allowSilentAudio) try {
      sourceAudio = await inspectSourceAudio(video.currentSrc || video.src)
      check()
      if (sourceAudio.track && sourceAudio.config) {
        hasAudio = await supportsAudioEncoding(sourceAudio.config) && await sourceAudio.track.canDecode()
        if (!hasAudio) throw new AudioPreservationError()
      }
    } catch (error) {
      if (error instanceof ExportCancelledError) throw error
      if (isCancelled?.()) throw new ExportCancelledError()
      throw new AudioPreservationError()
    }
    check()
    onProgress(5, 'Initializing encoder...')
    if (plan.colorMode !== 'original') {
      processor = new WebGLProcessor()
      processor.init(width, height)
    }
    muxer = await createVideoMuxer(width, height, hasAudio && sourceAudio?.config ? {
      numberOfChannels: sourceAudio.config.numberOfChannels,
      sampleRate: sourceAudio.config.sampleRate,
    } : undefined)
    check()
    encoder = new VideoEncoder({
      output: (chunk, metadata) => {
        const duration = timings.get(chunk.timestamp)
        timings.delete(chunk.timestamp)
        writes = writes.then(() => { check(); return muxer!.addVideoChunk(chunk, metadata, duration) }).catch(error => {
          failure = error instanceof Error ? error : new Error(String(error))
        })
      },
      error: error => { failure = error },
    })
    const config: VideoEncoderConfig = {
      codec: capabilities.recommendedCodec, width, height,
      bitrate: VIDEO_EXPORT_BITRATE, framerate: frameRate,
    }
    if (isSafari()) config.hardwareAcceleration = 'prefer-software'
    encoder.configure(config)
    sourceCanvas = document.createElement('canvas')
    sourceCanvas.width = sourceVideo.width
    sourceCanvas.height = sourceVideo.height
    const context = sourceCanvas.getContext('2d')
    if (!context) throw new Error('Unable to create the video frame canvas. Please retry.')
    composedCanvas = document.createElement('canvas')
    if (hasAudio && sourceAudio) {
      onProgress(8, 'Encoding audio...')
      try {
        await encodeAudio(sourceAudio, (chunk, metadata) => muxer!.addAudioChunk(chunk, metadata), isCancelled)
      } catch (error) {
        if (error instanceof ExportCancelledError) throw error
        if (isCancelled?.()) throw new ExportCancelledError()
        throw new AudioPreservationError()
      }
    }
    let frameIndex = 0
    let previousKeyTime = -Infinity
    for await (const sample of sourceVideo.samples()) {
      let frame: VideoFrame | null = null
      try {
        check()
        await drawSourceSample(sample, context, sourceVideo.width, sourceVideo.height, playbackColor)
        check()
        renderVideoTransform(sourceCanvas, sourceVideo.width, sourceVideo.height, plan.geometry, composedCanvas)
        const processed = processor ? processor.processFrame(composedCanvas, composedPlan, sample.timestamp) : composedCanvas
        const timestamp = sample.microsecondTimestamp
        const duration = sample.microsecondDuration
        frame = new VideoFrame(processed, { timestamp, duration })
        const queueStart = Date.now()
        while (encoder.encodeQueueSize > (isSafari() ? 0 : 3)) {
          await new Promise(resolve => setTimeout(resolve, 10))
          check()
          if (Date.now() - queueStart > 30_000) throw new Error('Video encoding timed out. Please try another browser.')
        }
        check()
        timings.set(timestamp, duration)
        const keyFrame = sample.timestamp - previousKeyTime >= 1
        encoder.encode(frame, { keyFrame })
        if (keyFrame) previousKeyTime = sample.timestamp
        frameIndex++
        onProgress(15 + frameIndex / sourceVideo.packetCount * 75, `Processing frame ${frameIndex}/${sourceVideo.packetCount}...`)
      } finally {
        frame?.close()
        sample.close()
      }
      if (frameIndex % 3 === 0) await new Promise(resolve => setTimeout(resolve, 0))
    }
    check()
    onProgress(95, 'Finalizing video...')
    await encoder.flush()
    await writes
    check()
    closeCodecSafely(encoder)
    const blob = await muxer.finalize()
    check()
    onProgress(100, 'Done!')
    return blob
  } catch (error) {
    if (encoder) closeCodecSafely(encoder)
    await muxer?.cancel().catch(() => {})
    if (error instanceof WebGLContextLostError) throw new Error('Video processing was interrupted due to graphics hardware reset. Please try again.')
    throw error
  } finally {
    if (encoder) closeCodecSafely(encoder)
    processor?.dispose()
    sourceAudio?.dispose()
    sourceVideo?.dispose()
    if (sourceCanvas) { sourceCanvas.width = 0; sourceCanvas.height = 0 }
    if (composedCanvas) { composedCanvas.width = 0; composedCanvas.height = 0 }
  }
}
