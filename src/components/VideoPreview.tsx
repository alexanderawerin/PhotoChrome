import { useEffect, useRef, useState, useCallback } from 'react'
import { Play, Pause, Volume2, VolumeX } from 'lucide-react'
import { ProcessingOptions } from '../engine/types'
import { getWebGLProcessor } from '../engine/webgl/processor'
import { Button } from './ui/button'

interface VideoPreviewProps {
  /** HTML Video element */
  video: HTMLVideoElement
  /** Processing options (simulation + settings) */
  processingOptions: ProcessingOptions | null
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
  processingOptions,
  alt = 'Video preview',
  onMouseDown,
  onMouseUp,
  onMouseLeave,
}: VideoPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const animationRef = useRef<number>(0)
  const isRunningRef = useRef(false)
  
  // Use refs to avoid stale closures in animation loop
  const processingOptionsRef = useRef(processingOptions)
  processingOptionsRef.current = processingOptions
  
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })
  const [isReady, setIsReady] = useState(false)

  /**
   * Initialize WebGL processor
   */
  useEffect(() => {
    if (!video || video.videoWidth === 0) return

    try {
      const processor = getWebGLProcessor()
      processor.init(video.videoWidth, video.videoHeight)
      setIsReady(true)
    } catch (err) {
      console.error('Failed to initialize WebGL processor:', err)
      setIsReady(true) // Still allow fallback rendering
    }

    return () => {
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

      const videoAspect = video.videoWidth / video.videoHeight
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
  }, [video, video?.videoWidth, video?.videoHeight])

  /**
   * Render a single frame to canvas
   */
  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || !video || video.videoWidth === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const options = processingOptionsRef.current

    try {
      if (options) {
        // Use WebGL processor for filtered output
        const processor = getWebGLProcessor()
        
        // Ensure processor is initialized with correct dimensions
        processor.init(video.videoWidth, video.videoHeight)
        
        const outputCanvas = processor.processFrame(video, options, video.currentTime)
        ctx.drawImage(outputCanvas, 0, 0, canvas.width, canvas.height)
      } else {
        // No filter - draw video directly
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      }
    } catch {
      // Fallback to unfiltered video on error
      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      } catch {
        // Video might not be ready
      }
    }
  }, [video])

  /**
   * Animation loop
   */
  const startLoop = useCallback(() => {
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

  /**
   * Render frame when filter changes
   */
  useEffect(() => {
    if (!isReady || !video) return
    
    // Render current frame with new filter
    renderFrame()
    
    // If playing, make sure loop is running
    if (!video.paused) {
      startLoop()
    }
  }, [processingOptions, isReady, video, renderFrame, startLoop])

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
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      onTouchStart={onMouseDown}
      onTouchEnd={onMouseUp}
    >
      <div
        className="relative group"
        style={{
          width: canvasSize.width || 'auto',
          height: canvasSize.height || 'auto',
        }}
      >
        <canvas
          ref={canvasRef}
          width={video.videoWidth}
          height={video.videoHeight}
          className="block w-full h-full rounded-lg shadow-2xl bg-black"
          aria-label={alt}
        />

        {/* Play/Pause overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200">
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
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-b-lg">
          <div className="flex items-center justify-between">
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
