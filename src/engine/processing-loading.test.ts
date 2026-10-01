import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Recipe } from './types'

class RequestedImage {
  static requests: RequestedImage[] = []
  width = 8
  height = 8
  crossOrigin = ''
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  set src(_url: string) { RequestedImage.requests.push(this) }
}

const recipe = (filmSimulation: string): Recipe => ({
  id: `test-${filmSimulation}`, name: 'Test profile', filmSimulation, settings: { color: 2 },
} as Recipe)

describe('required film resource preparation', () => {
  beforeEach(() => {
    vi.resetModules()
    RequestedImage.requests = []
    vi.stubGlobal('Image', RequestedImage)
    vi.stubGlobal('document', {
      createElement: () => ({ getContext: () => ({
        drawImage: vi.fn(),
        getImageData: () => ({ width: 8, height: 8, data: new Uint8ClampedArray(256) }),
      }) }),
    })
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('waits for the actual LUT loader and snapshots mutable profile settings before waiting', async () => {
    const { prepareProcessingPlan, createProcessingPlan } = await import('./processing-plan')
    const profile = recipe('provia')
    const overrides = { color: 4 }
    const size = { width: 3, height: 2 }
    let delivered = false
    const pending = prepareProcessingPlan(profile, size, overrides).then(plan => { delivered = true; return plan })
    expect(() => createProcessingPlan(profile, size)).toThrow('not ready')
    await Promise.resolve()
    expect(delivered).toBe(false)
    expect(RequestedImage.requests).toHaveLength(1)
    profile.id = 'changed'
    profile.filmSimulation = 'velvia'
    overrides.color = 9
    size.width = 50
    RequestedImage.requests[0].onload?.()
    const ready = await pending
    expect(ready.recipe.id).toBe('test-provia')
    expect(ready.simulation.id).toBe('provia')
    expect(ready.settings.color).toBe(4)
    expect(ready.targetSize).toEqual({ width: 3, height: 2 })
    expect(ready.lut).not.toBeNull()
  })

  it('rejects a failed required request and retries the same profile with a fresh request', async () => {
    const { prepareProcessingPlan } = await import('./processing-plan')
    const profile = recipe('velvia')
    const pending = prepareProcessingPlan(profile, { width: 1, height: 1 })
    const failure = expect(pending).rejects.toThrow('Retry')
    RequestedImage.requests[0].onerror?.()
    await failure
    const retry = prepareProcessingPlan(profile, { width: 1, height: 1 })
    expect(RequestedImage.requests).toHaveLength(2)
    RequestedImage.requests[1].onload?.()
    expect((await retry).lut).not.toBeNull()
  })

  it('rejects cancellation promptly and never delivers a late shared request to that consumer', async () => {
    const { prepareProcessingPlan } = await import('./processing-plan')
    const controller = new AbortController()
    const old = prepareProcessingPlan(recipe('provia'), { width: 1, height: 1 }, {}, { signal: controller.signal })
    const rejected = expect(old).rejects.toMatchObject({ name: 'AbortError' })
    controller.abort()
    await rejected
    const current = prepareProcessingPlan(recipe('velvia'), { width: 2, height: 2 })
    RequestedImage.requests[0].onload?.()
    RequestedImage.requests[1].onload?.()
    expect((await current).simulation.id).toBe('velvia')
  })

  it('deduplicates simultaneous requests while preserving independent cancellation', async () => {
    const { prepareProcessingPlan } = await import('./processing-plan')
    const controller = new AbortController()
    const cancelled = prepareProcessingPlan(recipe('astia'), { width: 1, height: 1 }, {}, { signal: controller.signal })
    const other = prepareProcessingPlan(recipe('astia'), { width: 2, height: 2 })
    const rejected = expect(cancelled).rejects.toMatchObject({ name: 'AbortError' })
    controller.abort()
    expect(RequestedImage.requests).toHaveLength(1)
    RequestedImage.requests[0].onload?.()
    await rejected
    expect((await other).targetSize.width).toBe(2)
  })

  it('allows Eterna and Classic Neg without requesting a LUT', async () => {
    const { prepareProcessingPlan } = await import('./processing-plan')
    for (const id of ['eterna', 'classic-neg']) {
      expect((await prepareProcessingPlan(recipe(id), { width: 1, height: 1 })).lut).toBeNull()
    }
    expect(RequestedImage.requests).toHaveLength(0)
  })

  it('holds photo delivery until its required request completes and never delivers a failed substitute', async () => {
    const { createProcessingPlanFromSimulation } = await import('./processing-plan')
    const { getSimulation } = await import('../presets/simulations')
    const { ImageProcessor } = await import('./processor')
    const { exportPhoto } = await import('./photo-export')
    const imageData = { width: 1, height: 1, data: new Uint8ClampedArray([10, 20, 30, 255]) } as ImageData
    const click = vi.fn()
    const anchor = { href: '', download: '', click, remove: vi.fn() }
    vi.stubGlobal('document', {
      createElement: (tag: string) => tag === 'a' ? anchor : ({ getContext: () => ({
        drawImage: vi.fn(),
        getImageData: () => ({ width: 8, height: 8, data: new Uint8ClampedArray(256) }),
      }) }),
      body: { appendChild: vi.fn() },
    })
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:ready-film')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
    const process = vi.spyOn(ImageProcessor, 'processAsync').mockResolvedValue(imageData)
    vi.spyOn(ImageProcessor, 'addWatermark').mockReturnValue(imageData)
    vi.spyOn(ImageProcessor, 'imageDataToBlob').mockResolvedValue(new Blob(['jpeg']))
    vi.spyOn(ImageProcessor, 'createThumbnail').mockRejectedValue(new Error('No optional preview'))
    const plan = createProcessingPlanFromSimulation({
      recipe: { id: 'provia', name: 'Provia', simulationId: 'provia' },
      simulation: getSimulation('provia')!,
      targetSize: imageData,
    })
    const request = { imageData, plan, fileName: 'provia.jpg', watermarkText: '', exifInfo: {} }
    const pending = exportPhoto(request)
    await Promise.resolve()
    expect(process).not.toHaveBeenCalled()
    expect(click).not.toHaveBeenCalled()
    RequestedImage.requests[0].onerror?.()
    expect((await pending).status).toBe('error')
    expect(process).not.toHaveBeenCalled()
    expect(click).not.toHaveBeenCalled()
    const retry = exportPhoto(request)
    expect(RequestedImage.requests).toHaveLength(2)
    RequestedImage.requests[1].onload?.()
    expect((await retry).status).toBe('success')
    expect(process.mock.calls[0][1].lut).not.toBeNull()
    expect(click).toHaveBeenCalledOnce()
  })
})
