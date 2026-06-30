import { describe, expect, it } from 'vitest'
import { createProcessingPlanFromSimulation } from './processing-plan'

describe('ProcessingPlan', () => {
  it('is structured-clone serializable and snapshots mutable inputs', () => {
    const settings = { color: 2 }
    const plan = createProcessingPlanFromSimulation({
      recipe: { id: 'test', name: 'Test', simulationId: 'test-simulation' },
      simulation: {
        id: 'test-simulation',
        name: 'Test simulation',
        curve: { points: [[0, 0], [1, 1]] },
      },
      settings,
      lut: {
        level: 2,
        gridSize: 4,
        width: 8,
        data: new Uint8ClampedArray([0, 1, 2, 3]),
      },
      targetSize: { width: 2, height: 2 },
    })

    settings.color = 4
    const clone = structuredClone(plan)

    expect(plan.settings.color).toBe(2)
    expect(clone).toEqual(plan)
    expect(clone).not.toBe(plan)
    expect(clone.lut?.data).toBeInstanceOf(Uint8ClampedArray)
  })

  it('rejects mismatched simulation IDs and invalid target sizes', () => {
    expect(() => createProcessingPlanFromSimulation({
      recipe: { id: 'test', name: 'Test', simulationId: 'other' },
      simulation: { id: 'simulation', name: 'Simulation', curve: { points: [[0, 0], [1, 1]] } },
      targetSize: { width: 0, height: 1 },
    })).toThrow()
  })

  it('copies dimensions exposed through prototype getters', () => {
    const targetSize = Object.create({ width: 3, height: 2 }) as { width: number; height: number }
    const plan = createProcessingPlanFromSimulation({
      recipe: { id: 'test', name: 'Test', simulationId: 'simulation' },
      simulation: { id: 'simulation', name: 'Simulation', curve: { points: [[0, 0], [1, 1]] } },
      targetSize,
    })

    expect(plan.targetSize).toEqual({ width: 3, height: 2 })
  })
})
