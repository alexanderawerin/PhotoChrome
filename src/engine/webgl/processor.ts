/**
 * WebGL-based image/video processor
 * Used for video export (frame-by-frame rendering)
 * Does NOT replace CPU processor for images - they coexist
 */

import { ProcessingOptions, RecipeSettings, CurvePoints } from '../types'
import type { HaldCLUT } from '../haldclut'
import { getCachedLUT } from '../../presets/simulations'
import { grainEffectToStrength, grainSizeToNumber } from '../grain'

// Import shaders as raw strings
import baseVert from './shaders/base.vert?raw'
import filmFrag from './shaders/film.frag?raw'
import blurFrag from './shaders/blur.frag?raw'
import sharpenFrag from './shaders/sharpen.frag?raw'

interface WebGLResources {
  gl: WebGL2RenderingContext
  canvas: HTMLCanvasElement
  outputCanvas: HTMLCanvasElement  // 2D canvas for correct orientation
  outputCtx: CanvasRenderingContext2D
  filmProgram: WebGLProgram
  blurProgram: WebGLProgram
  sharpenProgram: WebGLProgram
  quadBuffer: WebGLBuffer
  frameBuffer: WebGLFramebuffer
  dummy3DTexture: WebGLTexture
}

/**
 * Creates and compiles a shader
 */
function createShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string
): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) throw new Error('Failed to create shader')

  gl.shaderSource(shader, source)
  gl.compileShader(shader)

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error(`Shader compilation failed: ${info}`)
  }

  return shader
}

/**
 * Creates a shader program from vertex and fragment shaders
 */
function createProgram(
  gl: WebGL2RenderingContext,
  vertSource: string,
  fragSource: string
): WebGLProgram {
  const vertShader = createShader(gl, gl.VERTEX_SHADER, vertSource)
  const fragShader = createShader(gl, gl.FRAGMENT_SHADER, fragSource)

  const program = gl.createProgram()
  if (!program) throw new Error('Failed to create program')

  gl.attachShader(program, vertShader)
  gl.attachShader(program, fragShader)
  gl.linkProgram(program)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program)
    gl.deleteProgram(program)
    throw new Error(`Program linking failed: ${info}`)
  }

  // Clean up shaders (they're now part of the program)
  gl.deleteShader(vertShader)
  gl.deleteShader(fragShader)

  return program
}

/**
 * Creates a fullscreen quad buffer
 */
function createQuadBuffer(gl: WebGL2RenderingContext): WebGLBuffer {
  const buffer = gl.createBuffer()
  if (!buffer) throw new Error('Failed to create buffer')

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
       1,  1,
    ]),
    gl.STATIC_DRAW
  )

  return buffer
}

/**
 * Creates a texture from ImageData or HTMLVideoElement
 */
function createTexture(
  gl: WebGL2RenderingContext,
  source: ImageData | HTMLVideoElement | HTMLCanvasElement
): WebGLTexture {
  const texture = gl.createTexture()
  if (!texture) throw new Error('Failed to create texture')

  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

  // UNPACK_FLIP_Y_WEBGL=1 нужен для обоих типов источников:
  // WebGL ожидает данные с y=0 снизу, но ImageData/Canvas имеют y=0 сверху.
  // Без флипа изображение рендерится перевёрнутым.
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1)

  if (source instanceof ImageData) {
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      source.width,
      source.height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      source.data
    )
  } else {
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      source
    )
  }

  return texture
}

/**
 * Creates a 1D LUT texture from curve points
 */
function createCurveLUT(
  gl: WebGL2RenderingContext,
  curve: CurvePoints
): WebGLTexture {
  const lut = new Uint8Array(256 * 4) // RGBA for compatibility
  const points = [...curve.points].sort((a, b) => a[0] - b[0])

  for (let i = 0; i < 256; i++) {
    const value = interpolateCurve(i, points)
    lut[i * 4] = value     // R
    lut[i * 4 + 1] = value // G
    lut[i * 4 + 2] = value // B
    lut[i * 4 + 3] = 255   // A
  }

  const texture = gl.createTexture()
  if (!texture) throw new Error('Failed to create LUT texture')

  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    256,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    lut
  )

  return texture
}

/**
 * Interpolates curve value (same logic as CPU version)
 */
function interpolateCurve(x: number, points: [number, number][]): number {
  if (x <= points[0][0]) {
    return Math.max(0, Math.min(255, Math.round(points[0][1])))
  }
  if (x >= points[points.length - 1][0]) {
    return Math.max(0, Math.min(255, Math.round(points[points.length - 1][1])))
  }

  for (let i = 0; i < points.length - 1; i++) {
    const [x1, y1] = points[i]
    const [x2, y2] = points[i + 1]

    if (x >= x1 && x <= x2) {
      const t = (x - x1) / (x2 - x1)
      const y = y1 + (y2 - y1) * t
      return Math.max(0, Math.min(255, Math.round(y)))
    }
  }

  return x
}

/**
 * Creates a 3D texture from a HaldCLUT for GPU LUT lookup.
 * Repacks sequential HaldCLUT pixel layout into a proper 3D texture.
 */
function createHaldCLUT3DTexture(
  gl: WebGL2RenderingContext,
  lut: HaldCLUT
): WebGLTexture {
  const size = lut.gridSize // e.g. 64 for Level 8
  const data = new Uint8Array(size * size * size * 3)

  for (let b = 0; b < size; b++) {
    for (let g = 0; g < size; g++) {
      for (let r = 0; r < size; r++) {
        const srcIdx = b * size * size + g * size + r
        const srcX = srcIdx % lut.width
        const srcY = (srcIdx / lut.width) | 0
        const srcOffset = (srcY * lut.width + srcX) * 4
        const dstOffset = (b * size * size + g * size + r) * 3
        data[dstOffset] = lut.data[srcOffset]
        data[dstOffset + 1] = lut.data[srcOffset + 1]
        data[dstOffset + 2] = lut.data[srcOffset + 2]
      }
    }
  }

  const texture = gl.createTexture()
  if (!texture) throw new Error('Failed to create 3D LUT texture')

  gl.bindTexture(gl.TEXTURE_3D, texture)
  // FLIP_Y must be disabled for 3D textures (WebGL2 requirement)
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0)
  gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGB8, size, size, size, 0, gl.RGB, gl.UNSIGNED_BYTE, data)
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE)

  return texture
}

/**
 * Creates a render target (framebuffer + texture)
 */
function createRenderTarget(
  gl: WebGL2RenderingContext,
  width: number,
  height: number
): { framebuffer: WebGLFramebuffer; texture: WebGLTexture } {
  const texture = gl.createTexture()
  if (!texture) throw new Error('Failed to create render target texture')

  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    width,
    height,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null
  )

  const framebuffer = gl.createFramebuffer()
  if (!framebuffer) throw new Error('Failed to create framebuffer')

  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer)
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    texture,
    0
  )

  gl.bindFramebuffer(gl.FRAMEBUFFER, null)

  return { framebuffer, texture }
}

/**
 * Error thrown when WebGL context is lost
 */
export class WebGLContextLostError extends Error {
  constructor() {
    super('WebGL context was lost. Please try again.')
    this.name = 'WebGLContextLostError'
  }
}

/**
 * WebGL Processor class for video frame processing
 */
export class WebGLProcessor {
  private resources: WebGLResources | null = null
  private width = 0
  private height = 0
  private contextLost = false
  private lutTextureCache = new Map<string, WebGLTexture>()

  /**
   * Initialize WebGL context and resources
   */
  init(width: number, height: number): void {
    if (this.resources && this.width === width && this.height === height && !this.contextLost) {
      return // Already initialized with same dimensions
    }

    this.dispose() // Clean up old resources
    this.contextLost = false

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    // Handle context loss events
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault()
      this.contextLost = true
      console.warn('WebGL context lost')
    })

    canvas.addEventListener('webglcontextrestored', () => {
      console.log('WebGL context restored')
      this.contextLost = false
      // Will need to reinitialize on next processFrame call
      this.resources = null
    })

    const gl = canvas.getContext('webgl2', {
      antialias: false,
      preserveDrawingBuffer: true,
      alpha: true,
      powerPreference: 'high-performance',
    })

    if (!gl) {
      throw new Error('WebGL2 not supported')
    }

    // Create output canvas for correct orientation (WebGL renders bottom-up)
    const outputCanvas = document.createElement('canvas')
    outputCanvas.width = width
    outputCanvas.height = height
    const outputCtx = outputCanvas.getContext('2d')
    if (!outputCtx) {
      throw new Error('Failed to get 2D context')
    }

    const filmProgram = createProgram(gl, baseVert, filmFrag)
    const blurProgram = createProgram(gl, baseVert, blurFrag)
    const sharpenProgram = createProgram(gl, baseVert, sharpenFrag)
    const quadBuffer = createQuadBuffer(gl)

    const frameBuffer = gl.createFramebuffer()
    if (!frameBuffer) throw new Error('Failed to create framebuffer')

    // Create a reusable 1x1x1 dummy 3D texture for when HaldCLUT is not used.
    // Prevents "two textures of different types on same sampler" error.
    const dummy3DTexture = gl.createTexture()
    if (!dummy3DTexture) throw new Error('Failed to create dummy 3D texture')
    gl.bindTexture(gl.TEXTURE_3D, dummy3DTexture)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0)
    gl.texImage3D(gl.TEXTURE_3D, 0, gl.RGB8, 1, 1, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0]))
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

    this.resources = {
      gl,
      canvas,
      outputCanvas,
      outputCtx,
      filmProgram,
      blurProgram,
      sharpenProgram,
      quadBuffer,
      frameBuffer,
      dummy3DTexture,
    }
    this.width = width
    this.height = height
  }

  /**
   * Process a video frame with all effects
   */
  processFrame(
    source: HTMLVideoElement | HTMLCanvasElement | ImageData,
    options: ProcessingOptions,
    time: number = 0
  ): HTMLCanvasElement {
    if (this.contextLost) {
      throw new WebGLContextLostError()
    }

    if (!this.resources) {
      throw new Error('WebGL processor not initialized')
    }

    const { gl, canvas, outputCanvas, outputCtx, filmProgram, blurProgram, sharpenProgram, quadBuffer, dummy3DTexture } = this.resources
    const { simulation, settings } = options

    // Create source texture
    const sourceTexture = createTexture(gl, source)

    // Get or create HaldCLUT 3D texture (cached) or curve LUT (per-frame)
    let haldCLUTTexture: WebGLTexture | null = null
    let curveLUT: WebGLTexture | null = null
    const lut = getCachedLUT(simulation.id)

    if (lut) {
      // Reuse cached GPU texture for this simulation
      haldCLUTTexture = this.lutTextureCache.get(simulation.id) ?? null
      if (!haldCLUTTexture) {
        haldCLUTTexture = createHaldCLUT3DTexture(gl, lut)
        this.lutTextureCache.set(simulation.id, haldCLUTTexture)
      }
    } else if (simulation.curve) {
      curveLUT = createCurveLUT(gl, simulation.curve)
    }

    // Check if sharpness is needed (requires multi-pass)
    const sharpnessAmount = settings?.sharpness ?? 0
    const needsSharpness = sharpnessAmount !== 0

    let currentTexture = sourceTexture
    let renderTarget: { framebuffer: WebGLFramebuffer; texture: WebGLTexture } | null = null

    // If sharpness is needed, render film effects to a render target first
    if (needsSharpness) {
      renderTarget = createRenderTarget(gl, this.width, this.height)
      gl.bindFramebuffer(gl.FRAMEBUFFER, renderTarget.framebuffer)
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    }

    // Render with film shader
    gl.viewport(0, 0, this.width, this.height)
    gl.useProgram(filmProgram)

    // Bind quad buffer
    const positionLoc = gl.getAttribLocation(filmProgram, 'position')
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer)
    gl.enableVertexAttribArray(positionLoc)
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0)

    // Bind textures
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, currentTexture)
    gl.uniform1i(gl.getUniformLocation(filmProgram, 'uTexture'), 0)

    // Always bind sampler3D uHaldCLUT to unit 2 to avoid
    // "Two textures of different types use the same sampler location" error.
    // In WebGL2, all sampler uniforms must be on separate units even if unused.
    gl.uniform1i(gl.getUniformLocation(filmProgram, 'uHaldCLUT'), 2)

    // Bind HaldCLUT 3D texture or curve LUT
    if (haldCLUTTexture) {
      gl.activeTexture(gl.TEXTURE2)
      gl.bindTexture(gl.TEXTURE_3D, haldCLUTTexture)
      gl.uniform1i(gl.getUniformLocation(filmProgram, 'uUseHaldCLUT'), 1)
      gl.uniform1i(gl.getUniformLocation(filmProgram, 'uHaldCLUTSize'), lut!.gridSize)
      gl.uniform1i(gl.getUniformLocation(filmProgram, 'uUseCurve'), 0)
    } else {
      // Bind reusable dummy 3D texture to unit 2 so sampler3D is valid
      gl.activeTexture(gl.TEXTURE2)
      gl.bindTexture(gl.TEXTURE_3D, dummy3DTexture)
      gl.uniform1i(gl.getUniformLocation(filmProgram, 'uUseHaldCLUT'), 0)

      if (curveLUT) {
        gl.activeTexture(gl.TEXTURE1)
        gl.bindTexture(gl.TEXTURE_2D, curveLUT)
        gl.uniform1i(gl.getUniformLocation(filmProgram, 'uCurveLUT'), 1)
        gl.uniform1i(gl.getUniformLocation(filmProgram, 'uUseCurve'), 1)
      } else {
        gl.uniform1i(gl.getUniformLocation(filmProgram, 'uUseCurve'), 0)
      }
    }

    // Set uniforms
    this.setFilmUniforms(gl, filmProgram, simulation, settings, time)

    // Draw
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

    // Apply sharpness if needed (multi-pass)
    if (needsSharpness && renderTarget) {
      currentTexture = this.applySharpness(
        gl,
        blurProgram,
        sharpenProgram,
        quadBuffer,
        renderTarget.texture,
        sharpnessAmount
      )
    }

    // Clean up (haldCLUTTexture is cached, not deleted per-frame)
    gl.deleteTexture(sourceTexture)
    if (curveLUT) gl.deleteTexture(curveLUT)
    if (renderTarget) {
      gl.deleteFramebuffer(renderTarget.framebuffer)
      gl.deleteTexture(renderTarget.texture)
    }

    // Copy WebGL canvas to output canvas
    // Note: UNPACK_FLIP_Y_WEBGL=1 was used for Canvas sources, so texture is already
    // in correct orientation. No additional flip needed.
    outputCtx.drawImage(canvas, 0, 0)

    return outputCanvas
  }

  /**
   * Set all film shader uniforms
   */
  private setFilmUniforms(
    gl: WebGL2RenderingContext,
    program: WebGLProgram,
    simulation: ProcessingOptions['simulation'],
    settings: RecipeSettings | undefined,
    time: number
  ): void {
    // Resolution
    gl.uniform2f(
      gl.getUniformLocation(program, 'uResolution'),
      this.width,
      this.height
    )

    // Color balance
    if (simulation.colorBalance) {
      gl.uniform1i(gl.getUniformLocation(program, 'uUseColorBalance'), 1)
      gl.uniform3f(
        gl.getUniformLocation(program, 'uShadowsBalance'),
        simulation.colorBalance.shadows.r,
        simulation.colorBalance.shadows.g,
        simulation.colorBalance.shadows.b
      )
      gl.uniform3f(
        gl.getUniformLocation(program, 'uHighlightsBalance'),
        simulation.colorBalance.highlights.r,
        simulation.colorBalance.highlights.g,
        simulation.colorBalance.highlights.b
      )
    } else {
      gl.uniform1i(gl.getUniformLocation(program, 'uUseColorBalance'), 0)
    }

    // Base saturation from simulation
    let saturation = simulation.saturation ?? 0
    // Add recipe color setting
    if (settings?.color !== undefined) {
      saturation += settings.color / 10
    }
    gl.uniform1f(gl.getUniformLocation(program, 'uSaturation'), saturation)

    // White balance shift
    gl.uniform1f(
      gl.getUniformLocation(program, 'uWbShiftRed'),
      settings?.wbShiftRed ?? 0
    )
    gl.uniform1f(
      gl.getUniformLocation(program, 'uWbShiftBlue'),
      settings?.wbShiftBlue ?? 0
    )

    // Tone adjustment
    gl.uniform1f(
      gl.getUniformLocation(program, 'uHighlightTone'),
      settings?.highlight ?? 0
    )
    gl.uniform1f(
      gl.getUniformLocation(program, 'uShadowTone'),
      settings?.shadow ?? 0
    )

    // Clarity
    gl.uniform1f(
      gl.getUniformLocation(program, 'uClarity'),
      settings?.clarity ?? 0
    )

    // Color Chrome
    let colorChrome = 0
    if (settings?.colorChromeEffect === 'weak') colorChrome = 0.12
    if (settings?.colorChromeEffect === 'strong') colorChrome = 0.25
    gl.uniform1f(gl.getUniformLocation(program, 'uColorChrome'), colorChrome)

    // Color Chrome FX Blue
    let colorChromeFXBlue = 0
    if (settings?.colorChromeFXBlue === 'weak') colorChromeFXBlue = 1.08
    if (settings?.colorChromeFXBlue === 'strong') colorChromeFXBlue = 1.15
    gl.uniform1f(
      gl.getUniformLocation(program, 'uColorChromeFXBlue'),
      colorChromeFXBlue
    )

    // Grain
    const grainStrength = settings?.grainEffect
      ? grainEffectToStrength(settings.grainEffect)
      : 0
    const grainSize = settings?.grainSize
      ? grainSizeToNumber(settings.grainSize)
      : 1.0
    gl.uniform1f(gl.getUniformLocation(program, 'uGrainStrength'), grainStrength)
    gl.uniform1f(gl.getUniformLocation(program, 'uGrainSize'), grainSize)
    gl.uniform1f(gl.getUniformLocation(program, 'uTime'), time)
  }

  /**
   * Apply sharpness using unsharp mask (multi-pass)
   */
  private applySharpness(
    gl: WebGL2RenderingContext,
    blurProgram: WebGLProgram,
    sharpenProgram: WebGLProgram,
    quadBuffer: WebGLBuffer,
    sourceTexture: WebGLTexture,
    amount: number
  ): WebGLTexture {
    // Create intermediate render targets
    const blurTarget = createRenderTarget(gl, this.width, this.height)

    // Pass 1: Blur
    gl.bindFramebuffer(gl.FRAMEBUFFER, blurTarget.framebuffer)
    gl.viewport(0, 0, this.width, this.height)
    gl.useProgram(blurProgram)

    const blurPosLoc = gl.getAttribLocation(blurProgram, 'position')
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer)
    gl.enableVertexAttribArray(blurPosLoc)
    gl.vertexAttribPointer(blurPosLoc, 2, gl.FLOAT, false, 0, 0)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, sourceTexture)
    gl.uniform1i(gl.getUniformLocation(blurProgram, 'uTexture'), 0)
    gl.uniform2f(
      gl.getUniformLocation(blurProgram, 'uResolution'),
      this.width,
      this.height
    )
    gl.uniform2f(gl.getUniformLocation(blurProgram, 'uDirection'), 1, 1)

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

    // Pass 2: Sharpen (render to screen)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, this.width, this.height)
    gl.useProgram(sharpenProgram)

    const sharpPosLoc = gl.getAttribLocation(sharpenProgram, 'position')
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer)
    gl.enableVertexAttribArray(sharpPosLoc)
    gl.vertexAttribPointer(sharpPosLoc, 2, gl.FLOAT, false, 0, 0)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, sourceTexture)
    gl.uniform1i(gl.getUniformLocation(sharpenProgram, 'uTexture'), 0)

    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, blurTarget.texture)
    gl.uniform1i(gl.getUniformLocation(sharpenProgram, 'uBlurred'), 1)

    gl.uniform1f(gl.getUniformLocation(sharpenProgram, 'uAmount'), amount)

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

    // Clean up
    gl.deleteFramebuffer(blurTarget.framebuffer)
    gl.deleteTexture(blurTarget.texture)

    return sourceTexture
  }

  /**
   * Get the result as ImageData
   */
  getImageData(): ImageData {
    if (!this.resources) {
      throw new Error('WebGL processor not initialized')
    }

    const { gl } = this.resources
    const pixels = new Uint8Array(this.width * this.height * 4)
    gl.readPixels(0, 0, this.width, this.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels)

    // WebGL reads bottom-to-top, need to flip
    const flipped = new Uint8ClampedArray(this.width * this.height * 4)
    for (let y = 0; y < this.height; y++) {
      const srcRow = (this.height - 1 - y) * this.width * 4
      const dstRow = y * this.width * 4
      for (let x = 0; x < this.width * 4; x++) {
        flipped[dstRow + x] = pixels[srcRow + x]
      }
    }

    return new ImageData(flipped, this.width, this.height)
  }

  /**
   * Clean up WebGL resources
   */
  dispose(): void {
    if (!this.resources) return

    const { gl, filmProgram, blurProgram, sharpenProgram, quadBuffer, frameBuffer } = this.resources

    gl.deleteProgram(filmProgram)
    gl.deleteProgram(blurProgram)
    gl.deleteProgram(sharpenProgram)
    gl.deleteBuffer(quadBuffer)
    gl.deleteFramebuffer(frameBuffer)

    // Clean up cached LUT textures
    for (const tex of this.lutTextureCache.values()) {
      gl.deleteTexture(tex)
    }
    this.lutTextureCache.clear()

    // Lose context to free GPU memory
    const ext = gl.getExtension('WEBGL_lose_context')
    if (ext) ext.loseContext()

    this.resources = null
    this.width = 0
    this.height = 0
  }
}

// Singleton instance for video processing
let processorInstance: WebGLProcessor | null = null

/**
 * Get or create the WebGL processor instance (for video)
 */
export function getWebGLProcessor(): WebGLProcessor {
  if (!processorInstance) {
    processorInstance = new WebGLProcessor()
  }
  return processorInstance
}

// Separate singleton for photo processing (avoids conflicts with video pipeline)
let photoProcessorInstance: WebGLProcessor | null = null

/**
 * Get or create the WebGL processor instance for photo processing
 */
export function getPhotoWebGLProcessor(): WebGLProcessor {
  if (!photoProcessorInstance) {
    photoProcessorInstance = new WebGLProcessor()
  }
  return photoProcessorInstance
}

