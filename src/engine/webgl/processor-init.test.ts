import { afterEach, describe, expect, it, vi } from 'vitest'
import { WebGLProcessor } from './processor'

type Failure = 'output-context' | 'first-fragment' | 'second-fragment' | 'link' | 'program' | 'buffer-data' | 'framebuffer' | 'texture' | 'texture-upload'

function context(failure?: Failure) {
  const live = {
    shaders: new Set<object>(), programs: new Set<object>(), buffers: new Set<object>(),
    framebuffers: new Set<object>(), textures: new Set<object>(),
  }
  let shaderCount = 0
  let programCount = 0
  const acquire = (type: keyof typeof live) => {
    const resource = {}
    live[type].add(resource)
    return resource
  }
  const release = (type: keyof typeof live, resource: object) => {
    expect(live[type].delete(resource), `${type} must be released once`).toBe(true)
  }
  const loseContext = vi.fn()
  const methods: Record<string, unknown> = {
    createShader: () => { shaderCount++; return acquire('shaders') },
    shaderSource: () => {}, compileShader: () => {},
    getShaderParameter: () => !((failure === 'first-fragment' && shaderCount === 2) || (failure === 'second-fragment' && shaderCount === 4)),
    getShaderInfoLog: () => 'injected compile failure', deleteShader: (r: object) => release('shaders', r),
    createProgram: () => { programCount++; return failure === 'program' && programCount === 2 ? null : acquire('programs') },
    attachShader: () => {}, linkProgram: () => {},
    getProgramParameter: () => !(failure === 'link' && programCount === 2), getProgramInfoLog: () => 'injected link failure',
    deleteProgram: (r: object) => release('programs', r),
    createBuffer: () => acquire('buffers'), bindBuffer: () => {},
    bufferData: () => { if (failure === 'buffer-data') throw new Error('buffer upload failed') },
    deleteBuffer: (r: object) => release('buffers', r),
    createFramebuffer: () => failure === 'framebuffer' ? null : acquire('framebuffers'),
    deleteFramebuffer: (r: object) => release('framebuffers', r),
    createTexture: () => failure === 'texture' ? null : acquire('textures'),
    bindTexture: () => {}, pixelStorei: () => {}, texParameteri: () => {},
    texImage3D: () => { if (failure === 'texture-upload') throw new Error('texture upload failed') },
    deleteTexture: (r: object) => release('textures', r),
    getExtension: () => ({ loseContext }),
  }
  const gl = new Proxy(methods, { get: (target, key: string) => key in target ? target[key] : 1 }) as unknown as WebGL2RenderingContext
  return { gl, live, loseContext }
}

function documentFor(first: ReturnType<typeof context>, second: ReturnType<typeof context>, failure?: Failure) {
  let canvasCount = 0
  const handlers: Record<string, (event: { preventDefault(): void }) => void>[] = []
  return {
    handlers,
    createElement: () => {
      const index = canvasCount++
      handlers[index] = {}
      return {
        addEventListener: (event: string, handler: (event: { preventDefault(): void }) => void) => { handlers[index][event] = handler },
        getContext: (type: string) => type === 'webgl2'
          ? (index === 0 ? first.gl : second.gl)
          : (index === 1 && failure === 'output-context' ? null : {}),
      }
    },
  }
}

function expectReleased(gl: ReturnType<typeof context>) {
  for (const [type, live] of Object.entries(gl.live)) expect(live.size, `${type} leaked`).toBe(0)
}

afterEach(() => vi.unstubAllGlobals())

describe('WebGL initialization resource ownership', () => {
  it.each<Failure>(['output-context', 'first-fragment', 'second-fragment', 'link', 'program', 'buffer-data', 'framebuffer', 'texture', 'texture-upload'])('releases all partial resources after %s failure and recovers on Retry', (failure) => {
    const failed = context(failure)
    const retry = context()
    const document = documentFor(failed, retry, failure)
    vi.stubGlobal('document', document)
    const processor = new WebGLProcessor()
    expect(() => processor.init(17, 11)).toThrow()
    expectReleased(failed)
    expect(failed.loseContext).toHaveBeenCalledOnce()
    expect(() => processor.getImageData()).toThrow('not initialized')
    processor.dispose()
    expect(failed.loseContext).toHaveBeenCalledOnce()

    expect(() => processor.init(17, 11)).not.toThrow()
    expect(retry.live.programs.size).toBe(2)
    expect(retry.live.buffers.size).toBe(1)
    expect(retry.live.framebuffers.size).toBe(1)
    expect(retry.live.textures.size).toBe(1)
    expect(retry.live.shaders.size).toBe(0)
    // An event from the rejected context cannot dirty the new initialized one.
    document.handlers[0].webglcontextlost({ preventDefault() {} })
    processor.init(17, 11)
    expect(retry.loseContext).not.toHaveBeenCalled()
    processor.dispose()
    expectReleased(retry)
    expect(retry.loseContext).toHaveBeenCalledOnce()
  })
})
