import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { processOnCPU } from './cpu'
import { createProcessingPlanFromSimulation } from './processing-plan'
import type { RecipeSettings } from './types'

class TestImageData {
  constructor(public data: Uint8ClampedArray, public width: number, public height: number) {}
}

function source(): ImageData {
  return new ImageData(new Uint8ClampedArray([
    20, 40, 230, 0, 90, 160, 30, 1, 255, 80, 10, 127,
    130, 120, 110, 255, 15, 30, 50, 17, 200, 180, 250, 200,
  ]), 3, 2)
}

function plan(settings: RecipeSettings) {
  return createProcessingPlanFromSimulation({
    recipe: { id: 'test', name: 'Test', simulationId: 'test' },
    simulation: { id: 'test', name: 'Test' },
    settings,
    targetSize: { width: 3, height: 2 },
  })
}

beforeEach(() => vi.stubGlobal('ImageData', TestImageData))
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('shared CPU processing contract', () => {
  it('worker message boundary matches direct CPU for combined effects and varying alpha', async () => {
    let onMessage: (event: { data: unknown }) => void = () => { throw new Error('Worker listener unavailable') }
    const postMessage = vi.fn()
    vi.stubGlobal('self', { addEventListener: (_name: string, listener: typeof onMessage) => { onMessage = listener }, postMessage })
    await import('./processor.worker')
    const input = source()
    const processingPlan = plan({ sharpness: 4, clarity: -5, color: 4, highlight: 4, shadow: -2, wbShiftRed: -9, wbShiftBlue: 9, colorChromeEffect: 'strong', colorChromeFXBlue: 'strong', grainEffect: 'off' })
    const expected = processOnCPU(input, processingPlan)
    onMessage({ data: { type: 'process', requestId: 'rgba', buffer: input.data.buffer.slice(0), width: 3, height: 2, plan: processingPlan } })
    expect(postMessage).toHaveBeenCalledOnce()
    const result = postMessage.mock.calls[0][0]
    expect(result.type).toBe('result')
    expect(new Uint8ClampedArray(result.buffer)).toEqual(expected.data)
    expect(Array.from(expected.data).filter((_, i) => i % 4 === 3)).toEqual([0, 1, 127, 255, 17, 200])
    expect(input.data).toEqual(source().data)
  })

  it.each(['small', 'large'] as const)('grain %s preserves alpha and changes RGB within its specified noise range', (grainSize) => {
    vi.spyOn(Math, 'random').mockReturnValue(0.75)
    const input = source()
    const output = processOnCPU(input, plan({ grainEffect: 'strong', grainSize }))
    let changed = 0
    for (let i = 0; i < output.data.length; i++) {
      if (i % 4 === 3) expect(output.data[i]).toBe(input.data[i])
      else {
        expect(Math.abs(output.data[i] - input.data[i])).toBeLessThanOrEqual(30)
        if (output.data[i] !== input.data[i]) changed++
      }
    }
    expect(changed).toBeGreaterThan(0)
  })
})
