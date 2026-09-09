import { useState, useEffect, useCallback } from 'react'

const FAVORITES_STORAGE_KEY = 'photochrome_favorites'

/**
 * Hook for managing favorite recipes with localStorage persistence.
 */
export function useFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    // Initialize from localStorage
    try {
      const stored = localStorage.getItem(FAVORITES_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          return new Set(parsed)
        }
      }
    } catch (err) {
      console.error('Failed to load favorites from localStorage:', err)
    }
    return new Set()
  })

  // Persist to localStorage when favorites change
  useEffect(() => {
    try {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify([...favorites]))
    } catch (err) {
      console.error('Failed to save favorites to localStorage:', err)
    }
  }, [favorites])

  /**
   * Toggle favorite status for a recipe
   */
  const toggleFavorite = useCallback((recipeId: string) => {
    setFavorites(prev => {
      const next = new Set(prev)
      if (next.has(recipeId)) {
        next.delete(recipeId)
      } else {
        next.add(recipeId)
      }
      return next
    })
  }, [])

  /**
   * Get array of favorite recipe IDs
   */
  const getFavoriteIds = useCallback((): string[] => {
    return [...favorites]
  }, [favorites])

  return {
    toggleFavorite,
    getFavoriteIds,
  }
}
