import type { ComponentProps, ReactNode, Ref } from 'react'
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
export function EditorHeader({ fileName, details, leading, trailing, compact = false }: {
  fileName: string
  details?: string
  leading?: ReactNode
  trailing?: ReactNode
  compact?: boolean
}) {
  return (
    <header className="editor-header-content mobile-editor-header-content shrink-0 px-3 py-2">
      <div className={`editor-header-row min-h-11 items-center justify-between gap-2 ${compact ? 'hidden md:flex' : 'flex'}`}>
        <div className="editor-header-leading flex min-w-11 shrink-0 items-center gap-2">{leading}</div>
        <div className="mobile-editor-file min-w-0 flex-1 text-center">
          <p className="truncate text-sm font-medium text-white">{fileName}</p>
          {details && <p className="mt-1 text-[11px] text-zinc-400">{details}</p>}
        </div>
        <div className="editor-header-trailing flex shrink-0 items-center gap-2">{trailing}</div>
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
          className={`flex min-h-11 min-w-0 items-center justify-center rounded-lg px-1 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-40 ${mode === value ? 'text-white' : 'text-zinc-400'}`}>
          <span className="min-w-0 break-words">{value === 'films' ? 'Films' : value === 'advanced' ? 'Advanced' : 'Crop'}</span>
        </button>
      ))}
    </nav>
  )
}

export function EditorActions({ actions }: { actions: EditorAction[] }) {
  if (!actions.length) return null
  return (
    <div className="mobile-editor-actions flex min-h-11 shrink-0 flex-wrap gap-2 p-3" role="toolbar" aria-label="Editor actions"
      onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') event.stopPropagation() }}>
        {actions.map(action => (
          <Button key={action.id} ref={action.buttonRef} variant={action.variant ?? 'default'} onClick={action.onClick}
            disabled={action.disabled} aria-label={action.ariaLabel} aria-busy={action.busy}
            className={`min-h-11 min-w-0 flex-1 whitespace-normal ${action.desktopOnly ? 'hidden md:inline-flex' : ''}`}>
            {action.busy && <Spinner className="size-4" />}{action.label}
          </Button>
        ))}
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
    <aside className="editor-control-dock mobile-editor-dock mobile-editor-surface relative z-20 min-w-0" aria-label="Editor controls" data-desktop-hidden={hideDesktop || undefined}>
      <div ref={contentRef} className="editor-context-panel min-h-0" data-editor-mode={mode}>{children}</div>
      {navigation}
      {actions}
    </aside>
  )
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
