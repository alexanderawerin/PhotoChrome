import { useEffect, useRef } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import type { ImageItem } from '../engine/types'
import { Sheet, SheetContent, SheetDescription, SheetTitle } from './ui/sheet'

function CollectionThumbnail({ image }: { image: ImageItem }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    // Use the existing bounded thumbnail; source pixels and object URLs stay owned
    // by the media session. Mount these previews only while the sheet is open.
    const source = document.createElement('canvas')
    source.width = image.thumbnail.width
    source.height = image.thumbnail.height
    source.getContext('2d')?.putImageData(image.thumbnail, 0, 0)
    const scale = 160 / Math.max(source.width, source.height)
    canvas.width = Math.max(1, Math.round(source.width * scale))
    canvas.height = Math.max(1, Math.round(source.height * scale))
    canvas.getContext('2d')?.drawImage(source, 0, 0, canvas.width, canvas.height)
    source.width = source.height = 0
  }, [image.thumbnail])
  return <canvas ref={ref} aria-hidden="true" />
}

export function PhotoCollection({ images, currentIndex, onSelect, open, onOpenChange, disabled, demoMode }: {
  images: ImageItem[]
  currentIndex: number
  onSelect: (index: number) => void
  open: boolean
  onOpenChange: (open: boolean) => void
  disabled: boolean
  demoMode: boolean
}) {
  const trigger = useRef<HTMLButtonElement>(null)
  const current = images[currentIndex]
  return <>
    <button ref={trigger} type="button" className="editor-collection-trigger editor-file-identity" disabled={disabled}
      aria-label={`Open ${demoMode ? 'demo ' : ''}photo collection, ${currentIndex + 1} of ${images.length}`}
      aria-expanded={open} aria-haspopup="dialog" onClick={() => onOpenChange(true)}>
      <span title={current.fileName}>{demoMode ? 'PhotoChrome' : current.fileName}</span>
      <small>{demoMode ? 'Try a film' : 'Your photos'}<span className="editor-photo-count">{currentIndex + 1} / {images.length}<ChevronDown className="size-3" aria-hidden="true" /></span></small>
    </button>
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="editor-collection-sheet" onCloseAutoFocus={event => {
        event.preventDefault()
        requestAnimationFrame(() => trigger.current?.focus({ preventScroll: true }))
      }}>
        <SheetTitle>{demoMode ? 'Try another photo' : 'Your photos'}</SheetTitle>
        <SheetDescription>{images.length} photos · Edits stay with each photo</SheetDescription>
        <div className="editor-collection-grid" role="group" aria-label={demoMode ? 'Demo photos' : 'Your photos'}>
          {images.map((image, index) => <button key={image.id} type="button" className="editor-collection-photo"
            aria-label={`Select photo ${index + 1}: ${demoMode ? `Demo ${index + 1}` : image.fileName}`}
            aria-pressed={index === currentIndex} onClick={() => { onSelect(index); onOpenChange(false) }}>
            <span className="editor-collection-image"><CollectionThumbnail image={image} />{index === currentIndex && <Check className="editor-collection-check" aria-hidden="true" />}</span>
            <span>{demoMode ? `Demo ${index + 1}` : image.fileName}</span>
          </button>)}
        </div>
      </SheetContent>
    </Sheet>
  </>
}
