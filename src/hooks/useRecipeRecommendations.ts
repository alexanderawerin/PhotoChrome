import { useState, useEffect, useRef } from 'react'
import type { ExifSubset } from '../engine/exif'
import { getAllRecipes } from '../presets/recipes'

const DEBOUNCE_MS = 200
const CACHE_MAX = 20

type WorkerMessage =
  | { type: 'result'; requestId: string; recipeIds: string[] }
  | { type: 'error'; requestId: string; message: string }

/**
 * Хук для рекомендации рецептов под текущее фото.
 * Off-main-thread анализ + LRU-кеш по imageId.
 */
export function useRecipeRecommendations(
  imageId: string | null,
  thumbnail: ImageData | null,
  exif?: ExifSubset
): { recipeIds: string[]; isReady: boolean } {
  const [recipeIds, setRecipeIds] = useState<string[]>([])
  const workerRef = useRef<Worker | null>(null)
  const cacheRef = useRef<Map<string, string[]>>(new Map())
  const pendingRequestsRef = useRef<Map<string, string>>(new Map())
  const requestCounterRef = useRef(0)
  const currentRequestRef = useRef<string | null>(null)

  useEffect(() => {
    if (typeof Worker === 'undefined') return
    let worker: Worker | null = null
    const pendingRequests = pendingRequestsRef.current
    try {
      worker = new Worker(
        new URL('../engine/recommend/recommend.worker.ts', import.meta.url),
        { type: 'module' }
      )
      worker.addEventListener('message', (e: MessageEvent<WorkerMessage>) => {
        const requestImageId = pendingRequests.get(e.data.requestId)
        if (!requestImageId) return
        pendingRequests.delete(e.data.requestId)

        if (e.data.type === 'result') {
          if (cacheRef.current.size >= CACHE_MAX) {
            const firstKey = cacheRef.current.keys().next().value
            if (firstKey) cacheRef.current.delete(firstKey)
          }
          cacheRef.current.set(requestImageId, e.data.recipeIds)

          if (e.data.requestId === currentRequestRef.current) {
            setRecipeIds(e.data.recipeIds)
          }
        }
      })
      worker.addEventListener('error', (e: ErrorEvent) => {
        pendingRequests.clear()
        currentRequestRef.current = null
        console.warn('Smart Picks worker error:', e.message)
      })
      workerRef.current = worker
    } catch {
      // Worker creation failed; section will simply never render
    }

    return () => {
      worker?.terminate()
      workerRef.current = null
      pendingRequests.clear()
    }
  }, [])

  useEffect(() => {
    if (!imageId || !thumbnail) {
      setRecipeIds([])
      currentRequestRef.current = null
      return
    }

    const cached = cacheRef.current.get(imageId)
    if (cached) {
      cacheRef.current.delete(imageId)
      cacheRef.current.set(imageId, cached)
      setRecipeIds(cached)
      currentRequestRef.current = null
      return
    }

    setRecipeIds([])

    const timeoutId = setTimeout(() => {
      const worker = workerRef.current
      if (!worker) return

      const reqId = String(++requestCounterRef.current)
      currentRequestRef.current = reqId
      pendingRequestsRef.current.set(reqId, imageId)

      worker.postMessage({
        type: 'analyze',
        requestId: reqId,
        imageData: thumbnail,
        exif,
        recipes: getAllRecipes(),
      })
    }, DEBOUNCE_MS)

    return () => clearTimeout(timeoutId)
  }, [imageId, thumbnail, exif])

  return { recipeIds, isReady: recipeIds.length > 0 }
}
