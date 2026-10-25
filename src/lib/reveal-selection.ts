/** Reveal a choice without scrolling the editor or the document with it. */
export function revealSelection(strip: HTMLElement, selected: HTMLElement, animate = false): void {
  const bounds = strip.getBoundingClientRect()
  const item = selected.getBoundingClientRect()
  if (item.left >= bounds.left && item.right <= bounds.right) return
  strip.scrollTo({
    left: strip.scrollLeft + item.left - bounds.left - (strip.clientWidth - item.width) / 2,
    behavior: animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto',
  })
}
