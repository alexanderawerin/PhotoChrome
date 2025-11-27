import { Shuffle } from 'lucide-react'
import { Button } from './ui/button'
import { Recipe } from '../engine/types'
import { RecipeCard } from './RecipeCard'
import { getAllRecipes, getRecipesGroupedBySimulation } from '../presets/recipes'

interface RecipePanelProps {
  sourceImage: ImageData
  activeRecipeId: string | null
  onRecipeSelect: (recipe: Recipe) => void
  onRandomRecipe: () => void
}

export function RecipePanel({ sourceImage, activeRecipeId, onRecipeSelect, onRandomRecipe }: RecipePanelProps) {
  const recipes = getAllRecipes()
  const groupedRecipes = getRecipesGroupedBySimulation()

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">Рецепты</h2>
          <p className="text-xs text-zinc-500">{recipes.length} пресетов</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRandomRecipe}
          title="Случайный рецепт"
          className="text-zinc-400 hover:text-white"
        >
          <Shuffle className="w-4 h-4" />
        </Button>
      </div>
      
      {/* Scrollable content with sections */}
      <div className="flex-1 overflow-y-auto px-3 pb-3">
        <div className="space-y-4">
          {groupedRecipes.map((group) => (
            <div key={group.simulationId}>
              {/* Section header */}
              <div className="flex items-center gap-2 mb-2 px-1">
                <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">
                  {group.simulationName}
                </h3>
                <div className="flex-1 h-px bg-zinc-800"></div>
                <span className="text-[10px] text-zinc-600">{group.recipes.length}</span>
              </div>
              
              {/* Recipe grid */}
              <div className="grid grid-cols-2 gap-2">
                {group.recipes.map((recipe) => (
                  <RecipeCard
                    key={recipe.id}
                    recipe={recipe}
                    sourceImage={sourceImage}
                    isActive={activeRecipeId === recipe.id}
                    onClick={() => onRecipeSelect(recipe)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
