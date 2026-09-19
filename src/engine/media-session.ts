import type { ImageItem } from './types'
import type { MediaSelectionItem } from './media-selection'
import type { VideoData } from './media-loading'

export type LoadedMedia =
  | { kind: 'demo' | 'photos'; images: ImageItem[]; currentIndex: number }
  | { kind: 'video'; fileName: string; data: VideoData }

export type MediaRequest =
  | { kind: 'demo' }
  | { kind: 'photos'; files: readonly File[]; mode: 'replace' | 'append' }
  | { kind: 'video'; file: File }

export type MediaSessionState =
  | { status: 'empty'; media: null }
  | { status: 'ready'; media: LoadedMedia }
  | { status: 'loading'; media: LoadedMedia | null; request: MediaRequest }
  | { status: 'error'; media: LoadedMedia | null; request: MediaRequest; message: string }

interface MediaLoaders {
  photos: (files: readonly File[], existing: readonly MediaSelectionItem[], signal: AbortSignal) => Promise<ImageItem[]>
  demo: (signal: AbortSignal) => Promise<ImageItem[]>
  video: (file: File, signal: AbortSignal) => Promise<VideoData>
  releaseVideo: (video: VideoData) => void
}

/**
 * Owns loaded media and in-flight replacements. A failed or superseded load
 * cannot overwrite the working session. Native decoders may finish after
 * cancellation; their result is rejected by the operation identity as well.
 */
export class MediaSession {
  private state: MediaSessionState = { status: 'empty', media: null }
  private listeners = new Set<() => void>()
  private operationId = 0
  private controller: AbortController | null = null

  constructor(private loaders: MediaLoaders) {}

  getSnapshot = (): MediaSessionState => this.state

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  private publish(state: MediaSessionState): void {
    this.state = state
    this.listeners.forEach(listener => listener())
  }

  private release(media: LoadedMedia | null): void {
    if (media?.kind === 'video') this.loaders.releaseVideo(media.data)
  }

  load = async (selection: MediaRequest): Promise<void> => {
    if (selection.kind === 'photos' && selection.files.length === 0) return
    const request = selection.kind === 'photos' ? { ...selection, files: [...selection.files] } : selection
    const previous = this.state.media
    const id = ++this.operationId
    this.controller?.abort()
    const controller = new AbortController()
    this.controller = controller
    const { signal } = controller
    this.publish({ status: 'loading', media: previous, request })

    try {
      let media: LoadedMedia
      if (request.kind === 'video') {
        media = { kind: 'video', fileName: request.file.name, data: await this.loaders.video(request.file, signal) }
      } else if (request.kind === 'demo') {
        media = { kind: 'demo', images: await this.loaders.demo(signal), currentIndex: 0 }
      } else {
        const append = request.mode === 'append'
        if (append && previous?.kind !== 'photos') throw new Error('Open your photos before adding to the batch.')
        const batch = append && previous?.kind === 'photos' ? previous : null
        const existing = batch?.images.map(image => ({
          file: image.file, width: image.original.width, height: image.original.height,
        })) ?? []
        const images = await this.loaders.photos(request.files, existing, signal)
        media = {
          kind: 'photos',
          images: batch ? [...batch.images, ...images] : images,
          currentIndex: batch?.currentIndex ?? 0,
        }
      }

      if (id !== this.operationId || signal.aborted) {
        this.release(media)
        return
      }
      this.controller = null
      this.publish({ status: 'ready', media })
      this.release(previous)
    } catch (error) {
      if (id !== this.operationId || signal.aborted) return
      this.controller = null
      // Stop sibling demo fetches/decodes after the first failure.
      controller.abort()
      this.publish({
        status: 'error', media: previous, request,
        message: error instanceof Error ? error.message : 'Failed to load media.',
      })
    }
  }

  retry = (): Promise<void> => this.state.status === 'error'
    ? this.load(this.state.request)
    : Promise.resolve()

  resume = (): void => {
    if (!this.state.media) return
    ++this.operationId
    this.controller?.abort()
    this.controller = null
    this.publish({ status: 'ready', media: this.state.media })
  }

  goToImage = (index: number): void => {
    const { status, media } = this.state
    if (status !== 'ready' || media?.kind === 'video' || !media) return
    if (!Number.isInteger(index) || index < 0 || index >= media.images.length) return
    this.publish({ status: 'ready', media: { ...media, currentIndex: index } })
  }

  updateImage = (id: string, updates: Partial<ImageItem>): void => {
    const { status, media } = this.state
    if (status !== 'ready' || media?.kind === 'video' || !media) return
    this.publish({ status: 'ready', media: {
      ...media, images: media.images.map(image => image.id === id ? { ...image, ...updates } : image),
    } })
  }

  /** Also safe during React's development-only setup/cleanup/setup cycle. */
  dispose = (): void => {
    ++this.operationId
    this.controller?.abort()
    this.controller = null
    const previous = this.state.media
    this.publish({ status: 'empty', media: null })
    this.release(previous)
  }
}
