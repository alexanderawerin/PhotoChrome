import type {
  FilmSimulation,
  ProcessingPlan,
  ProcessingTargetSize,
  Recipe,
  RecipeSettings,
} from './types'
import type { HaldCLUT } from './haldclut'
import { getCachedLUT, getSimulation } from '../presets/simulations'

function validateTargetSize(targetSize: ProcessingTargetSize): void {
  if (
    !Number.isInteger(targetSize.width) ||
    !Number.isInteger(targetSize.height) ||
    targetSize.width <= 0 ||
    targetSize.height <= 0
  ) {
    throw new Error('Processing target size must contain positive integer dimensions')
  }
}

export function createProcessingPlan(
  recipe: Recipe,
  targetSize: ProcessingTargetSize,
  settingsOverride: RecipeSettings = {}
): ProcessingPlan {
  const simulation = getSimulation(recipe.filmSimulation)
  if (!simulation) throw new Error(`Simulation ${recipe.filmSimulation} was not found`)

  return createProcessingPlanFromSimulation({
    recipe: { id: recipe.id, name: recipe.name, simulationId: recipe.filmSimulation },
    simulation,
    settings: { ...recipe.settings, ...settingsOverride },
    lut: getCachedLUT(simulation.id),
    targetSize,
  })
}

/** Low-level factory for engine tests and non-catalog processing clients. */
export function createProcessingPlanFromSimulation(input: {
  recipe: ProcessingPlan['recipe']
  simulation: FilmSimulation
  settings?: RecipeSettings
  lut?: HaldCLUT | null
  targetSize: ProcessingTargetSize
}): ProcessingPlan {
  validateTargetSize(input.targetSize)
  if (input.recipe.simulationId !== input.simulation.id) {
    throw new Error('Recipe and simulation IDs do not match')
  }

  return {
    version: 1,
    recipe: { ...input.recipe },
    simulation: structuredClone(input.simulation),
    settings: { ...input.settings },
    lut: input.lut ?? null,
    targetSize: {
      width: input.targetSize.width,
      height: input.targetSize.height,
    },
  }
}

export function assertProcessingTarget(
  plan: ProcessingPlan,
  width: number,
  height: number
): void {
  if (plan.targetSize.width !== width || plan.targetSize.height !== height) {
    throw new Error(
      `Processing target ${plan.targetSize.width}×${plan.targetSize.height} does not match input ${width}×${height}`
    )
  }
}
