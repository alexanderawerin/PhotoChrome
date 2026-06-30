import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ImageProcessor, ProcessingTimeoutError } from './processor'
import type { ProcessingPlan } from './types'

type Listener = (event: { data: Record<string, unknown>; message?: string }) => void

class FakeWorker {
  static instances: FakeWorker[] = []
  messages: Record<string, unknown>[] = []
  listeners = new Map<string, Listener[]>()
  terminated = false

  constructor() {
    FakeWorker.instances.push(this)
  }

  postMessage(message: Record<string, unknown>): void {
    this.messages.push(message)
  }

  addEventListener(type: string, listener: Listener): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener])
  }

  emitMessage(data: Record<string, unknown>): void {
    for (const listener of this.listeners.get('message') ?? []) listener({ data })
  }

  terminate(): void {
    this.terminated = true
  }
}

class FakeImageData {
  constructor(
    public data: Uint8ClampedArray,
    public width: number,
    public height: number
  ) {}
}

const plan = (withLut = true): ProcessingPlan => ({
  version: 1,
  recipe: { id: 'test', name: 'Test', simulationId: 'simulation' },
  simulation: { id: 'simulation', name: 'Simulation', curve: { points: [[0, 0], [255, 255]] } },
  settings: {},
  lut: withLut
    ? { level: 1, gridSize: 1, width: 1, data: new Uint8ClampedArray([0, 0, 0, 255]) }
    : null,
  targetSize: { width: 1, height: 1 },
})

const source = () => new ImageData(new Uint8ClampedArray([10, 20, 30, 255]), 1, 1)

function finishNext(worker: FakeWorker): void {
  const request = worker.messages.findLast(message => message.type === 'process')
  if (!request) throw new Error('No process request')
  worker.emitMessage({
    type: 'result',
    requestId: request.requestId,
    buffer: new Uint8ClampedArray([11, 21, 31, 255]).buffer,
    width: 1,
    height: 1,
  })
}

describe('ImageProcessor worker lifecycle', () => {
  beforeEach(() => {
    FakeWorker.instances = []
    vi.stubGlobal('Worker', FakeWorker)
    vi.stubGlobal('ImageData', FakeImageData)
  })

  afterEach(() => {
    ImageProcessor.disposeProcessingWorker()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('runs one request at a time and registers a LUT once per worker generation', async () => {
    const processingPlan = plan()
    const first = ImageProcessor.processAsync(source(), processingPlan)
    const second = ImageProcessor.processAsync(source(), processingPlan)
    const worker = FakeWorker.instances[0]

    expect(worker.messages.map(message => message.type)).toEqual(['register-lut', 'process'])
    finishNext(worker)
    await first

    expect(worker.messages.map(message => message.type)).toEqual(['register-lut', 'process', 'process'])
    finishNext(worker)
    await second
    expect(FakeWorker.instances).toHaveLength(1)
  })

  it('terminates a timed-out worker and recovers with a fresh generation', async () => {
    vi.useFakeTimers()
    const processingPlan = plan()
    const timedOut = ImageProcessor.processAsync(source(), processingPlan, { timeoutMs: 5 })
    const timeoutExpectation = expect(timedOut).rejects.toBeInstanceOf(ProcessingTimeoutError)
    const firstWorker = FakeWorker.instances[0]

    await vi.advanceTimersByTimeAsync(5)
    await timeoutExpectation
    expect(firstWorker.terminated).toBe(true)

    const recovered = ImageProcessor.processAsync(source(), processingPlan)
    const secondWorker = FakeWorker.instances[1]
    expect(secondWorker.messages.map(message => message.type)).toEqual(['register-lut', 'process'])
    finishNext(secondWorker)
    await expect(recovered).resolves.toMatchObject({ width: 1, height: 1 })
  })

  it('terminates on active cancellation and continues a queued request on a new worker', async () => {
    const controller = new AbortController()
    const cancelled = ImageProcessor.processAsync(source(), plan(false), { signal: controller.signal })
    const cancellationExpectation = expect(cancelled).rejects.toMatchObject({ name: 'AbortError' })
    const queued = ImageProcessor.processAsync(source(), plan(false))
    const firstWorker = FakeWorker.instances[0]

    controller.abort()
    await cancellationExpectation
    expect(firstWorker.terminated).toBe(true)

    const secondWorker = FakeWorker.instances[1]
    expect(secondWorker.messages.map(message => message.type)).toEqual(['process'])
    finishNext(secondWorker)
    await expect(queued).resolves.toMatchObject({ width: 1, height: 1 })
  })
})
