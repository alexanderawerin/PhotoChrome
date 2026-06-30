import type { ProcessingPlan } from '../types'
import { WebGLContextLostError, WebGLProcessor } from '../webgl/processor'
import {
  VIDEO_EXPORT_BITRATE,
  VIDEO_EXPORT_FPS,
} from '../../constants'
import { encodeAudio, extractAudioData } from './audio'
import { getExportCapabilities, isSafari, testVideoEncoderWorks } from './capabilities'
import { ExportCancelledError } from './errors'
import { seekVideoWithTimeout } from './frames'
import { createVideoMuxer } from './muxing'

export async function exportVideo(
  video: HTMLVideoElement,
  plan: ProcessingPlan,
  onProgress: (progress: number, status: string) => void,
  isCancelled?: () => boolean
): Promise<Blob> {
  if (typeof VideoEncoder === 'undefined') {
    throw new Error('Video export is not supported in this browser. Please use Chrome or Edge.')
  }

  onProgress(0, 'Testing encoder...')
  const encoderTest = await testVideoEncoderWorks()
  if (!encoderTest.works) {
    throw new Error(`Video encoding failed: ${encoderTest.error || 'Unknown error'}. Please try Chrome or Edge.`)
  }

  const width = video.videoWidth
  const height = video.videoHeight
  const duration = video.duration
  const fps = VIDEO_EXPORT_FPS
  const totalFrames = Math.floor(duration * fps)

  onProgress(0, 'Checking codec support...')
  const capabilities = await getExportCapabilities()
  if (!capabilities.videoSupported || !capabilities.recommendedCodec) {
    throw new Error('H.264 video encoding is not supported in this browser. Please use Chrome or Edge.')
  }
  const videoCodec = capabilities.recommendedCodec

  onProgress(1, 'Initializing...')
  let audioBuffer: AudioBuffer | null = null
  if (capabilities.audioSupported) {
    audioBuffer = await extractAudioData(video.src, status => onProgress(2, status))
  }
  const hasAudio = audioBuffer !== null

  onProgress(5, 'Initializing encoder...')
  const processor = new WebGLProcessor()
  processor.init(width, height)
  const muxer = await createVideoMuxer(
    width,
    height,
    audioBuffer
      ? {
          numberOfChannels: Math.min(audioBuffer.numberOfChannels, 2),
          sampleRate: audioBuffer.sampleRate,
        }
      : undefined
  )

  let encoderError: Error | null = null
  let videoPacketWrites = Promise.resolve()
  const safariMode = isSafari()
  const videoEncoder = new VideoEncoder({
    output: (chunk, metadata) => {
      videoPacketWrites = videoPacketWrites
        .then(() => muxer.addVideoChunk(chunk, metadata ?? undefined))
        .catch(error => {
          encoderError = error instanceof Error ? error : new Error(String(error))
        })
    },
    error: error => {
      console.error('Video encoder error:', error)
      encoderError = error instanceof Error ? error : new Error(String(error))
    },
  })

  const encoderConfig: VideoEncoderConfig = {
    codec: videoCodec,
    width,
    height,
    bitrate: safariMode ? 2_500_000 : VIDEO_EXPORT_BITRATE,
    framerate: fps,
  }
  if (safariMode) encoderConfig.hardwareAcceleration = 'prefer-software'
  videoEncoder.configure(encoderConfig)
  if (videoEncoder.state !== 'configured') {
    throw new Error('Failed to configure video encoder. Your browser may not support the required codec.')
  }

  const frameCanvas = document.createElement('canvas')
  frameCanvas.width = width
  frameCanvas.height = height
  const frameContext = frameCanvas.getContext('2d')!

  const waitForEncoderQueue = async (maxQueueSize = 2): Promise<void> => {
    const startTime = Date.now()
    while (videoEncoder.encodeQueueSize > maxQueueSize) {
      await new Promise(resolve => setTimeout(resolve, 20))
      if (encoderError) throw encoderError
      if (videoEncoder.state === 'closed') {
        throw new Error('VideoEncoder was closed unexpectedly. Try using Chrome for better compatibility.')
      }
      if (Date.now() - startTime > 30_000) {
        throw new Error('Video encoding timed out. The video may be too complex for this browser.')
      }
    }
  }

  const encodeFrameSafely = async (videoFrame: VideoFrame, keyFrame: boolean): Promise<void> => {
    await waitForEncoderQueue(safariMode ? 0 : 3)
    if (videoEncoder.state !== 'configured') {
      videoFrame.close()
      throw new Error('VideoEncoder is not in configured state')
    }
    videoEncoder.encode(videoFrame, { keyFrame })
    videoFrame.close()
    if (safariMode) await new Promise(resolve => setTimeout(resolve, 10))
  }

  try {
    if (hasAudio && audioBuffer) {
      onProgress(8, 'Encoding audio...')
      await encodeAudio(
        audioBuffer,
        (chunk, metadata) => muxer.addAudioChunk(chunk, metadata),
        isCancelled
      )
    }

    for (let frame = 0; frame < totalFrames; frame++) {
      if (isCancelled?.()) throw new ExportCancelledError()
      if (encoderError) throw encoderError
      if ((videoEncoder.state as string) === 'closed') {
        throw new Error('VideoEncoder was closed unexpectedly. Try using Chrome for better compatibility.')
      }

      const time = frame / fps
      const baseProgress = hasAudio ? 15 : 8
      onProgress(
        baseProgress + (frame / totalFrames) * (90 - baseProgress),
        `Processing frame ${frame + 1}/${totalFrames}...`
      )
      await seekVideoWithTimeout(video, time)
      frameContext.drawImage(video, 0, 0)
      const processedCanvas = processor.processFrame(frameCanvas, plan, time)
      const videoFrame = new VideoFrame(processedCanvas, {
        timestamp: (frame * 1_000_000) / fps,
      })
      await encodeFrameSafely(videoFrame, frame % (safariMode ? 15 : 30) === 0)
      if (frame % 3 === 0) await new Promise(resolve => setTimeout(resolve, 0))
    }

    if (isCancelled?.()) throw new ExportCancelledError()
    if (encoderError) throw encoderError

    onProgress(95, 'Finalizing video...')
    await videoEncoder.flush()
    await videoPacketWrites
    if (encoderError) throw encoderError
    videoEncoder.close()
    const blob = await muxer.finalize()
    onProgress(100, 'Done!')
    return blob
  } catch (error) {
    videoEncoder.close()
    await muxer.cancel().catch(() => {})
    if (error instanceof WebGLContextLostError) {
      throw new Error('Video processing was interrupted due to graphics hardware reset. Please try again.')
    }
    throw error
  } finally {
    processor.dispose()
  }
}
