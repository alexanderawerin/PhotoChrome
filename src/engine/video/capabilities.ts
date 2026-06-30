import { supportsAudioEncoding } from './audio'

export function isSafari(): boolean {
  const userAgent = navigator.userAgent
  return userAgent.includes('Safari') && !userAgent.includes('Chrome') && !userAgent.includes('Chromium')
}

export function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/')
}

export function supportsVideoExport(): boolean {
  return typeof VideoEncoder !== 'undefined'
}

export async function isVideoCodecSupported(codec = 'avc1.42002a'): Promise<boolean> {
  if (typeof VideoEncoder === 'undefined') return false
  try {
    const config: VideoEncoderConfig = {
      codec,
      width: 1280,
      height: 720,
      bitrate: 2_500_000,
      framerate: 30,
    }
    if (isSafari()) config.hardwareAcceleration = 'prefer-software'
    const support = await VideoEncoder.isConfigSupported(config)
    return support.supported === true
  } catch {
    return false
  }
}

export async function testVideoEncoderWorks(): Promise<{ works: boolean; error?: string }> {
  if (typeof VideoEncoder === 'undefined') {
    return { works: false, error: 'VideoEncoder API not available' }
  }
  try {
    let testError: string | null = null
    const encoder = new VideoEncoder({
      output: () => {},
      error: error => { testError = error instanceof Error ? error.message : String(error) },
    })
    const config: VideoEncoderConfig = {
      codec: 'avc1.42001e',
      width: 640,
      height: 480,
      bitrate: 1_000_000,
      framerate: 30,
    }
    if (isSafari()) config.hardwareAcceleration = 'prefer-software'
    encoder.configure(config)
    await new Promise(resolve => setTimeout(resolve, 100))
    const state = encoder.state
    encoder.close()
    if (testError) return { works: false, error: testError }
    if (state !== 'configured') return { works: false, error: `Encoder state: ${state}` }
    return { works: true }
  } catch (error) {
    return { works: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export interface VideoExportCapabilities {
  videoSupported: boolean
  audioSupported: boolean
  recommendedCodec: string | null
}

export async function getExportCapabilities(): Promise<VideoExportCapabilities> {
  if (typeof VideoEncoder === 'undefined') {
    return { videoSupported: false, audioSupported: false, recommendedCodec: null }
  }
  const h264Codecs = isSafari()
    ? ['avc1.42001e', 'avc1.42001f', 'avc1.420028', 'avc1.4d001e']
    : ['avc1.640028', 'avc1.42002a', 'avc1.4d001f', 'avc1.42001e']
  let recommendedCodec: string | null = null
  for (const codec of h264Codecs) {
    if (await isVideoCodecSupported(codec)) {
      recommendedCodec = codec
      break
    }
  }
  return {
    videoSupported: recommendedCodec !== null,
    audioSupported: await supportsAudioEncoding(),
    recommendedCodec,
  }
}
