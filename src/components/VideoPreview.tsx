import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react'
import { Play, Pause, Volume2, VolumeX } from 'lucide-react'
import { ProcessingPlan } from '../engine/types'
import { WebGLProcessor } from '../engine/webgl/processor'
import { createDefaultTransformState, type ImageTransformState } from '../engine/transform'
import { getVideoOutputSize, renderVideoTransform } from '../engine/video/geometry'
import { CropOverlay } from './CropOverlay'
import { Button } from './ui/button'

interface VideoPreviewProps {
  /** HTML Video element */
  video: HTMLVideoElement
  /** Shared processing plan */
  processingPlan: ProcessingPlan | null
  transform?: ImageTransformState
  cropMode?: boolean
  onTransformChange?: (changes: Partial<ImageTransformState>) => void
  cropGridActive?: boolean
  onProcessingError?: (message: string | null) => void
  retryKey?: number
  overlay?: ReactNode
  statusOverlay?: ReactNode
  colorOverlay?: ReactNode
  /** Pause playback rendering while another process owns the video element. */
  isSuspended?: boolean
  /** Alt text for accessibility */
  alt?: string
  /** Callback for mouse/touch down (for before/after comparison) */
  onMouseDown?: () => void
  /** Callback for mouse/touch up */
  onMouseUp?: () => void
  /** Callback for mouse leave */
  onMouseLeave?: () => void
}

/**
 * Video preview component with real-time WebGL filter rendering.
 * Plays the video and applies film simulation effects in real-time.
 */
export function VideoPreview({
  video,
  processingPlan,
  transform,
  cropMode = false,
  onTransformChange,
  cropGridActive = false,
  onProcessingError,
  retryKey = 0,
  overlay,
  statusOverlay,
  colorOverlay,
  isSuspended = false,
  alt = 'Video preview',
  onMouseDown,
  onMouseUp,
  onMouseLeave,
}: VideoPreviewProps) {
  const fullTransform = transform ?? processingPlan?.geometry ?? createDefaultTransformState()
  const visibleTransform = cropMode ? { ...fullTransform, cropRatio: 'original' as const } : fullTransform
  const outputSize = getVideoOutputSize(video.videoWidth, video.videoHeight, visibleTransform)
  const transformRef = useRef(visibleTransform)
  transformRef.current = visibleTransform
  const errorCallbackRef = useRef(onProcessingError)
  errorCallbackRef.current = onProcessingError
  const processorRef = useRef<WebGLProcessor | null>(null)
  const transformedCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const failedRef = useRef(false)
  const [processingError, setProcessingError] = useState<string | null>(null)
  const pinchRef = useRef<{ distance: number; scale: number } | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<number>(0)
  const isRunningRef = useRef(false)
  const isSuspendedRef = useRef(isSuspended)
  isSuspendedRef.current = isSuspended
  
  // Use refs to avoid stale closures in animation loop
  const processingPlanRef = useRef(processingPlan)
  processingPlanRef.current = processingPlan
  
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })
  const [isReady, setIsReady] = useState(false)

  /**
   * Initialize WebGL processor
   */
  useEffect(() => {
    if (!video || video.videoWidth === 0) return

    setIsReady(true)
    failedRef.current = false
    return () => {
      processorRef.current?.dispose()
      processorRef.current = null
      if (transformedCanvasRef.current) {
        transformedCanvasRef.current.width = 0
        transformedCanvasRef.current.height = 0
        transformedCanvasRef.current = null
      }
      isRunningRef.current = false
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [video, video?.videoWidth, video?.videoHeight])

  /**
   * Calculate display size based on container
   */
  useEffect(() => {
    if (!wrapperRef.current || !video || video.videoWidth === 0) return

    let isActive = true
    
    const updateSize = () => {
      if (!isActive) return
      const wrapper = wrapperRef.current
      if (!wrapper || !video) return

      const rect = wrapper.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return

      const videoAspect = outputSize.width / outputSize.height
      const containerAspect = rect.width / rect.height

      let displayWidth: number
      let displayHeight: number

      if (videoAspect > containerAspect) {
        displayWidth = rect.width
        displayHeight = rect.width / videoAspect
      } else {
        displayHeight = rect.height
        displayWidth = rect.height * videoAspect
      }

      setCanvasSize({ width: displayWidth, height: displayHeight })
    }

    // Initial update with delay to ensure layout is ready
    const timeoutId = setTimeout(updateSize, 50)
    updateSize()

    const resizeObserver = new ResizeObserver(() => {
      requestAnimationFrame(updateSize)
    })
    resizeObserver.observe(wrapperRef.current)

    return () => {
      isActive = false
      clearTimeout(timeoutId)
      resizeObserver.disconnect()
    }
  }, [video, outputSize.width, outputSize.height])

  /**
   * Render a single frame to canvas
   */
  const renderFrame = useCallback(() => {
    if (isSuspendedRef.current) return
    const canvas = canvasRef.current
    if (!canvas || !video || video.videoWidth === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const plan = processingPlanRef.current

    if (failedRef.current) return
    try {
      const transformed = renderVideoTransform(video, video.videoWidth, video.videoHeight,
        transformRef.current, transformedCanvasRef.current ?? undefined)
      transformedCanvasRef.current = transformed
      let output = transformed
      if (plan && plan.colorMode !== 'original') {
        const processor = processorRef.current ?? new WebGLProcessor()
        processorRef.current = processor
        processor.init(transformed.width, transformed.height)
        output = processor.processFrame(transformed, { ...plan, targetSize: { width: transformed.width, height: transformed.height } }, video.currentTime)
      }
      if (canvas.width !== output.width) canvas.width = output.width
      if (canvas.height !== output.height) canvas.height = output.height
      ctx.drawImage(output, 0, 0)
      setProcessingError(null)
      errorCallbackRef.current?.(null)
    } catch (error) {
      failedRef.current = true
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const message = error instanceof Error ? error.message : 'Video preview processing failed. Please retry.'
      setProcessingError(message)
      errorCallbackRef.current?.(message)
    }
  }, [video])

  /**
   * Animation loop
   */
  const startLoop = useCallback(() => {
    if (isSuspendedRef.current) return
    if (isRunningRef.current) return
    isRunningRef.current = true

    const loop = () => {
      if (!isRunningRef.current) return
      
      renderFrame()
      
      if (!video?.paused && !video?.ended) {
        animationRef.current = requestAnimationFrame(loop)
      } else {
        isRunningRef.current = false
      }
    }

    animationRef.current = requestAnimationFrame(loop)
  }, [video, renderFrame])

  const stopLoop = useCallback(() => {
    isRunningRef.current = false
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current)
      animationRef.current = 0
    }
  }, [])

  /**
   * Handle play/pause
   */
  const togglePlay = useCallback(() => {
    if (!video) return

    if (video.paused) {
      video.play().then(() => {
        setIsPlaying(true)
        startLoop()
      }).catch(err => {
        console.error('Play failed:', err)
        renderFrame() // At least show current frame
      })
    } else {
      video.pause()
      setIsPlaying(false)
      stopLoop()
      renderFrame() // Render paused frame
    }
  }, [video, startLoop, stopLoop, renderFrame])

  /**
   * Handle mute toggle
   */
  const toggleMute = useCallback(() => {
    if (!video) return
    video.muted = !video.muted
    setIsMuted(video.muted)
  }, [video])

  /**
   * Track if component is mounted (prevents state updates after unmount)
   */
  const isMountedRef = useRef(true)
  
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  /**
   * Sync video events with state
   */
  useEffect(() => {
    if (!video) return

    const handlePlay = () => {
      if (!isMountedRef.current) return
      setIsPlaying(true)
      startLoop()
    }
    
    const handlePause = () => {
      if (!isMountedRef.current) return
      setIsPlaying(false)
      stopLoop()
      renderFrame()
    }
    
    const handleEnded = () => {
      if (!isMountedRef.current) return
      setIsPlaying(false)
      stopLoop()
      // Loop video
      video.currentTime = 0
      video.play().catch(() => {
        if (isMountedRef.current) renderFrame()
      })
    }

    const handleSeeked = () => {
      if (!isMountedRef.current) return
      if (isSuspendedRef.current) return
      renderFrame()
    }

    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)
    video.addEventListener('ended', handleEnded)
    video.addEventListener('seeked', handleSeeked)

    return () => {
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
      video.removeEventListener('ended', handleEnded)
      video.removeEventListener('seeked', handleSeeked)
    }
  }, [video, startLoop, stopLoop, renderFrame])

  useEffect(() => {
    if (isSuspended) {
      stopLoop()
      return
    }
    renderFrame()
    if (!video.paused) startLoop()
  }, [isSuspended, video, renderFrame, startLoop, stopLoop])

  /**
   * Render frame when filter changes
   */
  useEffect(() => {
    if (!isReady || !video) return
    
    failedRef.current = false
    if (retryKey) {
      processorRef.current?.dispose()
      processorRef.current = null
    }
    renderFrame()
    
    // If playing, make sure loop is running
    if (!video.paused) {
      startLoop()
    }
  }, [processingPlan, transform, cropMode, retryKey, isReady, video, renderFrame, startLoop])

  /**
   * Auto-play on mount
   */
  useEffect(() => {
    if (!isReady || !video) return

    // Set muted for autoplay policy
    video.muted = true
    setIsMuted(true)

    // Seek to start
    video.currentTime = 0

    // Try to autoplay
    const tryAutoplay = async () => {
      if (!isMountedRef.current) return
      try {
        await video.play()
        if (!isMountedRef.current) return
        setIsPlaying(true)
        startLoop()
      } catch {
        // Autoplay blocked - just render first frame
        if (isMountedRef.current) renderFrame()
      }
    }

    // Small delay to ensure everything is ready
    const timeoutId = setTimeout(tryAutoplay, 100)

    return () => {
      clearTimeout(timeoutId)
      stopLoop()
      video.pause()
    }
  }, [isReady, video, startLoop, stopLoop, renderFrame])

  // Show nothing until we have valid dimensions
  if (!video || video.videoWidth === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-zinc-500 text-sm">Loading video...</div>
      </div>
    )
  }

  return (
    <div
      ref={wrapperRef}
      className="w-full h-full flex items-center justify-center select-none overflow-hidden"
      onMouseDown={cropMode ? undefined : onMouseDown}
      onMouseUp={cropMode ? undefined : onMouseUp}
      onMouseLeave={cropMode ? undefined : onMouseLeave}
      onTouchStart={event => {
        if (!cropMode) { onMouseDown?.(); return }
        if (event.touches.length === 2) pinchRef.current = {
          distance: Math.hypot(event.touches[0].clientX - event.touches[1].clientX, event.touches[0].clientY - event.touches[1].clientY),
          scale: fullTransform.cropScale,
        }
      }}
      onTouchMove={event => {
        if (!cropMode || event.touches.length !== 2 || !pinchRef.current) return
        const distance = Math.hypot(event.touches[0].clientX - event.touches[1].clientX, event.touches[0].clientY - event.touches[1].clientY)
        onTransformChange?.({ cropScale: Math.max(1, Math.min(3, pinchRef.current.scale * distance / pinchRef.current.distance)) })
      }}
      onTouchEnd={() => { pinchRef.current = null; if (!cropMode) onMouseUp?.() }}
    >
      <div
        className="editor-preview-canvas relative group"
        style={{
          width: canvasSize.width || 'auto',
          height: canvasSize.height || 'auto',
        }}
      >
        <canvas
          ref={canvasRef}
          width={outputSize.width}
          height={outputSize.height}
          className="block w-full h-full rounded-lg shadow-2xl bg-black"
          aria-label={alt}
        />

        {overlay && <div className="editor-preview-overlay"
          onMouseDown={event => event.stopPropagation()} onTouchStart={event => event.stopPropagation()}
          onTouchEnd={event => event.stopPropagation()}>{overlay}</div>}
        {statusOverlay && <div className="editor-processing-overlay">{statusOverlay}</div>}
        {colorOverlay && <div className="editor-color-overlay">{colorOverlay}</div>}

        {processingError && <div className="absolute inset-0 flex items-center justify-center bg-black/75 p-4 text-sm text-white">{processingError}</div>}
        {cropMode && <div className="absolute inset-0 rounded-lg overflow-hidden">
          <CropOverlay
            imageWidth={outputSize.width}
            imageHeight={outputSize.height}
            aspectRatio={fullTransform.cropRatio}
            offsetX={fullTransform.cropOffset.x}
            offsetY={fullTransform.cropOffset.y}
            onOffsetChange={cropOffset => onTransformChange?.({ cropOffset })}
            cropRect={fullTransform.cropRect}
            onCropRectChange={cropRect => onTransformChange?.({ cropRect })}
            gridActive={cropGridActive}
          />
        </div>}

        {/* Play/Pause overlay */}
        <div className={`${cropMode ? 'hidden' : ''} absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200`}>
          <Button
            variant="ghost"
            size="icon"
            onClick={togglePlay}
            className="w-16 h-16 rounded-full bg-black/50 hover:bg-black/70 text-white"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <Pause className="w-8 h-8" />
            ) : (
              <Play className="w-8 h-8 ml-1" />
            )}
          </Button>
        </div>

        {/* Controls bar */}
        <div className={`${cropMode ? 'hidden' : ''} absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-b-lg`}>
          <div className="flex items-center justify-between" role="toolbar" aria-label="Video playback">
            <Button
              variant="ghost"
              size="icon"
              onClick={togglePlay}
              className="w-8 h-8 text-white hover:bg-white/20"
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4 ml-0.5" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMute}
              className="w-8 h-8 text-white hover:bg-white/20"
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
