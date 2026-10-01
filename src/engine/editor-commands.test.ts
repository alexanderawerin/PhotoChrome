import { describe, expect, it } from 'vitest'
import { editorCommands } from './editor-commands'

describe('editor command availability', () => {
  it('keeps the playable demo limited to color, comparison and Add', () => {
    const commands = editorCommands({ demo: true, hasColor: true, multiplePhotos: true })
    expect(commands.selectColor && commands.compare && commands.add).toBe(true)
    expect(commands.geometry || commands.advanced || commands.export || commands.applyToAll).toBe(false)
  })

  it.each(['loading', 'modal', 'exporting', 'applying'] as const)('%s prevents background editing commands', flag => {
    const commands = editorCommands({ [flag]: true, hasColor: true, multiplePhotos: true })
    expect(Object.values(commands).some(Boolean)).toBe(false)
  })

  it('a draft allows Apply/Cancel but cannot export or copy its unfinished edits', () => {
    const commands = editorCommands({ session: 'tuning', hasColor: true, multiplePhotos: true })
    expect(commands.editDraft).toBe(true)
    expect(commands.export || commands.applyToAll || commands.geometry || commands.compare).toBe(false)
  })

  it('a pending film can be replaced without exporting an unready result', () => {
    const commands = editorCommands({ processing: true, hasColor: true })
    expect(commands.selectColor).toBe(true)
    expect(commands.export || commands.compare).toBe(false)
  })
})
