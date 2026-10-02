import { useEffect, useRef, type ComponentProps, type ReactNode, type Ref } from 'react'
import { Blend, ChevronLeft, ChevronRight, Columns2, Crop, MoreHorizontal, Plus, SlidersHorizontal, Upload } from 'lucide-react'
import { Button } from './ui/button'
import { CropPanel } from './CropPanel'
import { Spinner } from './ui/spinner'

export type EditorMode = 'films' | 'advanced' | 'crop'

export interface EditorAction {
  id: string
  label: string
  ariaLabel?: string
  onClick: () => void
  disabled?: boolean
  busy?: boolean
  variant?: ComponentProps<typeof Button>['variant']
  desktopOnly?: boolean
  buttonRef?: Ref<HTMLButtonElement>
}

/** One header DOM for both layouts; media owners supply their permitted actions. */
export function EditorHeader({ fileName, details, leading, trailing, compact = false, navigation, files }: {
  fileName: string
  details?: string
  leading?: ReactNode
  trailing?: ReactNode
  compact?: boolean
  navigation?: { previous?: () => void; next?: () => void; disabled: boolean }
  files?: ReactNode
}) {
  return (
    <header className="editor-header-content mobile-editor-header-content shrink-0 px-3 py-2">
      <div className="editor-header-row" data-compact={compact || undefined}>
        <div className="editor-header-leading"><span className="editor-brand">PhotoChrome</span>{leading}</div>
        <div className="editor-file-navigation">
          {navigation && <Button variant="ghost" onClick={navigation.previous} disabled={navigation.disabled || !navigation.previous}
            className="editor-control editor-file-arrow" aria-label="Previous image"><ChevronLeft className="size-5" aria-hidden="true" /></Button>}
        <div className="mobile-editor-file min-w-0 text-center">
          {files ? <EditorOverflow label="Choose image" trigger={<>
            <p className="truncate text-sm font-medium text-white">{fileName}</p>
            {details && <p className="mt-1 text-[11px] text-zinc-400">{details}</p>}
          </>}>{files}</EditorOverflow> : <>
          <p className="truncate text-sm font-medium text-white">{fileName}</p>
          {details && <p className="mt-1 text-[11px] text-zinc-400">{details}</p>}
          </>}
        </div>
          {navigation && <Button variant="ghost" onClick={navigation.next} disabled={navigation.disabled || !navigation.next}
            className="editor-control editor-file-arrow" aria-label="Next image"><ChevronRight className="size-5" aria-hidden="true" /></Button>}
        </div>
        <div className="editor-header-trailing">{trailing}</div>
      </div>
    </header>
  )
}

export function EditorModes({ mode, onChange, disabled, demoMode = false, advancedOpen = false }: {
  mode: EditorMode
  onChange: (mode: EditorMode) => void
  disabled: Record<EditorMode, boolean>
  demoMode?: boolean
  advancedOpen?: boolean
}) {
  const choices: EditorMode[] = demoMode ? ['films'] : ['films', 'advanced', 'crop']
  return (
    <nav className={`mobile-editor-modes grid min-h-12 shrink-0 ${demoMode ? 'grid-cols-1' : 'grid-cols-3'}`} aria-label="Editor modes">
      {choices.map(value => (
        <button key={value} type="button" onClick={() => onChange(value)} disabled={disabled[value]}
          aria-current={mode === value ? 'page' : undefined}
          aria-label={value === 'advanced' ? advancedOpen ? 'Close Advanced settings' : 'Open Advanced settings' : undefined}
          aria-expanded={value === 'advanced' ? advancedOpen : undefined}
          className={`flex min-h-11 min-w-0 items-center justify-center gap-2 rounded-full px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-40 ${mode === value ? 'text-white' : 'text-zinc-400'}`}>
          {value === 'films' ? <Blend className="size-5 shrink-0" aria-hidden="true" /> : value === 'advanced' ? <SlidersHorizontal className="size-5 shrink-0" aria-hidden="true" /> : <Crop className="size-5 shrink-0" aria-hidden="true" />}
          <span className="min-w-0 break-words">{value === 'films' ? 'Films' : value === 'advanced' ? 'Advanced' : 'Crop'}</span>
        </button>
      ))}
    </nav>
  )
}

function EditorOverflow({ children, label = 'More editor actions', trigger }: { children: ReactNode; label?: string; trigger?: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (ref.current?.open && event.target instanceof Node && !ref.current.contains(event.target)) ref.current.open = false
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [])
  return (
    <details ref={ref} className="editor-overflow" onKeyDown={event => {
      if (event.key === 'Escape' && ref.current?.open) {
        event.stopPropagation()
        ref.current.open = false
        ref.current.querySelector('summary')?.focus()
      }
    }}>
      <summary className="editor-control" role="button" aria-label={label}>{trigger ?? <MoreHorizontal className="size-5" aria-hidden="true" />}</summary>
      <div className="editor-overflow-panel" role="group" aria-label={label} onClickCapture={event => {
        const button = event.target instanceof Element ? event.target.closest('button') : null
        if (button && !button.disabled && ref.current) {
          ref.current.open = false
          ref.current.querySelector('summary')?.focus({ preventScroll: true })
        }
      }}>{children}</div>
    </details>
  )
}

export function EditorActions({ actions, placement = 'dock', primaryId = 'export', extra }: {
  actions: EditorAction[]
  placement?: 'dock' | 'header'
  primaryId?: string
  extra?: ReactNode
}) {
  const renderAction = (action: EditorAction, primary = false) => (
    <Button key={action.id} ref={action.buttonRef} variant={primary ? 'default' : action.variant ?? 'default'} onClick={action.onClick}
      disabled={action.disabled} aria-label={action.ariaLabel} aria-busy={action.busy}
      className={`${primary ? 'editor-primary-action' : 'editor-secondary-action'} min-h-11 min-w-0 whitespace-normal ${action.desktopOnly ? 'hidden md:inline-flex' : ''}`}>
      {action.busy ? <Spinner className="size-4" /> : primary && (action.id === 'upload' ? <Plus className="size-4" aria-hidden="true" /> : <Upload className="size-4" aria-hidden="true" />)}
      <span>{action.label}</span>
    </Button>
  )
  if (placement === 'header') {
    const primary = actions.find(action => action.id === primaryId) ?? actions.find(action => action.id === 'upload')
    const secondary = actions.filter(action => action !== primary)
    const overflow = (extra || secondary.length > 0) && <EditorOverflow>{secondary.map(action => renderAction(action))}{extra}</EditorOverflow>
    if (!actions.length) return overflow || null
    return <div className="editor-header-actions" role="toolbar" aria-label="Editor actions"
      onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') event.stopPropagation() }}>
      {overflow}{primary && renderAction(primary, true)}
    </div>
  }
  if (!actions.length) return null
  return (
    <div className="mobile-editor-actions flex min-h-11 shrink-0 flex-wrap gap-2 p-3" role="toolbar" aria-label="Editor actions"
      onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') event.stopPropagation() }}>
      {actions.map(action => renderAction(action))}
    </div>
  )
}

/** A persistent host keeps an open Advanced tab/crop control mounted across resize. */
export function EditorControlDock({ children, mode, navigation, actions, contentRef, hideDesktop = false }: {
  children: ReactNode
  mode: EditorMode
  navigation: ReactNode
  actions: ReactNode
  contentRef?: Ref<HTMLDivElement>
  hideDesktop?: boolean
}) {
  return (
    <>
      <div className="editor-mode-row" data-desktop-hidden={hideDesktop || undefined}>{navigation}</div>
    <aside className="editor-control-dock mobile-editor-dock mobile-editor-surface relative z-20 min-w-0" aria-label="Editor controls" data-editor-mode={mode} data-desktop-hidden={hideDesktop || undefined}>
      <div ref={contentRef} className="editor-context-panel min-h-0" data-editor-mode={mode}>{children}</div>
      {actions}
    </aside>
    </>
  )
}

export function EditorCompare({ active, disabled, onStart, onEnd }: {
  active: boolean
  disabled: boolean
  onStart: () => void
  onEnd: () => void
}) {
  return <Button type="button" variant="ghost" className="editor-compare editor-control" disabled={disabled}
    aria-label="Hold to compare original" aria-pressed={active} title="Hold to compare with original"
    onPointerDown={event => {
      if (event.button !== 0) return
      event.currentTarget.setPointerCapture(event.pointerId)
      onStart()
    }}
    onPointerUp={onEnd} onPointerCancel={onEnd} onLostPointerCapture={onEnd} onBlur={onEnd}
    onKeyDown={event => {
      if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); onStart() }
    }}
    onKeyUp={event => {
      if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); onEnd() }
    }}>
    <Columns2 className="size-4" aria-hidden="true" /><span>Original</span>
  </Button>
}

export function CropTools({ onOpen, onRotate, onFlip, disabled = false }: {
  onOpen?: () => void
  onRotate: () => void
  onFlip: () => void
  disabled?: boolean
}) {
  return (
    <div className="editor-crop-tools flex min-h-28 items-center gap-2 p-3" role="group" aria-label="Crop tools">
      {onOpen && <Button variant="outline" onClick={onOpen} disabled={disabled} className="min-h-20 min-w-0 flex-1" aria-label="Open crop session">Crop</Button>}
      <Button variant="outline" onClick={onRotate} disabled={disabled} className="min-h-20 min-w-0 flex-1" aria-label="Rotate clockwise">Rotate</Button>
      <Button variant="outline" onClick={onFlip} disabled={disabled} className="min-h-20 min-w-0 flex-1" aria-label="Flip horizontal">Flip</Button>
    </div>
  )
}

export function CropSessionControls({ disabled, geometryDisabled, onRotate, onFlip, ...panel }: ComponentProps<typeof CropPanel> & {
  disabled?: boolean
  geometryDisabled?: boolean
  onRotate: () => void
  onFlip: () => void
}) {
  return (
    <section role="region" aria-label="Crop settings" className="editor-crop-session min-h-0">
      <CropTools onRotate={onRotate} onFlip={onFlip} disabled={geometryDisabled ?? disabled} />
      <fieldset disabled={disabled} className="min-w-0 border-0 p-0">
        <CropPanel {...panel} />
      </fieldset>
    </section>
  )
}
