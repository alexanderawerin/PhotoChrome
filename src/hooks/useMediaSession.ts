import { useEffect, useState, useSyncExternalStore } from 'react'
import { MediaSession } from '../engine/media-session'
import { decodeImages, decodeVideo, loadDemoImages } from '../engine/media-loading'
import { releaseVideo } from '../engine/video/frames'

export function useMediaSession(demoUrls: readonly string[]) {
  const [session] = useState(() => new MediaSession({
    photos: decodeImages,
    video: decodeVideo,
    demo: signal => loadDemoImages(demoUrls, signal),
    releaseVideo: data => releaseVideo(data.video),
  }))
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot)
  const request = state.status === 'loading' ? state.request : null
  const [preview, setPreview] = useState<{ request: typeof request; url: string } | null>(null)

  useEffect(() => {
    void session.load({ kind: 'demo' })
    return session.dispose
  }, [session])

  useEffect(() => {
    if (request?.kind !== 'photos') {
      setPreview(null)
      return
    }
    const file = request.files[0]
    if (!file?.type.startsWith('image/')) return
    const url = URL.createObjectURL(file)
    setPreview({ request, url })
    return () => URL.revokeObjectURL(url)
  }, [request])

  return { session, state, previewUrl: preview?.request === request ? preview?.url : null }
}
