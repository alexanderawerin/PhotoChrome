import { VIDEO_MAX_DURATION } from '../../constants'
import { isSafari } from './capabilities'

export interface VideoMetadata {
  duration: number
  width: number
  height: number
  aspectRatio: number
}

const SEEK_TIMEOUT_MS = 10_000

export async function loadVideo(file: File): Promise<{
  video: HTMLVideoElement
  metadata: VideoMetadata
}> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.preload = isSafari() ? 'auto' : 'metadata'
    video.crossOrigin = 'anonymous'
    const url = URL.createObjectURL(file)

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
      if (video.readyState < 1 || video.videoWidth === 0) return
      cleanup()
      const metadata: VideoMetadata = {
        duration: video.duration,
        width: video.videoWidth,
        height: video.videoHeight,
        aspectRatio: video.videoWidth / video.videoHeight,
      }
      if (metadata.duration > VIDEO_MAX_DURATION) {
        URL.revokeObjectURL(url)
        reject(new Error(`Video is too long. Maximum duration is ${VIDEO_MAX_DURATION} seconds.`))
        return
      }
      resolve({ video, metadata })
    }

    video.onloadedmetadata = handleReady
    video.oncanplay = handleReady
    video.onerror = () => {
      cleanup()
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load video. The file may be corrupted or in an unsupported format.'))
    }
    video.src = url
    video.load()
  })
}

async function waitForVideoReady(video: HTMLVideoElement): Promise<void> {
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
    video.addEventListener('canplay', onReady)
    video.addEventListener('canplaythrough', onReady)
    video.addEventListener('loadeddata', onReady)
    if (isSafari() && video.readyState < 2) {
      video.play().then(() => video.pause()).catch(() => {})
    }
  })
}

function isImageDataBlack(imageData: ImageData): boolean {
  const { data } = imageData
  const sampleStep = Math.max(1, Math.floor(data.length / 100))
  let totalBrightness = 0
  let samples = 0
  for (let index = 0; index < data.length; index += sampleStep * 4) {
    totalBrightness += data[index] + data[index + 1] + data[index + 2]
    samples++
  }
  return totalBrightness / (samples * 3) < 5
}

async function extractFrameWithRetry(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  maxAttempts = 3
): Promise<ImageData> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    context.drawImage(video, 0, 0, canvas.width, canvas.height)
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height)
    if (!isImageDataBlack(imageData)) return imageData

    if (isSafari() && attempt < maxAttempts - 1) {
      try {
        await video.play()
        await new Promise(resolve => setTimeout(resolve, 50))
        video.pause()
        video.currentTime = 0
        await new Promise(resolve => setTimeout(resolve, 50))
      } catch {
        // Playback may be blocked; the next draw attempt can still succeed.
      }
    } else {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }
  context.drawImage(video, 0, 0, canvas.width, canvas.height)
  return context.getImageData(0, 0, canvas.width, canvas.height)
}

export async function seekVideoWithTimeout(
  video: HTMLVideoElement,
  time: number,
  timeoutMs = SEEK_TIMEOUT_MS
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

export async function extractFirstFrame(video: HTMLVideoElement): Promise<ImageData> {
  await waitForVideoReady(video)
  await seekVideoWithTimeout(video, 0)
  await new Promise(resolve => requestAnimationFrame(() => resolve(undefined)))
  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Failed to get canvas context')
  return extractFrameWithRetry(video, canvas, context)
}

export async function createVideoThumbnail(video: HTMLVideoElement, maxSize: number): Promise<ImageData> {
  await waitForVideoReady(video)
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
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Failed to get canvas context')
  return extractFrameWithRetry(video, canvas, context)
}
