import { supportsAudioEncoding } from './audio'
import { closeCodecSafely } from './errors'

interface VideoCodecRequirements {
  width?: number
  height?: number
  framerate?: number
  bitrate?: number
}

const AVC_LEVELS = [
  { hex: '1e', maxFrameMacroblocks: 1_620, maxMacroblocksPerSecond: 40_500 },
  { hex: '1f', maxFrameMacroblocks: 3_600, maxMacroblocksPerSecond: 108_000 },
  { hex: '20', maxFrameMacroblocks: 5_120, maxMacroblocksPerSecond: 216_000 },
  { hex: '28', maxFrameMacroblocks: 8_192, maxMacroblocksPerSecond: 245_760 },
  { hex: '2a', maxFrameMacroblocks: 8_704, maxMacroblocksPerSecond: 522_240 },
  { hex: '32', maxFrameMacroblocks: 22_080, maxMacroblocksPerSecond: 589_824 },
  { hex: '33', maxFrameMacroblocks: 36_864, maxMacroblocksPerSecond: 983_040 },
  { hex: '34', maxFrameMacroblocks: 36_864, maxMacroblocksPerSecond: 2_073_600 },
] as const

export function getAvcCodecCandidates(width: number, height: number, framerate: number): string[] {
  const frameMacroblocks = Math.ceil(width / 16) * Math.ceil(height / 16)
  const macroblocksPerSecond = frameMacroblocks * framerate
  const supportedLevels = AVC_LEVELS.filter(level =>
    level.maxFrameMacroblocks >= frameMacroblocks
    && level.maxMacroblocksPerSecond >= macroblocksPerSecond
  )
  return supportedLevels.flatMap(level => [
    `avc1.6400${level.hex}`,
    `avc1.4d00${level.hex}`,
    `avc1.4200${level.hex}`,
  ])
}

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

export async function isVideoCodecSupported(
  codec = 'avc1.42002a',
  requirements: VideoCodecRequirements = {}
): Promise<boolean> {
  if (typeof VideoEncoder === 'undefined') return false
  try {
    const config: VideoEncoderConfig = {
      codec,
      width: requirements.width ?? 1280,
      height: requirements.height ?? 720,
      bitrate: requirements.bitrate ?? 2_500_000,
      framerate: requirements.framerate ?? 30,
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
    closeCodecSafely(encoder)
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

export async function getExportCapabilities(
  requirements: Required<VideoCodecRequirements> = {
    width: 1280,
    height: 720,
    framerate: 30,
    bitrate: 2_500_000,
  }
): Promise<VideoExportCapabilities> {
  if (typeof VideoEncoder === 'undefined') {
    return { videoSupported: false, audioSupported: false, recommendedCodec: null }
  }
  const h264Codecs = getAvcCodecCandidates(
    requirements.width,
    requirements.height,
    requirements.framerate
  )
  let recommendedCodec: string | null = null
  for (const codec of h264Codecs) {
    if (await isVideoCodecSupported(codec, requirements)) {
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
