export interface EditorCommandContext {
  demo?: boolean
  loading?: boolean
  processing?: boolean
  modal?: boolean
  exporting?: boolean
  applying?: boolean
  session?: 'crop' | 'tuning' | null
  hasColor?: boolean
  multiplePhotos?: boolean
}

/** Buttons and shortcuts use the same media/session availability rules. */
export function editorCommands(context: EditorCommandContext) {
  const available = !context.loading && !context.modal && !context.exporting && !context.applying
  const editing = available && !context.demo && !context.processing
  const resolved = editing && !context.session
  return {
    selectColor: available,
    navigate: available,
    geometry: resolved,
    cropGeometry: editing && context.session === 'crop',
    advanced: editing && !!context.hasColor && (!context.session || context.session === 'tuning'),
    compare: available && !context.processing && !context.session && !!context.hasColor,
    export: resolved,
    applyToAll: resolved && !!context.multiplePhotos,
    editDraft: editing && !!context.session,
    cancelDraft: available && !context.demo && !!context.session,
    panel: available && !context.session,
    add: available && !context.session,
    help: available && !context.session,
  }
}

export type EditorCommands = ReturnType<typeof editorCommands>
