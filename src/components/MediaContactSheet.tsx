import { useEffect, useRef, type ReactNode } from 'react'
import type { ImageItem } from '../engine/types'
import { revealSelection } from '../lib/reveal-selection'

/** Shared media context, separate from editing controls and preview gestures. */
export function MediaContext({ title, detail, children }: { title: string; detail: string; children?: ReactNode }) {
  return <div className="editor-media-context">
    {children}
    <div className="editor-media-description">
      <p className="editor-media-title" title={title}>{title}</p>
      <p className="editor-media-detail">{detail}</p>
    </div>
  </div>
}

function ContactThumbnail({ image }: { image: ImageItem }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    // Copy the existing reduced preview; do not decode another full source.
    const source = document.createElement('canvas')
    source.width = image.thumbnail.width
    source.height = image.thumbnail.height
    source.getContext('2d')?.putImageData(image.thumbnail, 0, 0)
    canvas.getContext('2d')?.drawImage(source, 0, 0, canvas.width, canvas.height)
    source.width = source.height = 0
  }, [image.thumbnail])
  return <canvas ref={ref} width={80} height={Math.max(1, Math.round(80 * image.thumbnail.height / image.thumbnail.width))} aria-hidden="true" />
}

export function MediaContactSheet({ images, currentIndex, onSelect, disabled, demoMode }: {
  images: ImageItem[]
  currentIndex: number
  onSelect: (index: number) => void
  disabled: boolean
  demoMode: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  const current = images[currentIndex]
  useEffect(() => {
    const strip = ref.current
    const selected = strip?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (!strip || !selected) return
    revealSelection(strip, selected)
  }, [currentIndex])
  return <MediaContext title={demoMode ? 'A little film. A different feeling.' : current.fileName}
    detail={demoMode ? 'Try a look below. Add your photos or video to make it yours.' : `${currentIndex + 1} / ${images.length} · ${current.sourceSize.width} × ${current.sourceSize.height}`}>
    <div ref={ref} className="editor-contact-sheet" role="group" aria-label={demoMode ? 'Demo photos' : 'Your photos'}>
      {images.map((image, index) => <button key={image.id} type="button" className="editor-contact-photo"
        aria-label={`Select photo ${index + 1}: ${demoMode ? `Demo ${index + 1}` : image.fileName}`}
        aria-pressed={currentIndex === index} disabled={disabled} onClick={() => onSelect(index)}>
        <ContactThumbnail image={image} />
        <span className="editor-contact-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
      </button>)}
    </div>
  </MediaContext>
}
