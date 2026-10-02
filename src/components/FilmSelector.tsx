import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Recipe } from '../engine/types'
import { getBaseFilms } from '../engine/film-profiles'
import { FilmOption } from './FilmOption'

interface FilmSelectorProps {
  sourceImage: ImageData
  activeRecipe: Recipe | null
  onSelect: (profile: Recipe | null) => void
  disabled: boolean
  retryKey?: number
  className?: string
}

// Stable profiles keep selecting and focusing films independent of preview work.
const choices = [null, ...getBaseFilms()]
const scrollBehavior = (): ScrollBehavior => window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'

export function FilmSelector({ sourceImage, activeRecipe, onSelect, disabled, retryKey = 0, className = '' }: FilmSelectorProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ overflow: false, previous: false, next: false })
  const activeId = activeRecipe?.filmSimulation ?? 'original'

  const updateEdges = useCallback(() => {
    const scroll = scrollRef.current
    if (!scroll) return
    const group = scroll.parentElement!
    const style = getComputedStyle(group)
    // Measure capacity without arrows, so removing them cannot make the strip oscillate.
    const capacity = group.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
    const overflow = scroll.scrollWidth > capacity + 1
    const previous = scroll.scrollLeft > 1
    const next = scroll.scrollLeft + scroll.clientWidth < scroll.scrollWidth - 1
    setEdges(current => current.overflow === overflow && current.previous === previous && current.next === next ? current : { overflow, previous, next })
  }, [])

  useEffect(() => {
    const scroll = scrollRef.current
    if (!scroll) return
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateEdges)
    observer?.observe(scroll)
    if (scroll.parentElement) observer?.observe(scroll.parentElement)
    for (const option of scroll.children) observer?.observe(option)
    updateEdges()
    return () => observer?.disconnect()
  }, [updateEdges])

  useEffect(() => {
    const scroll = scrollRef.current
    const selected = scroll?.querySelector<HTMLButtonElement>('[aria-pressed="true"]')
    if (!scroll || !selected) return
    const containerBounds = scroll.getBoundingClientRect()
    const bounds = selected.getBoundingClientRect()
    // Scroll this strip only: Element.scrollIntoView can also move the editor/body.
    if (bounds.left < containerBounds.left || bounds.right > containerBounds.right) {
      const offset = bounds.left - containerBounds.left - (scroll.clientWidth - bounds.width) / 2
      scroll.scrollTo({ left: scroll.scrollLeft + offset, behavior: scrollBehavior() })
    }
  }, [activeId])

  const scrollFilms = (direction: number) => {
    const scroll = scrollRef.current
    scroll?.scrollBy({ left: direction * scroll.clientWidth * 0.75, behavior: scrollBehavior() })
  }

  return (
    <div role="group" aria-label="Film selection" className={`editor-film-selector ${className}`}>
      {edges.overflow && <button type="button" className="film-scroll-button" aria-label="Previous films"
        disabled={disabled || !edges.previous} onClick={() => scrollFilms(-1)}>
        <ChevronLeft aria-hidden="true" />
      </button>}
      <div ref={scrollRef} className="film-selector-scroll" onScroll={updateEdges}>
        {choices.map(profile => {
          const active = (profile?.filmSimulation ?? 'original') === activeId
          return (
            <FilmOption key={profile?.id ?? 'original'} recipe={profile} sourceImage={sourceImage} retryKey={retryKey}
              ariaLabel={profile ? `Select film ${profile.name}` : 'Select Original'}
              active={active} disabled={disabled} onSelect={() => onSelect(profile)} />
          )
        })}
      </div>
      {edges.overflow && <button type="button" className="film-scroll-button" aria-label="Next films"
        disabled={disabled || !edges.next} onClick={() => scrollFilms(1)}>
        <ChevronRight aria-hidden="true" />
      </button>}
    </div>
  )
}
