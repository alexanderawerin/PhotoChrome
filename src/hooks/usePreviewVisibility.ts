import { useEffect, useState, type RefObject } from 'react'

/** IntersectionObserver includes clipping by scroll ancestors and CSS-hidden copies. */
export function observePreviewVisibility(target: Element, onChange: (visible: boolean) => void): () => void {
  let intersects = typeof IntersectionObserver === 'undefined'
  let active = true
  const update = () => { if (active) onChange(intersects && !document.hidden) }
  const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => {
    intersects = entries.some(entry => entry.target === target && entry.isIntersecting)
    update()
  })
  observer?.observe(target)
  document.addEventListener('visibilitychange', update)
  update()
  return () => {
    active = false
    observer?.disconnect()
    document.removeEventListener('visibilitychange', update)
  }
}

export function usePreviewVisibility<T extends Element>(ref: RefObject<T>): boolean {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (!ref.current) return
    return observePreviewVisibility(ref.current, setVisible)
  }, [ref])
  return visible
}
