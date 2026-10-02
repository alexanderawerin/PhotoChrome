import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Circle } from 'lucide-react'
import type { Recipe } from '../engine/types'
import { getBaseFilms } from '../engine/film-profiles'
import { FilmThumbnail } from './FilmThumbnail'

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
  const [edges, setEdges] = useState({ previous: false, next: false })
  const activeId = activeRecipe?.filmSimulation ?? 'original'

  const updateEdges = useCallback(() => {
    const scroll = scrollRef.current
    if (!scroll) return
    const previous = scroll.scrollLeft > 1
    const next = scroll.scrollLeft + scroll.clientWidth < scroll.scrollWidth - 1
    setEdges(current => current.previous === previous && current.next === next ? current : { previous, next })
  }, [])

  useEffect(() => {
    const scroll = scrollRef.current
    if (!scroll) return
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(updateEdges)
    observer?.observe(scroll)
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
      <button type="button" className="film-scroll-button" aria-label="Previous films"
        disabled={disabled || !edges.previous} onClick={() => scrollFilms(-1)}>
        <ChevronLeft aria-hidden="true" />
      </button>
      <div ref={scrollRef} className="film-selector-scroll" onScroll={updateEdges}>
        {choices.map(profile => {
          const active = (profile?.filmSimulation ?? 'original') === activeId
          return (
            <button key={profile?.id ?? 'original'} type="button"
              aria-label={profile ? `Select film ${profile.name}` : 'Select Original'}
              aria-pressed={active} disabled={disabled} onClick={() => onSelect(profile)}
              className="film-option">
              {active && <Circle className="film-selected-marker" aria-hidden="true" fill="currentColor" />}
              <FilmThumbnail sourceImage={sourceImage} recipe={profile} retryKey={retryKey} />
              <span className="film-label">{profile?.name ?? 'Original'}</span>
            </button>
          )
        })}
      </div>
      <button type="button" className="film-scroll-button" aria-label="Next films"
        disabled={disabled || !edges.next} onClick={() => scrollFilms(1)}>
        <ChevronRight aria-hidden="true" />
      </button>
    </div>
  )
}
