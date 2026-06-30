/**
 * Safari video export using MediaRecorder API
 * More stable than WebCodecs VideoEncoder in Safari
 */

import { ProcessingPlan } from './types'
import { WebGLProcessor } from './webgl/processor'

/**
 * Check if Safari supports MediaRecorder with MP4
 */
export function canUseMediaRecorder(): boolean {
  if (typeof MediaRecorder === 'undefined') return false
  
  // Check MP4 support
  return MediaRecorder.isTypeSupported('video/mp4') || 
         MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')
}

/**
 * Export video using MediaRecorder (Safari fallback)
 * Uses canvas.captureStream() + MediaRecorder
 */
export async function exportVideoWithMediaRecorder(
  video: HTMLVideoElement,
  plan: ProcessingPlan,
  onProgress: (progress: number, status: string) => void,
  isCancelled?: () => boolean
): Promise<Blob> {
  const width = video.videoWidth
  const height = video.videoHeight
  const duration = video.duration
  const fps = 30

  onProgress(0, 'Initializing...')

  // Create WebGL processor
  const processor = new WebGLProcessor()
  processor.init(width, height)

  // Create output canvas for recording
  const outputCanvas = document.createElement('canvas')
  // Ensure even dimensions (required for H.264)
  outputCanvas.width = Math.floor(width / 2) * 2
  outputCanvas.height = Math.floor(height / 2) * 2
  const outputCtx = outputCanvas.getContext('2d')!

  // Create frame extraction canvas
  const frameCanvas = document.createElement('canvas')
  frameCanvas.width = width
  frameCanvas.height = height
  const frameCtx = frameCanvas.getContext('2d')!

  // Capture stream from output canvas
  const stream = outputCanvas.captureStream(fps)

  // Find supported mime type
  const mimeType = MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')
    ? 'video/mp4;codecs=avc1'
    : MediaRecorder.isTypeSupported('video/mp4')
      ? 'video/mp4'
      : 'video/webm' // Fallback

  // Create MediaRecorder
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: 2_500_000, // 2.5 Mbps
  })

  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) {
      chunks.push(e.data)
    }
  }

  // Start recording
  recorder.start(100) // Collect data every 100ms

  const totalFrames = Math.floor(duration * fps)
  const frameDuration = 1000 / fps

  try {
    // Process frames with optimized timing
    let lastFrameTime = performance.now()
    
    for (let frame = 0; frame < totalFrames; frame++) {
      if (isCancelled?.()) {
        recorder.stop()
        throw new Error('Export cancelled')
      }

      const time = frame / fps
      const progress = (frame / totalFrames) * 95
      onProgress(progress, `Processing frame ${frame + 1}/${totalFrames}...`)

      // Seek video with retry
      let seekSuccess = false
      for (let attempt = 0; attempt < 3 && !seekSuccess; attempt++) {
        try {
          await seekVideo(video, time)
          seekSuccess = true
        } catch {
          if (attempt === 2) throw new Error(`Failed to seek to frame ${frame}`)
          await new Promise(r => setTimeout(r, 100))
        }
      }

      // Draw video frame
      frameCtx.drawImage(video, 0, 0)

      // Process with WebGL
      const processedCanvas = processor.processFrame(frameCanvas, plan, time)

      // Draw to output canvas (scaled to even dimensions)
      outputCtx.drawImage(
        processedCanvas,
        0, 0, processedCanvas.width, processedCanvas.height,
        0, 0, outputCanvas.width, outputCanvas.height
      )

      // Smart timing: wait only remaining time to hit target frame rate
      const now = performance.now()
      const elapsed = now - lastFrameTime
      const waitTime = Math.max(0, frameDuration - elapsed)
      if (waitTime > 0) {
        await new Promise(r => setTimeout(r, waitTime))
      }
      lastFrameTime = performance.now()
    }

    onProgress(95, 'Finalizing...')

    // Stop recording and wait for final data
    const blob = await new Promise<Blob>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('MediaRecorder stop timed out'))
      }, 10000)
      
      recorder.onstop = () => {
        clearTimeout(timeout)
        const finalBlob = new Blob(chunks, { type: mimeType.split(';')[0] })
        resolve(finalBlob)
      }
      recorder.onerror = (e) => {
        clearTimeout(timeout)
        reject(e)
      }
      recorder.stop()
    })

    // Validate output
    if (blob.size < 1000) {
      throw new Error('Export produced empty or invalid video file')
    }

    onProgress(100, 'Done!')
    return blob
  } finally {
    processor.dispose()
    // Stop all tracks
    stream.getTracks().forEach(track => track.stop())
  }
}

/**
 * Seek video to specific time
 */
function seekVideo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      video.removeEventListener('seeked', onSeeked)
      reject(new Error('Video seek timed out'))
    }, 10000)

    const onSeeked = () => {
      clearTimeout(timeout)
      video.removeEventListener('seeked', onSeeked)
      resolve()
    }

    video.addEventListener('seeked', onSeeked)
    video.currentTime = time
  })
}

/**
 * Check if browser is Safari
 */
export function isSafari(): boolean {
  const ua = navigator.userAgent
  return ua.includes('Safari') && !ua.includes('Chrome') && !ua.includes('Chromium')
}
