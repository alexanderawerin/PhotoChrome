import { useState, useCallback, useRef } from 'react'
import {
  loadVideo,
  extractFirstFrame,
  createVideoThumbnail,
  exportVideo,
  VideoMetadata,
  ExportCancelledError,
} from '../engine/video'
import {
  exportVideoWithMediaRecorder,
  canUseMediaRecorder,
  isSafari,
} from '../engine/safari-export'
import { ProcessingPlan } from '../engine/types'
import { THUMBNAIL_MAX_SIZE } from '../constants'

export interface VideoData {
  /** Video element for playback and export */
  video: HTMLVideoElement
  /** Video metadata */
  metadata: VideoMetadata
  /** First frame as full resolution ImageData */
  firstFrame: ImageData
  /** Thumbnail for preview */
  thumbnail: ImageData
}

export interface VideoExportState {
  isExporting: boolean
  progress: number
  status: string
  error: string | null
}

/**
 * Hook for video loading and processing.
 * Uses CPU processor for preview (first frame) and WebGL for export.
 */
export function useVideoProcessor() {
  const [videoData, setVideoData] = useState<VideoData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exportState, setExportState] = useState<VideoExportState>({
    isExporting: false,
    progress: 0,
    status: '',
    error: null,
  })

  const cancelledRef = useRef(false)
  const videoUrlRef = useRef<string | null>(null)

  /**
   * Load video from file.
   * Extracts first frame for preview (processed with CPU like images).
   */
  const loadVideoFile = useCallback(async (file: File) => {
    setIsLoading(true)
    setError(null)

    try {
      // Clean up previous video URL
      if (videoUrlRef.current) {
        URL.revokeObjectURL(videoUrlRef.current)
      }

      const { video, metadata } = await loadVideo(file)
      videoUrlRef.current = video.src

      // Extract first frame first (seeks to 0)
      const firstFrame = await extractFirstFrame(video)
      
      // Then create thumbnail (video is already at position 0)
      const thumbnail = await createVideoThumbnail(video, THUMBNAIL_MAX_SIZE)

      setVideoData({
        video,
        metadata,
        firstFrame,
        thumbnail,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load video. The file may be corrupted or in an unsupported format.'
      setError(message)
      console.error('Video loading failed:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Export video with applied effects.
   * Uses WebCodecs VideoEncoder for Chrome/Edge/Firefox.
   * Falls back to FFmpeg.wasm for Safari.
   */
  const exportVideoWithEffects = useCallback(
    async (plan: ProcessingPlan): Promise<Blob | null> => {
      if (!videoData) return null

      cancelledRef.current = false
      setExportState({
        isExporting: true,
        progress: 0,
        status: 'Starting...',
        error: null,
      })

      try {
        // Safari: use MediaRecorder (WebCodecs VideoEncoder is broken in Safari)
        const useSafariFallback = isSafari() && canUseMediaRecorder()
        
        const blob = useSafariFallback
          ? await exportVideoWithMediaRecorder(
              videoData.video,
              plan,
              (progress, status) => {
                setExportState({ isExporting: true, progress, status, error: null })
              },
              () => cancelledRef.current
            )
          : await exportVideo(
              videoData.video,
              plan,
              (progress, status) => {
                setExportState({ isExporting: true, progress, status, error: null })
              },
              () => cancelledRef.current
            )

        setExportState({ isExporting: false, progress: 100, status: 'Done!', error: null })
        return blob
      } catch (err) {
        if (err instanceof ExportCancelledError || 
            (err instanceof Error && err.message === 'Export cancelled')) {
          setExportState({ isExporting: false, progress: 0, status: '', error: null })
          return null
        }

        const message = err instanceof Error ? err.message : 'Export failed'
        setExportState({ isExporting: false, progress: 0, status: '', error: message })
        throw err
      }
    },
    [videoData]
  )

  /**
   * Cancel ongoing export
   */
  const cancelExport = useCallback(() => {
    cancelledRef.current = true
  }, [])

  const dismissExportError = useCallback(() => {
    setExportState(previous => ({ ...previous, error: null }))
  }, [])

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    if (videoUrlRef.current) {
      URL.revokeObjectURL(videoUrlRef.current)
      videoUrlRef.current = null
    }
    setVideoData(null)
    setError(null)
    setExportState({ isExporting: false, progress: 0, status: '', error: null })
    cancelledRef.current = false
  }, [])

  return {
    /** Loaded video data */
    videoData,
    /** Loading state */
    isLoading,
    /** Error message */
    error,
    /** Export state */
    exportState,
    /** Load video from file */
    loadVideoFile,
    /** Export video with effects */
    exportVideoWithEffects,
    /** Cancel export */
    cancelExport,
    dismissExportError,
    /** Reset state */
    reset,
  }
}
