/**
 * Video processing utilities
 * Handles video loading, frame extraction, and export
 */

import { ProcessingPlan } from './types'
import { WebGLProcessor, WebGLContextLostError } from './webgl/processor'
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
 * Detect Safari browser
 */
function isSafari(): boolean {
  const ua = navigator.userAgent
  return ua.includes('Safari') && !ua.includes('Chrome') && !ua.includes('Chromium')
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
    // Safari needs 'auto' to properly load video data for frame extraction
    video.preload = isSafari() ? 'auto' : 'metadata'
    // Safari requires explicit crossOrigin for blob URLs in some cases
    video.crossOrigin = 'anonymous'

    const url = URL.createObjectURL(file)
    
    // Timeout for initial load
    const loadTimeout = setTimeout(() => {
      cleanup()
      URL.revokeObjectURL(url)
      reject(new Error('Video loading timed out. The file may be too large or the format is not supported.'))
    }, SEEK_TIMEOUT_MS)

    const cleanup = () => {
      clearTimeout(loadTimeout)
      video.onloadedmetadata = null
      video.oncanplay = null
      video.onerror = null
    }

    const handleReady = () => {
      // Wait for both metadata AND enough data to extract frame
      if (video.readyState < 1 || video.videoWidth === 0) return
      
      cleanup()
      
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

    video.onloadedmetadata = handleReady
    // Safari may need canplay event instead
    video.oncanplay = handleReady

    video.onerror = () => {
      cleanup()
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load video. The file may be corrupted or in an unsupported format.'))
    }

    video.src = url
    // Safari sometimes needs explicit load() call
    video.load()
  })
}

/**
 * Wait for video to be ready for frame extraction
 */
async function waitForVideoReady(video: HTMLVideoElement): Promise<void> {
  // readyState 2+ means HAVE_CURRENT_DATA - enough to render current frame
  if (video.readyState >= 2) return

  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error('Video loading timed out. The file may be too large or the connection is slow.'))
    }, SEEK_TIMEOUT_MS)

    const cleanup = () => {
      clearTimeout(timeout)
      video.removeEventListener('canplay', onReady)
      video.removeEventListener('canplaythrough', onReady)
      video.removeEventListener('loadeddata', onReady)
    }

    const onReady = () => {
      if (video.readyState >= 2) {
        cleanup()
        resolve()
      }
    }

    // Listen to multiple events for Safari compatibility
    video.addEventListener('canplay', onReady)
    video.addEventListener('canplaythrough', onReady)
    video.addEventListener('loadeddata', onReady)
    
    // Safari may need a play() attempt to trigger loading
    if (isSafari() && video.readyState < 2) {
      video.play().then(() => {
        video.pause()
      }).catch(() => {
        // Autoplay blocked, that's fine
      })
    }
  })
}

/**
 * Extract a frame from video with Safari workaround.
 * Safari sometimes needs multiple attempts or a brief play to render frames.
 */
async function extractFrameWithRetry(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  maxAttempts: number = 3
): Promise<ImageData> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    
    // Check if frame is not completely black (Safari issue)
    if (!isImageDataBlack(imageData)) {
      return imageData
    }
    
    // Safari workaround: try play/pause to force frame render
    if (isSafari() && attempt < maxAttempts - 1) {
      try {
        await video.play()
        await new Promise(r => setTimeout(r, 50))
        video.pause()
        video.currentTime = 0
        await new Promise(r => setTimeout(r, 50))
      } catch {
        // Ignore play errors
      }
    } else {
      // Small delay between attempts
      await new Promise(r => setTimeout(r, 100))
    }
  }
  
  // Return whatever we got on last attempt
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  return ctx.getImageData(0, 0, canvas.width, canvas.height)
}

/**
 * Check if ImageData is completely black (all pixels are 0 or near 0)
 */
function isImageDataBlack(imageData: ImageData): boolean {
  const data = imageData.data
  const sampleStep = Math.max(1, Math.floor(data.length / 100)) // Sample ~100 pixels
  let totalBrightness = 0
  let samples = 0
  
  for (let i = 0; i < data.length; i += sampleStep * 4) {
    // Check RGB values (skip alpha)
    totalBrightness += data[i] + data[i + 1] + data[i + 2]
    samples++
  }
  
  // If average brightness is very low, consider it black
  const avgBrightness = totalBrightness / (samples * 3)
  return avgBrightness < 5
}

/**
 * Extract first frame from video as ImageData
 */
export async function extractFirstFrame(video: HTMLVideoElement): Promise<ImageData> {
  // Ensure video is ready for playback
  await waitForVideoReady(video)

  // Always seek to ensure frame is ready (even if currentTime is 0)
  await seekVideoWithTimeout(video, 0)
  
  // Wait a frame for Safari to render
  await new Promise(r => requestAnimationFrame(() => r(undefined)))

  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight

  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('Failed to get canvas context')
  }

  return extractFrameWithRetry(video, canvas, ctx)
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
  await waitForVideoReady(video)

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

  return extractFrameWithRetry(video, canvas, ctx)
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
  plan: ProcessingPlan,
  onProgress: (progress: number, status: string) => void,
  isCancelled?: () => boolean
): Promise<Blob> {
  // Check browser support
  if (typeof VideoEncoder === 'undefined') {
    throw new Error('Video export is not supported in this browser. Please use Chrome or Edge.')
  }
  
  // Test if VideoEncoder actually works (Safari should use FFmpeg fallback instead)
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

  // Create dedicated WebGL processor for export (separate from preview singleton)
  const processor = new WebGLProcessor()
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

  // Track encoder errors
  let encoderError: Error | null = null
  
  // Safari needs more conservative settings
  const safariMode = isSafari()
  
  // Create video encoder
  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => {
      muxer.addVideoChunk(chunk, meta ?? undefined)
    },
    error: (e) => {
      console.error('Video encoder error:', e)
      encoderError = e instanceof Error ? e : new Error(String(e))
    },
  })

  // Configure encoder with Safari-compatible settings
  const encoderConfig: VideoEncoderConfig = {
    codec: videoCodec,
    width,
    height,
    bitrate: safariMode ? 2_500_000 : VIDEO_EXPORT_BITRATE, // Lower bitrate for Safari
    framerate: fps,
  }
  
  // Safari-specific options
  if (safariMode) {
    // Use software encoding on Safari for stability
    encoderConfig.hardwareAcceleration = 'prefer-software'
  }
  
  videoEncoder.configure(encoderConfig)
  
  // Verify encoder is actually configured
  if (videoEncoder.state !== 'configured') {
    throw new Error('Failed to configure video encoder. Your browser may not support the required codec.')
  }

  // Create offscreen canvas for video frames
  const frameCanvas = document.createElement('canvas')
  frameCanvas.width = width
  frameCanvas.height = height
  const frameCtx = frameCanvas.getContext('2d')!

  /**
   * Wait for encoder queue to drain (Safari fix)
   * Safari's VideoEncoder can crash if queue gets too large
   */
  async function waitForEncoderQueue(maxQueueSize: number = 2): Promise<void> {
    const maxWaitTime = 30000 // 30 second timeout
    const startTime = Date.now()
    
    while (videoEncoder.encodeQueueSize > maxQueueSize) {
      await new Promise(r => setTimeout(r, 20))
      
      // Check for errors while waiting
      if (encoderError) throw encoderError
      if (videoEncoder.state === 'closed') {
        throw new Error('VideoEncoder was closed unexpectedly. Try using Chrome for better compatibility.')
      }
      
      // Timeout protection
      if (Date.now() - startTime > maxWaitTime) {
        throw new Error('Video encoding timed out. The video may be too complex for this browser.')
      }
    }
  }
  
  /**
   * Encode a single frame and wait for Safari stability
   */
  async function encodeFrameSafely(
    videoFrame: VideoFrame,
    keyFrame: boolean
  ): Promise<void> {
    // Wait for queue before encoding
    await waitForEncoderQueue(safariMode ? 0 : 3)
    
    // Check encoder state before encoding
    if (videoEncoder.state !== 'configured') {
      videoFrame.close()
      throw new Error('VideoEncoder is not in configured state')
    }
    
    videoEncoder.encode(videoFrame, { keyFrame })
    videoFrame.close()
    
    // Safari needs time between frames
    if (safariMode) {
      await new Promise(r => setTimeout(r, 10))
    }
  }

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
      
      // Check encoder state
      if (encoderError) throw encoderError
      // Note: state can become 'closed' at runtime even though TS thinks it's 'configured'
      if ((videoEncoder.state as string) === 'closed') {
        throw new Error('VideoEncoder was closed unexpectedly. Try using Chrome for better compatibility.')
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
      const processedCanvas = processor.processFrame(frameCanvas, plan, time)

      // Create video frame
      const videoFrame = new VideoFrame(processedCanvas, {
        timestamp: (frame * 1_000_000) / fps,
      })

      // Encode frame safely (handles Safari quirks)
      const keyFrame = frame % (safariMode ? 15 : 30) === 0 // More keyframes for Safari
      await encodeFrameSafely(videoFrame, keyFrame)

      // Yield to prevent UI blocking
      if (frame % 3 === 0) {
        await new Promise((r) => setTimeout(r, 0))
      }
    }

    if (isCancelled?.()) {
      throw new ExportCancelledError()
    }
    
    // Final encoder state check
    if (encoderError) throw encoderError

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
    // Dispose dedicated export processor to free GPU memory
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
    const config: VideoEncoderConfig = {
      codec,
      width: 1280,
      height: 720,
      bitrate: 2_500_000,
      framerate: 30,
    }
    
    // Safari may need software acceleration
    if (isSafari()) {
      config.hardwareAcceleration = 'prefer-software'
    }
    
    const support = await VideoEncoder.isConfigSupported(config)
    return support.supported === true
  } catch {
    return false
  }
}

/**
 * Test if VideoEncoder actually works (not just reports support)
 * Safari may report support but fail at runtime
 */
export async function testVideoEncoderWorks(): Promise<{ works: boolean; error?: string }> {
  if (typeof VideoEncoder === 'undefined') {
    return { works: false, error: 'VideoEncoder API not available' }
  }

  try {
    // Try to create and configure a test encoder
    let testError: string | null = null
    const testEncoder = new VideoEncoder({
      output: () => {},
      error: (e) => { testError = e instanceof Error ? e.message : String(e) },
    })

    const testConfig: VideoEncoderConfig = {
      codec: 'avc1.42001e', // Most compatible baseline profile
      width: 640,
      height: 480,
      bitrate: 1_000_000,
      framerate: 30,
    }
    
    if (isSafari()) {
      testConfig.hardwareAcceleration = 'prefer-software'
    }

    testEncoder.configure(testConfig)
    
    // Wait a bit for any async errors
    await new Promise(r => setTimeout(r, 100))
    
    const state = testEncoder.state
    testEncoder.close()
    
    if (testError) {
      return { works: false, error: testError }
    }
    
    if (state !== 'configured') {
      return { works: false, error: `Encoder state: ${state}` }
    }

    return { works: true }
  } catch (err) {
    return { works: false, error: err instanceof Error ? err.message : String(err) }
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

  // H.264 codec variants to try
  // Safari needs simpler profiles, so we try from most compatible to best
  const h264Codecs = isSafari() 
    ? [
        'avc1.42001e', // Baseline Profile Level 3.0 - most compatible
        'avc1.42001f', // Baseline Profile Level 3.1
        'avc1.420028', // Baseline Profile Level 4.0
        'avc1.4d001e', // Main Profile Level 3.0
      ]
    : [
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
