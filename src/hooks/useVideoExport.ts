import { useState, useCallback, useEffect, useRef } from 'react'
import {
  exportVideo,
  ExportCancelledError,
  AudioPreservationError,
} from '../engine/video'
import { ProcessingPlan } from '../engine/types'
import type { VideoData } from '../engine/media-loading'

export interface VideoExportState {
  isExporting: boolean
  progress: number
  status: string
  error: string | null
  requiresSilentAudioConsent?: boolean
}

/** Export lifecycle for the video owned by the current media session. */
export function useVideoExport(videoData: VideoData | null) {
  const [exportState, setExportState] = useState<VideoExportState>({
    isExporting: false,
    progress: 0,
    status: '',
    error: null,
  })

  const activeExport = useRef<AbortController | null>(null)

  useEffect(() => {
    setExportState({ isExporting: false, progress: 0, status: '', error: null })
    return () => {
      activeExport.current?.abort()
      activeExport.current = null
    }
  }, [videoData])

  /**
   * Export video with applied effects.
   * Uses the runtime-tested MP4 WebCodecs path and explicit silent-export consent.
   */
  const exportVideoWithEffects = useCallback(
    async (plan: ProcessingPlan, options: { allowSilentAudio?: boolean } = {}): Promise<Blob | null> => {
      if (!videoData || activeExport.current) return null
      const controller = new AbortController()
      activeExport.current = controller
      const isCurrent = () => activeExport.current === controller

      const previewTime = videoData.video.currentTime
      const shouldResumePreview = !videoData.video.paused && !videoData.video.ended
      videoData.video.pause()

      setExportState({
        isExporting: true,
        progress: 0,
        status: 'Starting...',
        error: null,
      })

      try {
        const blob = await exportVideo(
              videoData.video,
              plan,
              (progress, status) => {
                if (isCurrent() && !controller.signal.aborted) setExportState({ isExporting: true, progress, status, error: null })
              },
              () => controller.signal.aborted,
              options
            )

        if (!isCurrent() || controller.signal.aborted) {
          if (isCurrent()) setExportState({ isExporting: false, progress: 0, status: '', error: null })
          return null
        }
        setExportState({ isExporting: false, progress: 100, status: 'Done!', error: null })
        return blob
      } catch (err) {
        if (!isCurrent() || controller.signal.aborted || err instanceof ExportCancelledError || 
            (err instanceof Error && err.message === 'Export cancelled')) {
          if (isCurrent()) setExportState({ isExporting: false, progress: 0, status: '', error: null })
          return null
        }

        const message = err instanceof Error ? err.message : 'Export failed'
        setExportState({ isExporting: false, progress: 0, status: '', error: message, requiresSilentAudioConsent: err instanceof AudioPreservationError })
        throw err
      } finally {
        if (isCurrent()) {
          activeExport.current = null
          if (Number.isFinite(previewTime)) videoData.video.currentTime = previewTime
          if (shouldResumePreview) void videoData.video.play().catch(() => {})
        }
      }
    },
    [videoData]
  )

  /**
   * Cancel ongoing export
   */
  const cancelExport = useCallback(() => {
    activeExport.current?.abort()
  }, [])

  const dismissExportError = useCallback(() => {
    setExportState(previous => ({ ...previous, error: null, requiresSilentAudioConsent: false }))
  }, [])

  return {
    exportState,
    exportVideoWithEffects,
    cancelExport,
    dismissExportError,
  }
}
