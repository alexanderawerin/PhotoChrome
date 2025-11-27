import { Recipe } from '../engine/types'
import { RecipeCard } from './RecipeCard'
import { getAllRecipes } from '../presets/recipes'

interface RecipePanelProps {
  sourceImage: ImageData
  activeRecipeId: string | null
  onRecipeSelect: (recipe: Recipe) => void
}

export function RecipePanel({ sourceImage, activeRecipeId, onRecipeSelect }: RecipePanelProps) {
  const recipes = getAllRecipes()

  return (
    <div className="h-full overflow-y-auto p-4 space-y-4">
      <div className="space-y-2">
        <h2 className="text-lg font-semibold sticky top-0 bg-background py-2">Рецепты</h2>
        <div className="grid grid-cols-1 gap-4">
          {recipes.map((recipe) => (
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
    </div>
  )
}

