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
   * Check if a recipe is in favorites
   */
  const isFavorite = useCallback((recipeId: string): boolean => {
    return favorites.has(recipeId)
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
   * Add a recipe to favorites
   */
  const addFavorite = useCallback((recipeId: string) => {
    setFavorites(prev => new Set([...prev, recipeId]))
  }, [])

  /**
   * Remove a recipe from favorites
   */
  const removeFavorite = useCallback((recipeId: string) => {
    setFavorites(prev => {
      const next = new Set(prev)
      next.delete(recipeId)
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
    /** Set of favorite recipe IDs */
    favorites,
    /** Check if recipe is favorited */
    isFavorite,
    /** Toggle favorite status */
    toggleFavorite,
    /** Add to favorites */
    addFavorite,
    /** Remove from favorites */
    removeFavorite,
    /** Get array of favorite IDs */
    getFavoriteIds,
    /** Number of favorites */
    count: favorites.size,
  }
}

