import { useState, useCallback, useEffect, useRef } from 'react'
import {
  exportVideo,
  ExportCancelledError,
} from '../engine/video'
import {
  exportVideoWithMediaRecorder,
  canUseMediaRecorder,
} from '../engine/safari-export'
import { isSafari } from '../engine/video/capabilities'
import { ProcessingPlan } from '../engine/types'
import type { VideoData } from '../engine/media-loading'

export interface VideoExportState {
  isExporting: boolean
  progress: number
  status: string
  error: string | null
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
   * Uses WebCodecs VideoEncoder for Chrome/Edge/Firefox.
   * Uses MediaRecorder for the existing Safari fallback.
   */
  const exportVideoWithEffects = useCallback(
    async (plan: ProcessingPlan): Promise<Blob | null> => {
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
        // Safari: use MediaRecorder (WebCodecs VideoEncoder is broken in Safari)
        const useSafariFallback = isSafari() && canUseMediaRecorder()
        
        const blob = useSafariFallback
          ? await exportVideoWithMediaRecorder(
              videoData.video,
              plan,
              (progress, status) => {
                if (isCurrent() && !controller.signal.aborted) setExportState({ isExporting: true, progress, status, error: null })
              },
              () => controller.signal.aborted
            )
          : await exportVideo(
              videoData.video,
              plan,
              (progress, status) => {
                if (isCurrent() && !controller.signal.aborted) setExportState({ isExporting: true, progress, status, error: null })
              },
              () => controller.signal.aborted
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
        setExportState({ isExporting: false, progress: 0, status: '', error: message })
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
    setExportState(previous => ({ ...previous, error: null }))
  }, [])

  return {
    exportState,
    exportVideoWithEffects,
    cancelExport,
    dismissExportError,
  }
}
