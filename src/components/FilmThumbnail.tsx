import { memo, useEffect, useRef, useState } from 'react'
import type { Recipe } from '../engine/types'
import { ImageProcessor } from '../engine/processor'
import { prepareProcessingPlan } from '../engine/processing-plan'
import { processedPreviewCache, resizePreviewImage } from '../engine/preview-image'
import { getImageKey } from '../engine/image-identity'
import { usePreviewVisibility } from '../hooks/usePreviewVisibility'
import { PREVIEW_CACHE_MAX_SIZE, PREVIEW_GENERATION_DELAY } from '../constants'
import { Spinner } from './ui/spinner'

interface FilmThumbnailProps {
  sourceImage: ImageData
  recipe: Recipe | null
  retryKey?: number
}

function FilmThumbnailComponent({ sourceImage, recipe, retryKey = 0 }: FilmThumbnailProps) {
  const wrapperRef = useRef<HTMLSpanElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const visible = usePreviewVisibility(wrapperRef)
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.width = canvas.height = 0
    setState(visible ? 'loading' : 'idle')
    if (!visible) return
    const controller = new AbortController()
    const size = Math.round(92 * Math.min(2, Math.max(1, window.devicePixelRatio || 1)))
    const cacheKey = `films/${recipe?.id ?? 'original'}/${getImageKey(sourceImage)}/${size}`

    const render = async () => {
      try {
        let preview = processedPreviewCache.get(cacheKey)
        if (!preview) {
          const smallImage = resizePreviewImage(sourceImage, size)
          const plan = recipe ? await prepareProcessingPlan(recipe, smallImage, {}, { signal: controller.signal }) : null
          if (controller.signal.aborted) return
          preview = plan ? ImageProcessor.process(smallImage, plan) : smallImage
          if (controller.signal.aborted) return
          if (processedPreviewCache.size >= PREVIEW_CACHE_MAX_SIZE) {
            const oldest = processedPreviewCache.keys().next().value
            if (oldest !== undefined) processedPreviewCache.delete(oldest)
          }
          processedPreviewCache.set(cacheKey, preview)
        }
        if (controller.signal.aborted) return
        const context = canvas.getContext('2d')
        if (!context) throw new Error('Preview canvas unavailable')
        canvas.width = preview.width
        canvas.height = preview.height
        context.putImageData(preview, 0, 0)
        setState('ready')
      } catch {
        // The main preview owns actionable film-resource errors and Retry.
        if (!controller.signal.aborted) setState('error')
      }
    }

    const timer = setTimeout(() => void render(), PREVIEW_GENERATION_DELAY)
    return () => {
      controller.abort()
      clearTimeout(timer)
      canvas.width = canvas.height = 0
    }
  }, [sourceImage, recipe, visible, retryKey])

  return (
    <span ref={wrapperRef} className="film-thumbnail" data-preview-state={state}>
      <canvas ref={canvasRef} className="film-thumbnail-canvas" aria-hidden="true" />
      {state === 'loading' && <span className="film-thumbnail-state" aria-hidden="true"><Spinner className="size-3" /></span>}
      {state === 'error' && <span className="film-thumbnail-state">Preview unavailable</span>}
    </span>
  )
}

export const FilmThumbnail = memo(FilmThumbnailComponent)
