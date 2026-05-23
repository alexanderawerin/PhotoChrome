import { useMemo, Fragment, useRef, useEffect, useState } from 'react'
import { Shuffle, Heart, Film, Layers, Star } from 'lucide-react'
import { Button } from './ui/button'
import { ButtonGroup } from './ui/button-group'
import { Recipe } from '../engine/types'
import { RecipeCard } from './RecipeCard'
import { getAllRecipes, getRecipesGroupedBySimulation, getRecipesGroupedByUseCase, getEditorsChoiceRecipes, RECIPES } from '../presets/recipes'

type GroupingMode = 'film' | 'useCase'

/** Width of a recipe card including gap (w-24 = 96px + gap-2 = 8px) */
const CARD_WIDTH_WITH_GAP = 104
/** Width of favorites header (w-20 = 80px + gap-2 = 8px) */
const HEADER_WIDTH_WITH_GAP = 88
/** Width of empty state (w-32 = 128px + gap) */
const EMPTY_STATE_WIDTH = 136

interface RecipePanelProps {
  sourceImage: ImageData
  activeRecipeId: string | null
  favoriteIds: string[]
  onRecipeSelect: (recipe: Recipe) => void
  onRandomRecipe: () => void
  onFavoriteToggle: (recipeId: string) => void
  /** Horizontal mode for mobile - shows presets in a horizontal scroll */
  horizontal?: boolean
  /** Total number of images (for multi-image mode) */
  totalImages?: number
  /** Apply current recipe to all images */
  onApplyToAll?: () => void
}

export function RecipePanel({
  sourceImage,
  activeRecipeId,
  favoriteIds,
  onRecipeSelect,
  onRandomRecipe,
  onFavoriteToggle,
  horizontal = false,
  totalImages = 1,
  onApplyToAll
}: RecipePanelProps) {
  const recipes = getAllRecipes()
  const [groupingMode, setGroupingMode] = useState<GroupingMode>('film')
  const groupedByFilm = getRecipesGroupedBySimulation()
  const groupedByUseCase = getRecipesGroupedByUseCase()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const prevFavoritesCountRef = useRef(favoriteIds.length)
  
  // Create favorites set for quick lookup
  const favoritesSet = useMemo(() => new Set(favoriteIds), [favoriteIds])
  
  // Get favorite recipes
  const favoriteRecipes = useMemo(() => {
    return favoriteIds
      .map(id => RECIPES[id])
      .filter((recipe): recipe is Recipe => recipe !== undefined)
  }, [favoriteIds])

  const editorsChoiceRecipes = useMemo(() => getEditorsChoiceRecipes(), [])

  // Compensate scroll position when favorites are added (horizontal mode only)
  useEffect(() => {
    if (!horizontal || !scrollContainerRef.current) return
    
    const prevCount = prevFavoritesCountRef.current
    const newCount = favoriteIds.length
    
    if (newCount > prevCount) {
      // Favorite added - scroll right to compensate
      const addedCount = newCount - prevCount
      
      let scrollAdjustment: number
      if (prevCount === 0) {
        // Going from empty state to having favorites
        // Before: empty state (128px)
        // After: header (80px) + gap (8px) + card (96px) = 184px
        // Difference: 184 - 128 = 56px
        scrollAdjustment = HEADER_WIDTH_WITH_GAP + CARD_WIDTH_WITH_GAP - EMPTY_STATE_WIDTH
      } else {
        // Just adding more favorites
        scrollAdjustment = CARD_WIDTH_WITH_GAP * addedCount
      }
      
      scrollContainerRef.current.scrollLeft += scrollAdjustment
    }
    
    prevFavoritesCountRef.current = newCount
  }, [favoriteIds.length, horizontal])

  // Horizontal mode for mobile - with favorites and sections
  if (horizontal) {
    return (
      <nav 
        className="w-full bg-black/80 backdrop-blur-sm border-t border-zinc-800"
        aria-label="Film presets"
      >
        <div 
          ref={scrollContainerRef}
          className="flex gap-2 p-3 overflow-x-auto scrollbar-hide"
          role="list"
        >
          {/* Favorites Section - header or empty state */}
          {favoriteRecipes.length > 0 ? (
            <>
              {/* Favorites header */}
              <div className="flex-shrink-0 flex items-center" role="listitem">
                <div className="w-20 h-full flex flex-col items-center justify-center px-2 py-3 rounded-xl bg-zinc-900/50 border border-zinc-800">
                  <Heart className="w-4 h-4 text-white fill-white mb-1" aria-hidden="true" />
                  <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">
                    Favorites
                  </span>
                  <span className="text-[10px] text-zinc-600 mt-0.5">
                    {favoriteRecipes.length}
                  </span>
                </div>
              </div>
              {/* Favorite recipes */}
              {favoriteRecipes.map((recipe) => (
                <div 
                  key={`fav-${recipe.id}`} 
                  role="listitem"
                  className="flex-shrink-0 w-24"
                >
                  <RecipeCard
                    recipe={recipe}
                    sourceImage={sourceImage}
                    isActive={activeRecipeId === recipe.id}
                    isFavorite={true}
                    onFavoriteToggle={onFavoriteToggle}
                    onClick={() => onRecipeSelect(recipe)}
                    largeTouchTargets
                  />
                </div>
              ))}
            </>
          ) : (
            /* Empty state - square */
            <div className="flex-shrink-0 w-32" role="listitem">
              <div className="w-32 h-32 rounded-lg bg-zinc-900/30 border border-dashed border-zinc-700 flex flex-col items-center justify-center p-2">
                <Heart className="w-5 h-5 text-zinc-600 mb-1.5" />
                <p className="text-[9px] text-zinc-500 text-center leading-tight">
                  Tap heart to<br />add favorite
                </p>
              </div>
            </div>
          )}

          {/* Apply to all card */}
          {totalImages > 1 && activeRecipeId && onApplyToAll && (
            <button
              onClick={onApplyToAll}
              className="flex-shrink-0 w-24"
              role="listitem"
              aria-label={`Apply current preset to all ${totalImages} images`}
            >
              <div className="w-24 h-32 rounded-lg bg-zinc-900/30 border-2 border-dashed border-zinc-600 hover:border-zinc-400 active:border-white flex flex-col items-center justify-center p-2 transition-colors">
                <Layers className="w-5 h-5 text-zinc-400 mb-1.5" />
                <p className="text-[9px] text-zinc-400 text-center leading-tight font-medium">
                  Apply to<br />all {totalImages}
                </p>
              </div>
            </button>
          )}

          {/* Section groups - by film or use case */}
          {groupingMode === 'film' ? (
            groupedByFilm.map((group) => (
              <Fragment key={group.simulationId}>
                {/* Section header card */}
                <div 
                  className="flex-shrink-0 flex items-center"
                  role="listitem"
                >
                  <div className="w-20 h-full flex flex-col items-center justify-center px-2 py-3 rounded-xl bg-zinc-900/50 border border-zinc-800">
                    <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider text-center leading-tight">
                      {group.simulationName}
                    </span>
                    <span className="text-[10px] text-zinc-600 mt-1">
                      {group.recipes.length}
                    </span>
                  </div>
                </div>
                
                {/* Section recipes */}
                {group.recipes.map((recipe) => (
                  <div 
                    key={recipe.id} 
                    role="listitem"
                    className="flex-shrink-0 w-24"
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
                ))}
              </Fragment>
            ))
          ) : (
            groupedByUseCase.map((group) => (
              <Fragment key={group.useCaseId}>
                {/* Section header card */}
                <div 
                  className="flex-shrink-0 flex items-center"
                  role="listitem"
                >
                  <div className="w-20 h-full flex flex-col items-center justify-center px-2 py-3 rounded-xl bg-zinc-900/50 border border-zinc-800">
                    <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider text-center leading-tight">
                      {group.useCaseName}
                    </span>
                    <span className="text-[10px] text-zinc-600 mt-1">
                      {group.recipes.length}
                    </span>
                  </div>
                </div>
                
                {/* Section recipes */}
                {group.recipes.map((recipe) => (
                  <div 
                    key={recipe.id} 
                    role="listitem"
                    className="flex-shrink-0 w-24"
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
                ))}
              </Fragment>
            ))
          )}
        </div>
      </nav>
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
            <p className="text-xs text-zinc-500" aria-live="polite">
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
        
        {/* Grouping toggle */}
        <ButtonGroup className="w-full" role="group" aria-label="Group presets by">
          <Button
            variant={groupingMode === 'film' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setGroupingMode('film')}
            className="flex-1 text-xs"
            aria-pressed={groupingMode === 'film'}
          >
            <Film className="w-3 h-3" aria-hidden="true" />
            Film
          </Button>
          <Button
            variant={groupingMode === 'useCase' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setGroupingMode('useCase')}
            className="flex-1 text-xs"
            aria-pressed={groupingMode === 'useCase'}
          >
            <Layers className="w-3 h-3" aria-hidden="true" />
            Use
          </Button>
        </ButtonGroup>
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
                className="text-[10px] text-zinc-600"
                aria-label={`${favoriteRecipes.length} presets`}
              >
                {favoriteRecipes.length}
              </span>
            </div>
            
            {favoriteRecipes.length > 0 ? (
              <div 
                className="grid grid-cols-2 gap-2"
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
                <p className="text-xs text-zinc-600">
                  Click the heart on a card<br />
                  to add to favorites
                </p>
              </div>
            )}
          </section>

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
                  className="text-[10px] text-zinc-600"
                  aria-label={`${editorsChoiceRecipes.length} presets`}
                >
                  {editorsChoiceRecipes.length}
                </span>
              </div>
              <div
                className="grid grid-cols-2 gap-2"
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
                    className="text-[10px] text-zinc-600"
                    aria-label={`${group.recipes.length} presets`}
                  >
                    {group.recipes.length}
                  </span>
                </div>
                
                {/* Recipe grid */}
                <div 
                  className="grid grid-cols-2 gap-2"
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
                    className="text-[10px] text-zinc-600"
                    aria-label={`${group.recipes.length} presets`}
                  >
                    {group.recipes.length}
                  </span>
                </div>
                
                {/* Recipe grid */}
                <div 
                  className="grid grid-cols-2 gap-2"
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
