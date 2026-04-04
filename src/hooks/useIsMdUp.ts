import { useSyncExternalStore } from 'react'
import { MD_BREAKPOINT_MEDIA } from '../constants/cropRatios'

/**
 * true при ширине viewport ≥ 768px (как Tailwind `md`), иначе false.
 * На SSR / до гидрации — false (mobile-first).
 */
export function useIsMdUp(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      const mq = window.matchMedia(MD_BREAKPOINT_MEDIA)
      mq.addEventListener('change', onStoreChange)
      return () => mq.removeEventListener('change', onStoreChange)
    },
    () => window.matchMedia(MD_BREAKPOINT_MEDIA).matches,
    () => false
  )
}
