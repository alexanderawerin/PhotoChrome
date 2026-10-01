import type {
  FilmSimulation,
  ProcessingPlan,
  ProcessingTargetSize,
  Recipe,
  RecipeSettings,
} from './types'
import type { HaldCLUT } from './haldclut'
import { getCachedLUT, getSimulation, loadSimulationLUT } from '../presets/simulations'

export function assertProcessingResourcesReady(plan: ProcessingPlan): void {
  if (plan.colorMode === 'original') return
  if (plan.simulation.lutImage && !plan.lut) {
    throw new Error(`Required film resource for ${plan.simulation.name} is not ready. Retry to load this film.`)
  }
}

function abortError(): DOMException {
  return new DOMException('Film preparation was cancelled', 'AbortError')
}

/** Snapshot the intended profile before waiting; cancellation releases this
 * consumer without cancelling a shared LUT request needed by another preview. */
export async function prepareProcessingPlan(
  recipe: Recipe | null,
  targetSize: ProcessingTargetSize,
  settingsOverride: RecipeSettings = {},
  options: { signal?: AbortSignal } = {}
): Promise<ProcessingPlan> {
  if (options.signal?.aborted) throw abortError()
  if (!recipe) return createOriginalProcessingPlan(targetSize)
  const simulation = getSimulation(recipe.filmSimulation)
  if (!simulation) throw new Error(`Simulation ${recipe.filmSimulation} was not found`)
  const plan = createProcessingPlanFromSimulation({
    recipe: { id: recipe.id, name: recipe.name, simulationId: recipe.filmSimulation },
    simulation,
    settings: { ...recipe.settings, ...settingsOverride },
    targetSize,
  })
  return prepareProcessingPlanResources(plan, options)
}

/** Prepare an existing export snapshot without re-reading live editor state. */
export async function prepareProcessingPlanResources(
  input: ProcessingPlan,
  options: { signal?: AbortSignal } = {}
): Promise<ProcessingPlan> {
  if (options.signal?.aborted) throw abortError()
  const plan = { ...input, simulation: structuredClone(input.simulation), recipe: { ...input.recipe }, settings: { ...input.settings }, targetSize: { ...input.targetSize } }
  if (plan.colorMode === 'original') return plan
  if (plan.lut || !plan.simulation.lutImage) {
    assertProcessingResourcesReady(plan)
    return plan
  }
  const resource = loadSimulationLUT(plan.simulation.id)
  if (options.signal) {
    const signal = options.signal
    plan.lut = await new Promise<HaldCLUT | null>((resolve, reject) => {
      const onAbort = () => reject(abortError())
      signal.addEventListener('abort', onAbort, { once: true })
      resource.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort))
    })
  } else {
    plan.lut = await resource
  }
  if (options.signal?.aborted) throw abortError()
  assertProcessingResourcesReady(plan)
  return plan
}

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
  recipe: Recipe | null,
  targetSize: ProcessingTargetSize,
  settingsOverride: RecipeSettings = {}
): ProcessingPlan {
  if (!recipe) return createOriginalProcessingPlan(targetSize)
  const simulation = getSimulation(recipe.filmSimulation)
  if (!simulation) throw new Error(`Simulation ${recipe.filmSimulation} was not found`)

  const plan = createProcessingPlanFromSimulation({
    recipe: { id: recipe.id, name: recipe.name, simulationId: recipe.filmSimulation },
    simulation,
    settings: { ...recipe.settings, ...settingsOverride },
    lut: getCachedLUT(simulation.id),
    targetSize,
  })
  assertProcessingResourcesReady(plan)
  return plan
}

/** Original has explicit pass-through intent and requires no film resource. */
export function createOriginalProcessingPlan(targetSize: ProcessingTargetSize): ProcessingPlan {
  validateTargetSize(targetSize)
  return {
    version: 1,
    colorMode: 'original',
    recipe: { id: 'original', name: 'Original', simulationId: 'original' },
    simulation: { id: 'original', name: 'Original' },
    settings: {},
    lut: null,
    targetSize: { width: targetSize.width, height: targetSize.height },
  }
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
