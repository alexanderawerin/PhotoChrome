import { useMemo, useRef, useEffect, useLayoutEffect, useState, useCallback, useId } from 'react'
import { Shuffle, Heart, Film, Star, Sparkles } from 'lucide-react'
import { Button } from './ui/button'
import { Recipe } from '../engine/types'
import { RecipeCard } from './RecipeCard'
import { getAllRecipes, getRecipesGroupedBySimulation, getRecipesGroupedByUseCase, getEditorsChoiceRecipes, RECIPES } from '../presets/recipes'

type GroupingMode = 'film' | 'useCase'

interface RecipePanelProps {
  sourceImage: ImageData
  activeRecipeId: string | null
  favoriteIds: string[]
  onRecipeSelect: (recipe: Recipe) => void
  onRandomRecipe: () => void
  onFavoriteToggle: (recipeId: string) => void
  /** Horizontal mode for mobile - shows presets in a horizontal scroll */
  horizontal?: boolean
  /** Recipe IDs рекомендованные для текущего фото (Smart Picks) */
  smartPicksIds?: string[]
}

export function RecipePanel({
  sourceImage,
  activeRecipeId,
  favoriteIds,
  onRecipeSelect,
  onRandomRecipe,
  onFavoriteToggle,
  horizontal = false,
  smartPicksIds = []
}: RecipePanelProps) {
  const recipes = getAllRecipes()
  const [groupingMode] = useState<GroupingMode>('film')
  const groupedByFilm = useMemo(() => getRecipesGroupedBySimulation(), [])
  const groupedByUseCase = getRecipesGroupedByUseCase()
  
  // Create favorites set for quick lookup
  const favoritesSet = useMemo(() => new Set(favoriteIds), [favoriteIds])
  
  // Get favorite recipes
  const favoriteRecipes = useMemo(() => {
    return favoriteIds
      .map(id => RECIPES[id])
      .filter((recipe): recipe is Recipe => recipe !== undefined)
  }, [favoriteIds])

  const editorsChoiceRecipes = useMemo(() => getEditorsChoiceRecipes(), [])

  const smartPicksRecipes = useMemo(() => {
    return smartPicksIds
      .map(id => RECIPES[id])
      .filter((r): r is Recipe => r !== undefined)
  }, [smartPicksIds])

  const mobileGroups = useMemo(() => [
    { id: 'favorites', label: 'Favorites', recipes: favoriteRecipes },
    ...(smartPicksRecipes.length ? [{ id: 'smart-picks', label: 'Smart Picks', recipes: smartPicksRecipes }] : []),
    { id: 'editors-choice', label: "Editor's Choice", recipes: editorsChoiceRecipes },
    ...groupedByFilm.map(group => ({ id: group.simulationId, label: group.simulationName, recipes: group.recipes })),
  ], [favoriteRecipes, smartPicksRecipes, editorsChoiceRecipes, groupedByFilm])

  if (horizontal) {
    return (
      <MobileRecipePanel
        groups={mobileGroups}
        sourceImage={sourceImage}
        activeRecipeId={activeRecipeId}
        favoritesSet={favoritesSet}
        onRecipeSelect={onRecipeSelect}
        onRandomRecipe={onRandomRecipe}
        onFavoriteToggle={onFavoriteToggle}
      />
    )
  }

  // Vertical mode for desktop
  return (
    <nav 
      className="h-full flex flex-col"
      aria-label="Film presets panel"
    >
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white" id="recipes-heading">
              Films
            </h2>
            <p className="text-xs text-zinc-400" aria-live="polite">
              {recipes.length} presets
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onRandomRecipe}
            aria-label="Random preset"
            className="text-zinc-400 hover:text-white"
          >
            <Shuffle className="w-4 h-4" aria-hidden="true" />
          </Button>
        </div>
        
        <div className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-[10px] uppercase tracking-[0.18em] text-zinc-400">
          <Film className="size-3" aria-hidden="true" /> Film library
        </div>
      </div>
      
      {/* Scrollable content with sections */}
      <div
        className="flex-1 overflow-y-auto px-3 pb-3"
        role="region"
        aria-labelledby="recipes-heading"
      >
        <div className="space-y-4">
          {/* Favorites section - always first */}
          <section aria-label="Favorite presets">
            {/* Section header */}
            <div className="flex items-center gap-2 mb-2 px-1">
              <Heart className="w-3 h-3 text-white fill-white" aria-hidden="true" />
              <h3 
                className="text-xs font-medium text-zinc-400 uppercase tracking-wider"
                id="group-favorites"
              >
                Favorites
              </h3>
              <div className="flex-1 h-px bg-zinc-800" aria-hidden="true" />
              <span 
                className="text-[10px] text-zinc-400"
                aria-label={`${favoriteRecipes.length} presets`}
              >
                {favoriteRecipes.length}
              </span>
            </div>
            
            {favoriteRecipes.length > 0 ? (
              <div 
                className="grid grid-cols-1 gap-2"
                role="list"
                aria-labelledby="group-favorites"
              >
                {favoriteRecipes.map((recipe) => (
                  <div key={recipe.id} role="listitem">
                    <RecipeCard
                      recipe={recipe}
                      sourceImage={sourceImage}
                      isActive={activeRecipeId === recipe.id}
                      isFavorite={true}
                      onFavoriteToggle={onFavoriteToggle}
                      onClick={() => onRecipeSelect(recipe)}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 px-2">
                <Heart className="w-6 h-6 text-zinc-700 mx-auto mb-2" />
                <p className="text-xs text-zinc-400">
                  Click the heart on a card<br />
                  to add to favorites
                </p>
              </div>
            )}
          </section>

          {/* Smart Picks */}
          {smartPicksRecipes.length > 0 && (
            <section aria-label="Smart Picks">
              <div className="flex items-center gap-2 mb-2 px-1">
                <Sparkles className="w-3.5 h-3.5 text-zinc-400" aria-hidden="true" />
                <h3
                  className="text-xs font-medium text-zinc-400 uppercase tracking-wider"
                  id="group-smart-picks"
                >
                  Smart Picks
                </h3>
                <div className="flex-1 h-px bg-zinc-800" aria-hidden="true" />
                <span
                  className="text-[10px] text-zinc-400"
                  aria-label={`${smartPicksRecipes.length} presets`}
                >
                  {smartPicksRecipes.length}
                </span>
              </div>
              <div
                className="grid grid-cols-1 gap-2"
                role="list"
                aria-labelledby="group-smart-picks"
              >
                {smartPicksRecipes.map((recipe) => (
                  <div key={`sp-${recipe.id}`} role="listitem">
                    <RecipeCard
                      recipe={recipe}
                      sourceImage={sourceImage}
                      isActive={activeRecipeId === recipe.id}
                      isFavorite={favoritesSet.has(recipe.id)}
                      onFavoriteToggle={onFavoriteToggle}
                      onClick={() => onRecipeSelect(recipe)}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Editor's Choice */}
          {editorsChoiceRecipes.length > 0 && (
            <section aria-label="Editor's Choice presets">
              <div className="flex items-center gap-2 mb-2 px-1">
                <Star className="w-3.5 h-3.5 text-zinc-400" aria-hidden="true" />
                <h3
                  className="text-xs font-medium text-zinc-400 uppercase tracking-wider"
                  id="group-editors-choice"
                >
                  Editor's Choice
                </h3>
                <div className="flex-1 h-px bg-zinc-800" aria-hidden="true" />
                <span
                  className="text-[10px] text-zinc-400"
                  aria-label={`${editorsChoiceRecipes.length} presets`}
                >
                  {editorsChoiceRecipes.length}
                </span>
              </div>
              <div
                className="grid grid-cols-1 gap-2"
                role="list"
                aria-labelledby="group-editors-choice"
              >
                {editorsChoiceRecipes.map((recipe) => (
                  <div key={`ec-${recipe.id}`} role="listitem">
                    <RecipeCard
                      recipe={recipe}
                      sourceImage={sourceImage}
                      isActive={activeRecipeId === recipe.id}
                      isFavorite={favoritesSet.has(recipe.id)}
                      onFavoriteToggle={onFavoriteToggle}
                      onClick={() => onRecipeSelect(recipe)}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Groups - by film or use case */}
          {groupingMode === 'film' ? (
            groupedByFilm.map((group) => (
              <section 
                key={group.simulationId}
                aria-label={`${group.simulationName} presets`}
              >
                {/* Section header */}
                <div className="flex items-center gap-2 mb-2 px-1">
                  <h3 
                    className="text-xs font-medium text-zinc-400 uppercase tracking-wider"
                    id={`group-${group.simulationId}`}
                  >
                    {group.simulationName}
                  </h3>
                  <div className="flex-1 h-px bg-zinc-800" aria-hidden="true" />
                  <span 
                    className="text-[10px] text-zinc-400"
                    aria-label={`${group.recipes.length} presets`}
                  >
                    {group.recipes.length}
                  </span>
                </div>
                
                {/* Recipe grid */}
                <div 
                  className="grid grid-cols-1 gap-2"
                  role="list"
                  aria-labelledby={`group-${group.simulationId}`}
                >
                  {group.recipes.map((recipe) => (
                    <div key={recipe.id} role="listitem">
                      <RecipeCard
                        recipe={recipe}
                        sourceImage={sourceImage}
                        isActive={activeRecipeId === recipe.id}
                        isFavorite={favoritesSet.has(recipe.id)}
                        onFavoriteToggle={onFavoriteToggle}
                        onClick={() => onRecipeSelect(recipe)}
                      />
                    </div>
                  ))}
                </div>
              </section>
            ))
          ) : (
            groupedByUseCase.map((group) => (
              <section 
                key={group.useCaseId}
                aria-label={`${group.useCaseName} presets`}
              >
                {/* Section header */}
                <div className="flex items-center gap-2 mb-2 px-1">
                  <h3 
                    className="text-xs font-medium text-zinc-400 uppercase tracking-wider"
                    id={`group-${group.useCaseId}`}
                  >
                    {group.useCaseName}
                  </h3>
                  <div className="flex-1 h-px bg-zinc-800" aria-hidden="true" />
                  <span 
                    className="text-[10px] text-zinc-400"
                    aria-label={`${group.recipes.length} presets`}
                  >
                    {group.recipes.length}
                  </span>
                </div>
                
                {/* Recipe grid */}
                <div 
                  className="grid grid-cols-1 gap-2"
                  role="list"
                  aria-labelledby={`group-${group.useCaseId}`}
                >
                  {group.recipes.map((recipe) => (
                    <div key={recipe.id} role="listitem">
                      <RecipeCard
                        recipe={recipe}
                        sourceImage={sourceImage}
                        isActive={activeRecipeId === recipe.id}
                        isFavorite={favoritesSet.has(recipe.id)}
                        onFavoriteToggle={onFavoriteToggle}
                        onClick={() => onRecipeSelect(recipe)}
                      />
                    </div>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </nav>
  )
}

interface PresetGroup {
  id: string
  label: string
  recipes: Recipe[]
}

function MobileRecipePanel({
  groups,
  sourceImage,
  activeRecipeId,
  favoritesSet,
  onRecipeSelect,
  onRandomRecipe,
  onFavoriteToggle,
}: Omit<RecipePanelProps, 'favoriteIds'> & { groups: PresetGroup[]; favoritesSet: Set<string> }) {
  const id = useId()
  const carouselRef = useRef<HTMLDivElement>(null)
  const categoriesRef = useRef<HTMLDivElement>(null)
  const groupRefs = useRef(new Map<string, HTMLDivElement>())
  const categoryRefs = useRef(new Map<string, HTMLButtonElement>())
  const itemRefs = useRef(new Map<string, HTMLDivElement>())
  const anchorRef = useRef<{ key: string; offset: number } | null>(null)
  const layoutKey = groups
    .map(group => `${group.id}:${group.recipes.map(recipe => recipe.id).join(',')}`)
    .join('|')
  const layoutKeyRef = useRef(layoutKey)
  const lastSyncedScrollLeftRef = useRef<number | null>(null)
  const [activeGroup, setActiveGroup] = useState('favorites')

  const syncScroll = useCallback(() => {
    const carousel = carouselRef.current
    if (!carousel || carousel.clientWidth === 0) return
    const scrollLeft = carousel.scrollLeft
    lastSyncedScrollLeftRef.current = scrollLeft
    let current = groups[0].id
    for (const group of groups) {
      const element = groupRefs.current.get(group.id)
      // Center of the leading 96px card, including the 12px carousel inset.
      if (element && element.offsetLeft <= scrollLeft + 60) current = group.id
    }
    if (scrollLeft + carousel.clientWidth >= carousel.scrollWidth - 1) {
      current = groups[groups.length - 1].id
    }
    setActiveGroup(current)

    // Keep the first visible item anchored when Favorites or Smart Picks change.
    for (const [key, element] of itemRefs.current) {
      if (element.offsetLeft + element.offsetWidth > scrollLeft + 12) {
        anchorRef.current = { key, offset: element.offsetLeft - scrollLeft }
        break
      }
    }
  }, [groups])

  useLayoutEffect(() => {
    const carousel = carouselRef.current
    const anchor = anchorRef.current
    const item = anchor && itemRefs.current.get(anchor.key)
    const layoutChanged = layoutKeyRef.current !== layoutKey
    const hasPendingScroll = carousel
      && lastSyncedScrollLeftRef.current !== null
      && Math.abs(carousel.scrollLeft - lastSyncedScrollLeftRef.current) > 1
    layoutKeyRef.current = layoutKey
    if (layoutChanged && !hasPendingScroll && carousel && item && anchor) {
      carousel.scrollLeft = item.offsetLeft - anchor.offset
    }
    syncScroll()
  }, [layoutKey, syncScroll])

  useEffect(() => {
    const rail = categoriesRef.current
    const button = categoryRefs.current.get(activeGroup)
    if (!rail || !button) return
    const left = button.offsetLeft - 12
    const right = button.offsetLeft + button.offsetWidth + 12
    if (left < rail.scrollLeft) rail.scrollLeft = left
    else if (right > rail.scrollLeft + rail.clientWidth) rail.scrollLeft = right - rail.clientWidth
  }, [activeGroup])

  const jumpToGroup = (groupId: string) => {
    const carousel = carouselRef.current
    const group = groupRefs.current.get(groupId)
    if (!carousel || !group) return
    carousel.scrollLeft = groupId === 'favorites' ? 0 : group.offsetLeft - 12
    syncScroll()
  }

  return (
    <nav className="w-full border-t border-zinc-800 bg-black/80 backdrop-blur-sm" aria-label="Film presets">
      <div
        ref={categoriesRef}
        role="group"
        aria-label="Preset categories"
        className="relative flex h-11 gap-4 overflow-x-auto px-3 scrollbar-hide"
      >
        {groups.map(group => (
          <button
            key={group.id}
            ref={element => { if (element) categoryRefs.current.set(group.id, element); else categoryRefs.current.delete(group.id) }}
            type="button"
            onClick={() => jumpToGroup(group.id)}
            aria-current={activeGroup === group.id ? 'true' : undefined}
            aria-controls={`${id}-${group.id}`}
            className={`min-h-11 min-w-11 shrink-0 border-b-2 px-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white ${activeGroup === group.id ? 'border-white text-white' : 'border-transparent text-zinc-400 hover:text-white'}`}
          >
            {group.label}
          </button>
        ))}
      </div>
      <div
        ref={carouselRef}
        onScroll={syncScroll}
        role="region"
        aria-label="Preset carousel"
        className="relative flex gap-2 overflow-x-auto overscroll-x-contain px-3 pb-3 pt-2 scrollbar-hide [overflow-anchor:none]"
      >
        <div ref={element => { if (element) itemRefs.current.set('random', element); else itemRefs.current.delete('random') }} className="w-24 shrink-0">
          <button
            type="button"
            onClick={onRandomRecipe}
            className="flex h-full min-h-[104px] w-full flex-col items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/60 text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            aria-label="Random preset"
          >
            <Shuffle className="size-5" aria-hidden="true" />
            <span className="text-xs font-medium">Random</span>
          </button>
        </div>
        {groups.map(group => (
          <div
            key={group.id}
            id={`${id}-${group.id}`}
            ref={element => { if (element) groupRefs.current.set(group.id, element); else groupRefs.current.delete(group.id) }}
            role="group"
            aria-label={`${group.label} presets`}
            className="flex shrink-0 gap-2"
          >
            {group.recipes.length ? group.recipes.map(recipe => (
              <div
                key={recipe.id}
                ref={element => {
                  const key = `${group.id}-${recipe.id}`
                  if (element) itemRefs.current.set(key, element)
                  else itemRefs.current.delete(key)
                }}
                className="w-24 shrink-0"
              >
                <RecipeCard
                  recipe={recipe}
                  sourceImage={sourceImage}
                  isActive={activeRecipeId === recipe.id}
                  isFavorite={favoritesSet.has(recipe.id)}
                  onFavoriteToggle={onFavoriteToggle}
                  onClick={() => onRecipeSelect(recipe)}
                  largeTouchTargets
                />
              </div>
            )) : (
              <div
                ref={element => { if (element) itemRefs.current.set('empty-favorites', element); else itemRefs.current.delete('empty-favorites') }}
                className="flex min-h-[104px] w-24 shrink-0 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-zinc-700 px-2 text-center text-zinc-400"
              >
                <Heart className="size-4" aria-hidden="true" />
                <p className="text-[10px] leading-tight">Tap a heart to<br />save a favorite</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </nav>
  )
}
