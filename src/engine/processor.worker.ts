/**
 * Web Worker для асинхронной CPU-обработки изображений.
 * Выполняется в отдельном потоке — не блокирует UI.
 *
 * Используется для полноразмерного экспорта через ImageProcessor.processAsync().
 */

import type { ProcessingPlan } from './types'
import type { HaldCLUT } from './haldclut'
import { processOnCPU } from './cpu'

interface ProcessRequest {
  type: 'process'
  requestId: string
  buffer: ArrayBuffer
  width: number
  height: number
  plan: ProcessingPlan
  lutId?: string
}

interface RegisterLutRequest {
  type: 'register-lut'
  lutId: string
  lut: HaldCLUT
}

type WorkerRequest = ProcessRequest | RegisterLutRequest

const registeredLuts = new Map<string, HaldCLUT>()

self.addEventListener('message', (e: MessageEvent<WorkerRequest>) => {
  if (e.data.type === 'register-lut') {
    registeredLuts.set(e.data.lutId, e.data.lut)
    return
  }

  const { requestId, buffer, width, height, plan, lutId } = e.data
  try {
    const lut = lutId ? registeredLuts.get(lutId) : plan.lut
    if (lutId && !lut) throw new Error(`LUT ${lutId} is not registered`)
    const imageData = new ImageData(new Uint8ClampedArray(buffer), width, height)
    const result = processOnCPU(imageData, { ...plan, lut: lut ?? null })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(self as any).postMessage(
      { type: 'result', requestId, buffer: result.data.buffer, width: result.width, height: result.height },
      [result.data.buffer]
    )
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(self as any).postMessage({
      type: 'error',
      requestId,
      message: error instanceof Error ? error.message : String(error),
    })
  }
})
