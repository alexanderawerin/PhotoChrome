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
  const processorRef = useRef(getWebGLProcessor())
  
  const [isPlaying, setIsPlaying] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 })
  const [isInitialized, setIsInitialized] = useState(false)

  /**
   * Initialize WebGL processor and canvas size
   */
  useEffect(() => {
    if (!video) return

    const processor = processorRef.current
    
    try {
      processor.init(video.videoWidth, video.videoHeight)
      setIsInitialized(true)
    } catch (err) {
      console.error('Failed to initialize WebGL processor:', err)
      setIsInitialized(false)
    }

    return () => {
      // Cancel animation frame on cleanup
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [video])

  /**
   * Calculate display size based on container
   */
  useEffect(() => {
    if (!wrapperRef.current || !video) return

    const updateSize = () => {
      const wrapper = wrapperRef.current
      if (!wrapper) return

      const rect = wrapper.getBoundingClientRect()
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

    updateSize()

    const resizeObserver = new ResizeObserver(updateSize)
    resizeObserver.observe(wrapperRef.current)
    window.addEventListener('resize', updateSize)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', updateSize)
    }
  }, [video])

  /**
   * Render loop - continuously renders video frames with effects
   */
  const renderFrame = useCallback(() => {
    if (!canvasRef.current || !video || !isInitialized) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const processor = processorRef.current

    try {
      if (processingOptions) {
        // Use WebGL processor for filtered output
        const currentTime = video.currentTime
        const outputCanvas = processor.processFrame(video, processingOptions, currentTime)
        
        // Draw to display canvas
        ctx.drawImage(outputCanvas, 0, 0, canvas.width, canvas.height)
      } else {
        // No filter - draw video directly
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      }
    } catch (err) {
      // Fallback to unfiltered video on WebGL error
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    }

    // Continue loop if playing
    if (!video.paused && !video.ended) {
      animationRef.current = requestAnimationFrame(renderFrame)
    }
  }, [video, processingOptions, isInitialized])

  /**
   * Handle play/pause
   */
  const togglePlay = useCallback(() => {
    if (!video) return

    if (video.paused) {
      video.play().then(() => {
        setIsPlaying(true)
        animationRef.current = requestAnimationFrame(renderFrame)
      }).catch(console.error)
    } else {
      video.pause()
      setIsPlaying(false)
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [video, renderFrame])

  /**
   * Handle mute toggle
   */
  const toggleMute = useCallback(() => {
    if (!video) return
    video.muted = !video.muted
    setIsMuted(video.muted)
  }, [video])

  /**
   * Sync video events with state
   */
  useEffect(() => {
    if (!video) return

    const handlePlay = () => {
      setIsPlaying(true)
      animationRef.current = requestAnimationFrame(renderFrame)
    }
    const handlePause = () => {
      setIsPlaying(false)
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
    const handleEnded = () => {
      setIsPlaying(false)
      // Loop video
      video.currentTime = 0
      video.play().catch(() => {})
    }

    video.addEventListener('play', handlePlay)
    video.addEventListener('pause', handlePause)
    video.addEventListener('ended', handleEnded)

    // Set initial muted state
    video.muted = true
    setIsMuted(true)

    return () => {
      video.removeEventListener('play', handlePlay)
      video.removeEventListener('pause', handlePause)
      video.removeEventListener('ended', handleEnded)
    }
  }, [video, renderFrame])

  /**
   * Render initial frame when filter changes or video loads
   */
  useEffect(() => {
    if (!video || !isInitialized) return

    // Render one frame immediately
    renderFrame()
  }, [processingOptions, isInitialized, renderFrame])

  /**
   * Auto-play on mount
   */
  useEffect(() => {
    if (!video || !isInitialized) return

    // Start playback automatically (muted for autoplay policy)
    video.muted = true
    video.play().catch(() => {
      // Autoplay blocked - render static frame
      renderFrame()
    })

    return () => {
      video.pause()
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [video, isInitialized, renderFrame])

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
          width={video?.videoWidth || 1920}
          height={video?.videoHeight || 1080}
          className="block w-full h-full rounded-lg shadow-2xl"
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

