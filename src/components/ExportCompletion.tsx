import { useEffect, useRef } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Check, ImageOff } from 'lucide-react'
import type { ExportPreview } from '../engine/photo-export'
import { Button } from './ui/button'

export interface ExportCompletionState {
  kind: 'single' | 'batch'
  exported: number
  skipped: number
  errors: number
  previews: ExportPreview[]
}

interface ExportCompletionProps {
  result: ExportCompletionState
  onClose: () => void
  onNewEdit: () => void
  onRestoreFocus: () => void
}

export function ExportCompletion({ result, onClose, onNewEdit, onRestoreFocus }: ExportCompletionProps) {
  const backButtonRef = useRef<HTMLButtonElement>(null)
  const { exported, skipped, errors, previews } = result
  const title = exported > 0 ? 'Export complete' : 'No photos exported'
  const StatusIcon = exported > 0 ? Check : ImageOff

  return (
    <Dialog.Root open onOpenChange={open => { if (!open) onClose() }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[210] bg-black/75 backdrop-blur-sm" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-[211] max-h-[calc(100svh-32px)] w-[calc(100%-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto overscroll-contain rounded-3xl border border-white/10 bg-zinc-950 p-5 shadow-2xl focus:outline-none sm:p-6"
          onOpenAutoFocus={event => {
            event.preventDefault()
            backButtonRef.current?.focus()
          }}
          onCloseAutoFocus={event => {
            event.preventDefault()
            onRestoreFocus()
          }}
          onPointerDownOutside={event => event.preventDefault()}
        >
          {previews.length > 0 && (
            <div
              className={`mb-6 grid h-[min(32svh,260px)] gap-2 overflow-hidden rounded-xl bg-white/[0.03] ${previews.length === 1 ? 'grid-cols-1' : 'grid-cols-2'} ${previews.length > 2 ? 'grid-rows-2' : 'grid-rows-1'}`}
              aria-label="Exported photos"
              role="group"
            >
              {previews.map((preview, index) => (
                <CompletionThumbnail key={preview.fileName} preview={preview} spanRows={previews.length === 3 && index === 0} />
              ))}
            </div>
          )}
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80" aria-hidden="true">
              <StatusIcon className="size-5" />
            </div>
            <Dialog.Title className="text-xl font-semibold tracking-tight text-white">{title}</Dialog.Title>
          </div>
          <Dialog.Description className="mt-3 text-sm leading-6 text-zinc-300">
            {result.kind === 'single'
              ? '1 photo exported'
              : `${exported} exported${skipped ? ` · ${skipped} skipped` : ''}${errors ? ` · ${errors} ${errors === 1 ? 'error' : 'errors'}` : ''}`}
          </Dialog.Description>
          {exported === 0 && (
            <p className="mt-1 text-sm leading-6 text-zinc-400">Return to the editor to try again.</p>
          )}
          {(skipped > 0 || errors > 0) && (
            <p className="mt-1 text-sm leading-6 text-zinc-400">See export-report.txt in the archive for details.</p>
          )}
          {previews.length > 0 && exported > previews.length && (
            <p className="mt-1 text-xs leading-5 text-zinc-400">Showing {previews.length} of {exported} exported photos</p>
          )}
          <div className="mt-6 grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={onNewEdit} className="min-h-11 h-auto whitespace-normal px-3 py-2">New edit</Button>
            <Button ref={backButtonRef} onClick={onClose} className="min-h-11 h-auto whitespace-normal px-3 py-2">Back to editor</Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function CompletionThumbnail({ preview, spanRows }: { preview: ExportPreview; spanRows: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    canvas.width = preview.imageData.width
    canvas.height = preview.imageData.height
    canvas.getContext('2d')?.putImageData(preview.imageData, 0, 0)
  }, [preview.imageData])

  return (
    <canvas
      ref={ref}
      className={`size-full min-h-0 min-w-0 object-contain ${spanRows ? 'row-span-2' : ''}`}
      role="img"
      aria-label={`Exported photo: ${preview.fileName}`}
    />
  )
}
