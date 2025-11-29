import { useMemo } from 'react'
import { Shuffle, Heart } from 'lucide-react'
import { Button } from './ui/button'
import { Recipe } from '../engine/types'
import { RecipeCard } from './RecipeCard'
import { getAllRecipes, getRecipesGroupedBySimulation, RECIPES } from '../presets/recipes'

interface RecipePanelProps {
  sourceImage: ImageData
  activeRecipeId: string | null
  favoriteIds: string[]
  onRecipeSelect: (recipe: Recipe) => void
  onRandomRecipe: () => void
  onFavoriteToggle: (recipeId: string) => void
}

export function RecipePanel({ 
  sourceImage, 
  activeRecipeId, 
  favoriteIds,
  onRecipeSelect, 
  onRandomRecipe,
  onFavoriteToggle
}: RecipePanelProps) {
  const recipes = getAllRecipes()
  const groupedRecipes = getRecipesGroupedBySimulation()
  
  // Create favorites set for quick lookup
  const favoritesSet = useMemo(() => new Set(favoriteIds), [favoriteIds])
  
  // Get favorite recipes
  const favoriteRecipes = useMemo(() => {
    return favoriteIds
      .map(id => RECIPES[id])
      .filter((recipe): recipe is Recipe => recipe !== undefined)
  }, [favoriteIds])

  return (
    <nav 
      className="h-full flex flex-col"
      aria-label="Панель рецептов"
    >
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white" id="recipes-heading">
            Рецепты
          </h2>
          <p className="text-xs text-zinc-500" aria-live="polite">
            {recipes.length} пресетов
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRandomRecipe}
          aria-label="Выбрать случайный рецепт"
          className="text-zinc-400 hover:text-white"
        >
          <Shuffle className="w-4 h-4" aria-hidden="true" />
        </Button>
      </div>
      
      {/* Scrollable content with sections */}
      <div 
        className="flex-1 overflow-y-auto px-3 pb-3"
        role="region"
        aria-labelledby="recipes-heading"
        tabIndex={0}
      >
        <div className="space-y-4">
          {/* Favorites section - always first */}
          <section aria-label="Избранные рецепты">
            {/* Section header */}
            <div className="flex items-center gap-2 mb-2 px-1">
              <Heart className="w-3 h-3 text-red-500 fill-red-500" aria-hidden="true" />
              <h3 
                className="text-xs font-medium text-zinc-400 uppercase tracking-wider"
                id="group-favorites"
              >
                Избранное
              </h3>
              <div className="flex-1 h-px bg-zinc-800" aria-hidden="true" />
              <span 
                className="text-[10px] text-zinc-600"
                aria-label={`${favoriteRecipes.length} рецептов`}
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
                  Нажмите на сердечко на карточке,<br />
                  чтобы добавить в избранное
                </p>
              </div>
            )}
          </section>

          {/* Other simulation groups */}
          {groupedRecipes.map((group) => (
            <section 
              key={group.simulationId}
              aria-label={`Рецепты ${group.simulationName}`}
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
                  aria-label={`${group.recipes.length} рецептов`}
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
          ))}
        </div>
      </div>
    </nav>
  )
}
