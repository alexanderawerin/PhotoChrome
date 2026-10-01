import { afterEach, describe, expect, it, vi } from 'vitest'
import { observePreviewVisibility } from './usePreviewVisibility'

afterEach(() => vi.unstubAllGlobals())

describe('preview visibility ownership', () => {
  it('runs only intersecting previews in visible documents and ignores late observer callbacks after cleanup', () => {
    const target = {} as Element
    let notify: (entries: { target: Element; isIntersecting: boolean }[]) => void = () => {}
    const observe = vi.fn()
    const disconnect = vi.fn()
    class Observer {
      constructor(callback: typeof notify) { notify = callback }
      observe = observe
      disconnect = disconnect
    }
    const document = { hidden: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }
    vi.stubGlobal('IntersectionObserver', Observer)
    vi.stubGlobal('document', document)
    const changed = vi.fn()
    const cleanup = observePreviewVisibility(target, changed)
    expect(observe).toHaveBeenCalledWith(target)
    expect(changed).toHaveBeenLastCalledWith(false)
    notify([{ target, isIntersecting: true }])
    expect(changed).toHaveBeenLastCalledWith(true)
    document.hidden = true
    const onVisibilityChange = document.addEventListener.mock.calls[0][1]
    onVisibilityChange()
    expect(changed).toHaveBeenLastCalledWith(false)
    document.hidden = false
    onVisibilityChange()
    expect(changed).toHaveBeenLastCalledWith(true)
    notify([{ target, isIntersecting: false }])
    expect(changed).toHaveBeenLastCalledWith(false)
    cleanup()
    expect(disconnect).toHaveBeenCalledOnce()
    expect(document.removeEventListener).toHaveBeenCalledWith('visibilitychange', onVisibilityChange)
    const count = changed.mock.calls.length
    notify([{ target, isIntersecting: true }])
    onVisibilityChange()
    expect(changed).toHaveBeenCalledTimes(count)
  })

  it('keeps previews usable when IntersectionObserver is unavailable', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    vi.stubGlobal('document', { hidden: false, addEventListener() {}, removeEventListener() {} })
    const changed = vi.fn()
    const cleanup = observePreviewVisibility({} as Element, changed)
    expect(changed).toHaveBeenCalledWith(true)
    cleanup()
  })
})
