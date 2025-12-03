/**
 * Video processing utilities
 * Handles video loading, frame extraction, and export
 */

import { ProcessingOptions } from './types'
import { getWebGLProcessor, WebGLContextLostError } from './webgl/processor'
import {
  VIDEO_MAX_DURATION,
  VIDEO_EXPORT_FPS,
  VIDEO_EXPORT_BITRATE,
  VIDEO_AUDIO_BITRATE,
  VIDEO_AUDIO_SAMPLE_RATE,
} from '../constants'

export interface VideoMetadata {
  duration: number
  width: number
  height: number
  aspectRatio: number
}

/**
 * Load video file and get metadata
 */
export async function loadVideo(file: File): Promise<{
  video: HTMLVideoElement
  metadata: VideoMetadata
}> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.preload = 'metadata'

    const url = URL.createObjectURL(file)

    video.onloadedmetadata = () => {
      const metadata: VideoMetadata = {
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
        aspectRatio: video.videoWidth / video.videoHeight,
      }

      // Check duration limit
      if (metadata.duration > VIDEO_MAX_DURATION) {
        URL.revokeObjectURL(url)
        reject(new Error(`Video is too long. Maximum duration is ${VIDEO_MAX_DURATION} seconds.`))
        return
      }

      resolve({ video, metadata })
    }

    video.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load video. The file may be corrupted or in an unsupported format.'))
    }

    video.src = url
  })
}

/**
 * Extract first frame from video as ImageData
 */
export async function extractFirstFrame(video: HTMLVideoElement): Promise<ImageData> {
  // Ensure video is ready for playback
  if (video.readyState < 2) {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Video loading timed out. The file may be too large or the connection is slow.'))
      }, SEEK_TIMEOUT_MS)

      const onCanPlay = () => {
        clearTimeout(timeout)
        video.removeEventListener('canplay', onCanPlay)
        resolve()
      }
      video.addEventListener('canplay', onCanPlay)
    })
  }

  // Always seek to ensure frame is ready (even if currentTime is 0)
  await seekVideoWithTimeout(video, 0)

  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Failed to get canvas context')
  }

  ctx.drawImage(video, 0, 0)
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

/**
 * Create thumbnail from first frame
 * Note: Call after extractFirstFrame() to avoid race conditions
 */
export async function createVideoThumbnail(
  video: HTMLVideoElement,
  maxSize: number
): Promise<ImageData> {
  // Video should already be ready from extractFirstFrame call
  // But ensure it's ready just in case called independently
  if (video.readyState < 2) {
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Video loading timed out. The file may be too large or the connection is slow.'))
      }, SEEK_TIMEOUT_MS)

      const onCanPlay = () => {
        clearTimeout(timeout)
        video.removeEventListener('canplay', onCanPlay)
        resolve()
      }
      video.addEventListener('canplay', onCanPlay)
    })
    
    // Seek to first frame
    await seekVideoWithTimeout(video, 0)
  }

  // Calculate dimensions
  let width = video.videoWidth
  let height = video.videoHeight

  if (width > height && width > maxSize) {
    height = (height * maxSize) / width
    width = maxSize
  } else if (height > maxSize) {
    width = (width * maxSize) / height
    height = maxSize
  }

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width)
  canvas.height = Math.round(height)

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Failed to get canvas context')

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

/**
 * Export error for cancellation
 */
export class ExportCancelledError extends Error {
  constructor() {
    super('Export cancelled')
    this.name = 'ExportCancelledError'
  }
}

/** Default timeout for video seek operations (ms) */
const SEEK_TIMEOUT_MS = 10_000

/**
 * Seek video to specific time with timeout protection
 * Prevents hanging if video is corrupted or seek fails
 */
async function seekVideoWithTimeout(
  video: HTMLVideoElement,
  time: number,
  timeoutMs: number = SEEK_TIMEOUT_MS
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      video.removeEventListener('seeked', onSeeked)
      reject(new Error(`Video seek timed out at ${time.toFixed(2)}s. The video file may be corrupted.`))
    }, timeoutMs)

    const onSeeked = () => {
      clearTimeout(timeoutId)
      video.removeEventListener('seeked', onSeeked)
      resolve()
    }

    video.addEventListener('seeked', onSeeked)
    video.currentTime = time
  })
}

/**
 * Extract audio data from video file
 * Returns null if video has no audio or audio cannot be decoded
 */
async function extractAudioData(
  videoSrc: string,
  onProgress?: (status: string) => void
): Promise<AudioBuffer | null> {
  try {
    onProgress?.('Extracting audio...')

    // Fetch the video file
    const response = await fetch(videoSrc)
    const arrayBuffer = await response.arrayBuffer()

    // Create AudioContext for decoding
    const audioContext = new AudioContext({
      sampleRate: VIDEO_AUDIO_SAMPLE_RATE,
    })

    try {
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
      return audioBuffer
    } catch {
      // Video has no audio track or unsupported format
      console.log('No audio track found or unsupported audio format')
      return null
    } finally {
      await audioContext.close()
    }
  } catch (err) {
    console.warn('Failed to extract audio:', err)
    return null
  }
}

/**
 * Encode audio buffer to AAC using AudioEncoder
 * Returns encoded chunks for muxing
 */
async function encodeAudio(
  audioBuffer: AudioBuffer,
  onChunk: (chunk: EncodedAudioChunk, meta?: EncodedAudioChunkMetadata) => void,
  isCancelled?: () => boolean
): Promise<void> {
  const numberOfChannels = Math.min(audioBuffer.numberOfChannels, 2) // Stereo max
  const sampleRate = audioBuffer.sampleRate

  const encoder = new AudioEncoder({
    output: (chunk, meta) => {
      onChunk(chunk, meta ?? undefined)
    },
    error: (e) => console.error('Audio encoder error:', e),
  })

  encoder.configure({
    codec: 'mp4a.40.2', // AAC-LC
    sampleRate,
    numberOfChannels,
    bitrate: VIDEO_AUDIO_BITRATE,
  })

  // Process audio in chunks (1024 samples per frame for AAC)
  const samplesPerFrame = 1024
  const totalSamples = audioBuffer.length
  const totalFrames = Math.ceil(totalSamples / samplesPerFrame)

  // Get audio data (interleaved for stereo or mono)
  const channels: Float32Array[] = []
  for (let ch = 0; ch < numberOfChannels; ch++) {
    channels.push(audioBuffer.getChannelData(ch))
  }

  for (let frame = 0; frame < totalFrames; frame++) {
    if (isCancelled?.()) {
      encoder.close()
      throw new ExportCancelledError()
    }

    const startSample = frame * samplesPerFrame
    const endSample = Math.min(startSample + samplesPerFrame, totalSamples)
    const frameSamples = endSample - startSample

    const audioData = new AudioData({
      format: 'f32-planar',
      sampleRate,
      numberOfFrames: frameSamples,
      numberOfChannels,
      timestamp: (startSample / sampleRate) * 1_000_000, // microseconds
      data: createPlanarAudioBuffer(channels, startSample, frameSamples, numberOfChannels),
    })

    encoder.encode(audioData)
    audioData.close()

    // Yield occasionally
    if (frame % 100 === 0) {
      await new Promise((r) => setTimeout(r, 0))
    }
  }

  await encoder.flush()
  encoder.close()
}

/**
 * Create planar audio buffer from channel data
 */
function createPlanarAudioBuffer(
  channels: Float32Array[],
  startSample: number,
  frameSamples: number,
  numberOfChannels: number
): ArrayBuffer {
  const buffer = new ArrayBuffer(frameSamples * numberOfChannels * 4) // Float32
  const view = new Float32Array(buffer)

  for (let ch = 0; ch < numberOfChannels; ch++) {
    const offset = ch * frameSamples
    for (let i = 0; i < frameSamples; i++) {
      view[offset + i] = channels[ch][startSample + i] ?? 0
    }
  }

  return buffer
}

/**
 * Check if AudioEncoder is supported and can encode AAC
 */
export async function supportsAudioEncoding(): Promise<boolean> {
  if (typeof AudioEncoder === 'undefined') {
    return false
  }

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

/**
 * Export video with applied effects (includes audio if available)
 */
export async function exportVideo(
  video: HTMLVideoElement,
  options: ProcessingOptions,
  onProgress: (progress: number, status: string) => void,
  isCancelled?: () => boolean
): Promise<Blob> {
  // Check browser support
  if (typeof VideoEncoder === 'undefined') {
    throw new Error('Video export is not supported in this browser. Please use Chrome or Edge.')
  }

  const width = video.videoWidth
  const height = video.videoHeight
  const duration = video.duration
  const fps = VIDEO_EXPORT_FPS
  const totalFrames = Math.floor(duration * fps)

  onProgress(0, 'Checking codec support...')

  // Check codec support
  const capabilities = await getExportCapabilities()
  if (!capabilities.videoSupported || !capabilities.recommendedCodec) {
    throw new Error('H.264 video encoding is not supported in this browser. Please use Chrome or Edge.')
  }

  const videoCodec = capabilities.recommendedCodec

  onProgress(1, 'Initializing...')

  // Check for audio support
  const canEncodeAudio = capabilities.audioSupported

  // Extract audio data (in parallel with setup)
  let audioBuffer: AudioBuffer | null = null
  if (canEncodeAudio) {
    audioBuffer = await extractAudioData(video.src, (status) => {
      onProgress(2, status)
    })
  }

  const hasAudio = audioBuffer !== null

  onProgress(5, 'Initializing encoder...')

  // Lazy import mp4-muxer
  const { Muxer, ArrayBufferTarget } = await import('mp4-muxer')

  // Initialize WebGL processor
  const processor = getWebGLProcessor()
  processor.init(width, height)

  // Create muxer with video and optional audio
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const muxerOptions: any = {
    target: new ArrayBufferTarget(),
    video: {
      codec: 'avc' as const,
      width,
      height,
    },
    fastStart: 'in-memory' as const,
    firstTimestampBehavior: 'offset' as const,
  }

  if (hasAudio && audioBuffer) {
    muxerOptions.audio = {
      codec: 'aac' as const,
      numberOfChannels: Math.min(audioBuffer.numberOfChannels, 2),
      sampleRate: audioBuffer.sampleRate,
    }
  }

  const muxer = new Muxer(muxerOptions)

  // Create video encoder
  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => {
      muxer.addVideoChunk(chunk, meta ?? undefined)
    },
    error: (e) => console.error('Video encoder error:', e),
  })

  videoEncoder.configure({
    codec: videoCodec,
    width,
    height,
    bitrate: VIDEO_EXPORT_BITRATE,
    framerate: fps,
  })

  // Create offscreen canvas for video frames
  const frameCanvas = document.createElement('canvas')
  frameCanvas.width = width
  frameCanvas.height = height
  const frameCtx = frameCanvas.getContext('2d')!

  try {
    // Encode audio first (if available)
    if (hasAudio && audioBuffer) {
      onProgress(8, 'Encoding audio...')
      await encodeAudio(
        audioBuffer,
        (chunk, meta) => {
          muxer.addAudioChunk(chunk, meta)
        },
        isCancelled
      )
    }

    // Process video frames
    for (let frame = 0; frame < totalFrames; frame++) {
      if (isCancelled?.()) {
        throw new ExportCancelledError()
      }

      const time = frame / fps
      const baseProgress = hasAudio ? 15 : 8
      const progress = baseProgress + (frame / totalFrames) * (90 - baseProgress)
      onProgress(progress, `Processing frame ${frame + 1}/${totalFrames}...`)

      // Seek video to frame time (with timeout protection)
      await seekVideoWithTimeout(video, time)

      // Draw video frame to canvas
      frameCtx.drawImage(video, 0, 0)

      // Process frame with WebGL
      const processedCanvas = processor.processFrame(frameCanvas, options, time)

      // Create video frame
      const videoFrame = new VideoFrame(processedCanvas, {
        timestamp: (frame * 1_000_000) / fps,
      })

      // Encode frame
      const keyFrame = frame % 30 === 0 // Keyframe every 30 frames
      videoEncoder.encode(videoFrame, { keyFrame })
      videoFrame.close()

      // Yield to prevent blocking
      if (frame % 5 === 0) {
        await new Promise((r) => setTimeout(r, 0))
      }
    }

    if (isCancelled?.()) {
      throw new ExportCancelledError()
    }

    onProgress(95, 'Finalizing video...')

    // Finalize
    await videoEncoder.flush()
    videoEncoder.close()
    muxer.finalize()

    const buffer = (muxer.target as InstanceType<typeof ArrayBufferTarget>).buffer
    const blob = new Blob([buffer], { type: 'video/mp4' })

    onProgress(100, 'Done!')
    return blob
  } catch (err) {
    videoEncoder.close()

    // Provide more helpful error messages
    if (err instanceof WebGLContextLostError) {
      throw new Error('Video processing was interrupted due to graphics hardware reset. Please try again.')
    }

    throw err
  } finally {
    processor.dispose()
  }
}

/**
 * Check if a file is a video
 */
export function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/')
}

/**
 * Check if browser supports video export
 */
export function supportsVideoExport(): boolean {
  return typeof VideoEncoder !== 'undefined'
}

/**
 * Check if specific video codec is supported
 */
export async function isVideoCodecSupported(codec: string = 'avc1.42002a'): Promise<boolean> {
  if (typeof VideoEncoder === 'undefined') {
    return false
  }

  try {
    const support = await VideoEncoder.isConfigSupported({
      codec,
      width: 1280,
      height: 720,
      bitrate: VIDEO_EXPORT_BITRATE,
      framerate: VIDEO_EXPORT_FPS,
    })
    return support.supported === true
  } catch {
    return false
  }
}

/**
 * Get export capabilities for the current browser
 */
export async function getExportCapabilities(): Promise<{
  videoSupported: boolean
  audioSupported: boolean
  recommendedCodec: string | null
}> {
  if (typeof VideoEncoder === 'undefined') {
    return {
      videoSupported: false,
      audioSupported: false,
      recommendedCodec: null,
    }
  }

  // Check H.264 variants (from best to most compatible)
  const h264Codecs = [
    'avc1.640028', // High Profile Level 4.0
    'avc1.42002a', // Baseline Profile Level 4.2
    'avc1.4d001f', // Main Profile Level 3.1
    'avc1.42001e', // Baseline Profile Level 3.0
  ]

  let recommendedCodec: string | null = null
  for (const codec of h264Codecs) {
    if (await isVideoCodecSupported(codec)) {
      recommendedCodec = codec
      break
    }
  }

  const audioSupported = await supportsAudioEncoding()

  return {
    videoSupported: recommendedCodec !== null,
    audioSupported,
    recommendedCodec,
  }
}

