import { useSyncExternalStore } from 'react'

const WIDE_DESKTOP_MEDIA = '(min-width: 1600px)'

/** Desktop layout with a permanently visible Adjust inspector. */
export function useIsWideDesktop(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      const query = window.matchMedia(WIDE_DESKTOP_MEDIA)
      query.addEventListener('change', onStoreChange)
      return () => query.removeEventListener('change', onStoreChange)
    },
    () => window.matchMedia(WIDE_DESKTOP_MEDIA).matches,
    () => false
  )
}
