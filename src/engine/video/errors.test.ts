import { describe, expect, it, vi } from 'vitest'
import { closeCodecSafely } from './errors'

describe('closeCodecSafely', () => {
  it('does not close an encoder that is already closed', () => {
    const close = vi.fn()

    closeCodecSafely({ state: 'closed', close })

    expect(close).not.toHaveBeenCalled()
  })

  it('closes a configured encoder', () => {
    const close = vi.fn()

    closeCodecSafely({ state: 'configured', close })

    expect(close).toHaveBeenCalledOnce()
  })

  it('does not expose a close race that would replace the encoding error', () => {
    const codec = {
      state: 'configured',
      close: vi.fn(() => {
        codec.state = 'closed'
        throw new DOMException("Cannot call 'close' on a closed codec", 'InvalidStateError')
      }),
    }

    expect(() => closeCodecSafely(codec)).not.toThrow()
    expect(codec.state).toBe('closed')
  })
})
