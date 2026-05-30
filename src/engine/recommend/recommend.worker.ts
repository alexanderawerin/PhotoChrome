/**
 * Web Worker для Smart Picks: получает thumbnail + EXIF + recipes,
 * возвращает топ-5 recipe IDs.
 */
import type { Recipe } from '../types'
import type { ExifSubset } from '../exif'
import { extractFeatures } from './analyzer'
import { recommendRecipes } from './recommend'

interface AnalyzeRequest {
  type: 'analyze'
  requestId: string
  imageData: ImageData
  exif?: ExifSubset
  recipes: Recipe[]
}

self.addEventListener('message', (e: MessageEvent<AnalyzeRequest>) => {
  const msg = e.data
  if (!msg || msg.type !== 'analyze') return

  try {
    const features = extractFeatures(msg.imageData, msg.exif)
    const recipeIds = recommendRecipes(features, msg.recipes)
    self.postMessage({ type: 'result', requestId: msg.requestId, recipeIds })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'analysis failed'
    self.postMessage({ type: 'error', requestId: msg.requestId, message })
  }
})
