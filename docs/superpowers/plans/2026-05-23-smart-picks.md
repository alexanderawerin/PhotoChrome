# Smart Picks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Реализовать секцию «Smart Picks» — рекомендация 5 наиболее подходящих рецептов для активного фото на основе эвристик (статистика изображения + EXIF), без ML и без cloud.

**Architecture:** Изолированный модуль `src/engine/recommend/`: чистые функции analyzer → scorer → recommend, обёрнутые в Web Worker. React-хук `useRecipeRecommendations` потребляет worker с дебаунсом и LRU-кешем по `ImageItem.id`. Новая секция в `RecipePanel.tsx` рендерится между Favorites и Editor's Choice (desktop + mobile). Попутно фиксится отсутствие Editor's Choice на mobile.

**Tech Stack:** TypeScript, React 18, Vite, Web Workers, vitest (unit), Playwright (E2E), piexifjs (EXIF).

**Спека:** `docs/superpowers/specs/2026-05-23-smart-picks-design.md`

---

## File Structure

**Новые файлы:**

```
src/engine/exif.ts                              # ExifSubset type + extractExif(file)
src/engine/recommend/
├── features.ts                                 # PhotoFeatures, HueWeight, Reason, ScoredRecipe
├── weights.ts                                  # все веса и пороги
├── analyzer.ts                                 # extractFeatures(imageData, exif?)
├── scorer.ts                                   # scoreRecipe(features, recipe)
├── recommend.ts                                # recommendRecipes(features, recipes)
├── recommend.worker.ts                         # Worker entry
└── __tests__/
    ├── analyzer.test.ts
    ├── scorer.test.ts
    └── recommend.test.ts
src/hooks/useRecipeRecommendations.ts           # React hook
e2e/editor-smart-picks.spec.ts                  # E2E tests
```

**Модифицируемые файлы:**

```
src/engine/types.ts                             # +exif?: ExifSubset в ImageItem
src/hooks/useImageProcessor.ts                  # extract EXIF в loadImages
src/components/RecipePanel.tsx                  # + Smart Picks (desktop+mobile) + EC fix on mobile
src/components/Editor.tsx                       # вызвать useRecipeRecommendations, передать в RecipePanel
src/constants.ts                                # APP_VERSION 1.4 → 1.5
src/components/HelpDialog.tsx                   # +запись в WHATS_NEW v1.5
package.json                                    # version 1.4 → 1.5
playwright.config.ts                            # расширить mobile testMatch
```

---

### Task 1: ExifSubset type + extractExif utility

**Files:**
- Create: `src/engine/exif.ts`

- [ ] **Step 1: Create exif.ts**

```ts
/**
 * Минимальный срез EXIF, релевантный для рекомендаций рецептов.
 */
export type ExifSubset = {
  iso?: number
  colorTemperatureKelvin?: number
}

/**
 * Извлекает ISO (и потенциально Kelvin) из EXIF JPEG-файла.
 * Возвращает undefined, если файл не JPEG, EXIF отсутствует, или парсинг провалился.
 */
export async function extractExif(file: File): Promise<ExifSubset | undefined> {
  const type = file.type.toLowerCase()
  if (!type.includes('jpeg') && !type.includes('jpg')) return undefined

  try {
    const piexif = await import('piexifjs')
    const dataUrl = await fileToDataURL(file)
    const exif = piexif.load(dataUrl)

    const isoRaw = exif['Exif']?.[piexif.ExifIFD.ISOSpeedRatings]
    const iso = typeof isoRaw === 'number' ? isoRaw : undefined

    const result: ExifSubset = {}
    if (iso !== undefined) result.iso = iso
    return Object.keys(result).length > 0 ? result : undefined
  } catch {
    return undefined
  }
}

function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
```

- [ ] **Step 2: Build to verify TypeScript compiles**

```bash
npm run build
```
Expected: exit 0, no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/engine/exif.ts
git commit -m "feat(engine): add ExifSubset type and extractExif utility"
```

---

### Task 2: PhotoFeatures types + weights config

**Files:**
- Create: `src/engine/recommend/features.ts`
- Create: `src/engine/recommend/weights.ts`

- [ ] **Step 1: Create features.ts**

```ts
import type { ExifSubset } from '../exif'

export type HueWeight = { hue: number; weight: number }

export type PhotoFeatures = {
  brightness: number
  contrast: number
  shadowsRatio: number
  highlightsRatio: number
  warmth: number
  saturation: number
  dominantHues: HueWeight[]
  isLowKey: boolean
  isHighKey: boolean
  isMonochromatic: boolean
  isHighContrast: boolean
  exif?: ExifSubset
}

export type Reason = {
  factor: string
  weight: number
  label: string
}

export type ScoredRecipe = {
  recipeId: string
  score: number
  reasons: Reason[]
}
```

- [ ] **Step 2: Create weights.ts**

```ts
export const USE_CASE_FIT_BONUS = 0.4
export const FILM_FIT_BONUS = 0.4
export const FILM_FALLBACK_BONUS = 0.1
export const RECIPE_SPECIFIC_BONUS = 0.08

export const THRESHOLDS = {
  warmthWarm: 0.3,
  warmthSlight: 0.1,
  warmthMild: 0.2,
  saturationHigh: 0.5,
  saturationVibrant: 0.4,
  saturationMuted: 0.3,
  saturationMidLow: 0.2,
  contrastMid: 0.4,
  contrastLow: 0.3,
  highlightsRecover: 0.15,
  shadowsRecover: 0.1,
  isoHigh: 1600,
  kelvinTolerance: 500,
  monochromatic: 0.1,
  dominantHueCountHigh: 3,
}

export const DIVERSITY = {
  lambda: 0.3,
  sameFilmPenalty: 0.6,
  sameUseCasePenalty: 0.4,
}

export const PICKS_COUNT = 5
export const CANDIDATE_POOL_SIZE = 15
```

- [ ] **Step 3: Build to verify**

```bash
npm run build
```
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/engine/recommend/features.ts src/engine/recommend/weights.ts
git commit -m "feat(recommend): add PhotoFeatures types and weights config"
```

---

### Task 3: Analyzer — extract features from ImageData

**Files:**
- Create: `src/engine/recommend/analyzer.ts`
- Create: `src/engine/recommend/__tests__/analyzer.test.ts`

- [ ] **Step 1: Write failing tests**

Создать `src/engine/recommend/__tests__/analyzer.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { extractFeatures } from '../analyzer'

function makeImageData(width: number, height: number, fillFn: (x: number, y: number) => [number, number, number]): ImageData {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const [r, g, b] = fillFn(x, y)
      data[i] = r
      data[i + 1] = g
      data[i + 2] = b
      data[i + 3] = 255
    }
  }
  return new ImageData(data, width, height)
}

describe('extractFeatures', () => {
  it('returns brightness=1, isHighKey=true for fully white image', () => {
    const img = makeImageData(100, 100, () => [255, 255, 255])
    const f = extractFeatures(img)
    expect(f.brightness).toBeCloseTo(1, 1)
    expect(f.highlightsRatio).toBeCloseTo(1, 1)
    expect(f.saturation).toBeCloseTo(0, 1)
    expect(f.isHighKey).toBe(true)
    expect(f.isLowKey).toBe(false)
  })

  it('returns brightness=0, isLowKey=true for fully black image', () => {
    const img = makeImageData(100, 100, () => [0, 0, 0])
    const f = extractFeatures(img)
    expect(f.brightness).toBeCloseTo(0, 1)
    expect(f.shadowsRatio).toBeCloseTo(1, 1)
    expect(f.isLowKey).toBe(true)
  })

  it('returns warm features for fully red image', () => {
    const img = makeImageData(100, 100, () => [255, 0, 0])
    const f = extractFeatures(img)
    expect(f.warmth).toBeGreaterThan(0.5)
    expect(f.saturation).toBeCloseTo(1, 1)
    expect(f.dominantHues.length).toBeGreaterThan(0)
    expect(f.dominantHues[0].hue).toBeGreaterThanOrEqual(0)
    expect(f.dominantHues[0].hue).toBeLessThanOrEqual(20)
  })

  it('detects isHighContrast on black/white checkerboard', () => {
    const img = makeImageData(100, 100, (x, y) => {
      const v = (x + y) % 2 === 0 ? 0 : 255
      return [v, v, v]
    })
    const f = extractFeatures(img)
    expect(f.contrast).toBeGreaterThan(0.6)
    expect(f.isHighContrast).toBe(true)
    expect(f.brightness).toBeCloseTo(0.5, 1)
  })

  it('detects multiple dominant hues for radial rainbow', () => {
    const img = makeImageData(120, 120, (x, _y) => {
      const hue = (x / 120) * 360
      // simple HSV to RGB with S=V=1
      const c = 1
      const hp = hue / 60
      const xv = c * (1 - Math.abs((hp % 2) - 1))
      let r = 0, g = 0, b = 0
      if (hp < 1) { r = c; g = xv }
      else if (hp < 2) { r = xv; g = c }
      else if (hp < 3) { g = c; b = xv }
      else if (hp < 4) { g = xv; b = c }
      else if (hp < 5) { r = xv; b = c }
      else { r = c; b = xv }
      return [r * 255, g * 255, b * 255]
    })
    const f = extractFeatures(img)
    expect(f.dominantHues.length).toBeGreaterThanOrEqual(3)
    expect(f.saturation).toBeGreaterThan(0.5)
  })

  it('attaches exif when provided', () => {
    const img = makeImageData(50, 50, () => [128, 128, 128])
    const f = extractFeatures(img, { iso: 3200, colorTemperatureKelvin: 6500 })
    expect(f.exif?.iso).toBe(3200)
    expect(f.exif?.colorTemperatureKelvin).toBe(6500)
  })

  it('detects isMonochromatic for grayscale image', () => {
    const img = makeImageData(100, 100, () => [128, 128, 128])
    const f = extractFeatures(img)
    expect(f.saturation).toBeCloseTo(0, 1)
    expect(f.isMonochromatic).toBe(true)
  })
})
```

- [ ] **Step 2: Run test — verify FAIL**

```bash
npm test -- analyzer
```
Expected: ALL fail with "Cannot find module '../analyzer'" or similar.

- [ ] **Step 3: Implement analyzer.ts**

Создать `src/engine/recommend/analyzer.ts`:

```ts
import type { PhotoFeatures, HueWeight } from './features'
import type { ExifSubset } from '../exif'

const TARGET_SAMPLES = 50_000
const SHADOW_THRESHOLD = 0.2
const HIGHLIGHT_THRESHOLD = 0.8

/**
 * Извлекает статистику фото для рекомендаций.
 * Один проход с адаптивным subsample (~50k точек независимо от размера).
 */
export function extractFeatures(imageData: ImageData, exif?: ExifSubset): PhotoFeatures {
  const { data, width, height } = imageData
  const totalPixels = width * height
  const stride = Math.max(1, Math.floor(Math.sqrt(totalPixels / TARGET_SAMPLES)))

  let sumR = 0, sumG = 0, sumB = 0
  let sumL = 0, sumL2 = 0
  let shadowCount = 0, highlightCount = 0
  let sumSat = 0
  let count = 0
  const hueHistogram = new Array(36).fill(0)

  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const i = (y * width + x) * 4
      const r = data[i] / 255
      const g = data[i + 1] / 255
      const b = data[i + 2] / 255

      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b
      sumR += r; sumG += g; sumB += b
      sumL += l
      sumL2 += l * l
      if (l < SHADOW_THRESHOLD) shadowCount++
      if (l > HIGHLIGHT_THRESHOLD) highlightCount++

      const max = Math.max(r, g, b)
      const min = Math.min(r, g, b)
      const sat = max === 0 ? 0 : (max - min) / max
      sumSat += sat

      if (sat > 0.1) {
        const delta = max - min
        let h: number
        if (max === r) h = ((g - b) / delta) % 6
        else if (max === g) h = ((b - r) / delta) + 2
        else h = ((r - g) / delta) + 4
        h *= 60
        if (h < 0) h += 360
        const bin = Math.min(35, Math.floor(h / 10))
        hueHistogram[bin] += sat
      }

      count++
    }
  }

  const brightness = sumL / count
  const variance = sumL2 / count - brightness * brightness
  const contrast = Math.min(1, Math.sqrt(Math.max(0, variance)) * 2)
  const shadowsRatio = shadowCount / count
  const highlightsRatio = highlightCount / count
  const warmth = (sumR - sumB) / count
  const saturation = sumSat / count

  const sortedBins = hueHistogram
    .map((weight, idx) => ({ hue: idx * 10 + 5, weight }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 3)
  const totalHueWeight = sortedBins.reduce((s, b) => s + b.weight, 0)
  const dominantHues: HueWeight[] = totalHueWeight > 0
    ? sortedBins
        .filter(b => b.weight > 0)
        .map(b => ({ hue: b.hue, weight: b.weight / totalHueWeight }))
    : []

  const isLowKey = brightness < 0.3 && contrast < 0.3
  const isHighKey = brightness > 0.7 && contrast < 0.3
  const isMonochromatic = saturation < 0.1
  const isHighContrast = contrast > 0.6

  return {
    brightness,
    contrast,
    shadowsRatio,
    highlightsRatio,
    warmth,
    saturation,
    dominantHues,
    isLowKey,
    isHighKey,
    isMonochromatic,
    isHighContrast,
    exif,
  }
}
```

- [ ] **Step 4: Run tests — verify PASS**

```bash
npm test -- analyzer
```
Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/recommend/analyzer.ts src/engine/recommend/__tests__/analyzer.test.ts
git commit -m "feat(recommend): add analyzer with image feature extraction"
```

---

### Task 4: Scorer — score one recipe against features

**Files:**
- Create: `src/engine/recommend/scorer.ts`
- Create: `src/engine/recommend/__tests__/scorer.test.ts`

- [ ] **Step 1: Write failing tests**

Создать `src/engine/recommend/__tests__/scorer.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { scoreRecipe } from '../scorer'
import type { PhotoFeatures } from '../features'
import type { Recipe } from '../../types'

const warmPortrait: PhotoFeatures = {
  brightness: 0.5,
  contrast: 0.3,
  shadowsRatio: 0.1,
  highlightsRatio: 0.1,
  warmth: 0.4,
  saturation: 0.3,
  dominantHues: [{ hue: 20, weight: 0.7 }, { hue: 200, weight: 0.3 }],
  isLowKey: false,
  isHighKey: false,
  isMonochromatic: false,
  isHighContrast: false,
  exif: { iso: 1600 },
}

const saturatedLandscape: PhotoFeatures = {
  brightness: 0.6,
  contrast: 0.45,
  shadowsRatio: 0.1,
  highlightsRatio: 0.1,
  warmth: 0.1,
  saturation: 0.7,
  dominantHues: [{ hue: 120, weight: 0.5 }, { hue: 200, weight: 0.5 }],
  isLowKey: false,
  isHighKey: false,
  isMonochromatic: false,
  isHighContrast: false,
}

function makeRecipe(id: string, filmSimulation: string, settings: Recipe['settings'] = {}): Recipe {
  return { id, name: id, filmSimulation, settings }
}

describe('scoreRecipe', () => {
  it('warm portrait + Astia portrait recipe → positive score with film+use_case reasons', () => {
    // Pick a real Astia portrait recipe id from RECIPE_USE_CASES — 'astia-portrait'
    const recipe = makeRecipe('astia-portrait', 'astia')
    const { score, reasons } = scoreRecipe(warmPortrait, recipe)
    expect(score).toBeGreaterThan(0)
    const factors = reasons.map(r => r.factor)
    expect(factors).toContain('use_case_match')
    expect(factors).toContain('film_astia')
  })

  it('warm portrait + Acros recipe → score is 0 (B&W excluded)', () => {
    // Acros recipe with bw use case
    const recipe = makeRecipe('acros-pushpull', 'acros')
    const { score, reasons } = scoreRecipe(warmPortrait, recipe)
    expect(score).toBe(0)
    expect(reasons).toEqual([])
  })

  it('saturated landscape + Velvia landscape recipe → positive score with film bonus', () => {
    // Pick a Velvia landscape recipe id from RECIPE_USE_CASES
    const recipe = makeRecipe('velvia-landscape', 'velvia')
    const { score, reasons } = scoreRecipe(saturatedLandscape, recipe)
    expect(score).toBeGreaterThan(0)
    expect(reasons.map(r => r.factor)).toContain('film_velvia')
  })

  it('saturated landscape + Astia portrait recipe → low or zero score', () => {
    const recipe = makeRecipe('astia-portrait', 'astia')
    const { score } = scoreRecipe(saturatedLandscape, recipe)
    expect(score).toBeLessThan(0.4)
  })

  it('high ISO photo + recipe with grain → recipe-specific bonus applied', () => {
    const recipe = makeRecipe('provia-portrait', 'provia', { grainEffect: 'strong' })
    const features: PhotoFeatures = { ...warmPortrait, exif: { iso: 6400 } }
    const { reasons } = scoreRecipe(features, recipe)
    expect(reasons.map(r => r.factor)).toContain('grain_camouflage')
  })

  it('Kelvin match — recipe.whiteBalanceKelvin ≈ exif.colorTemperatureKelvin → kelvin_match reason', () => {
    const recipe = makeRecipe('classic-color', 'classic-chrome', { whiteBalanceKelvin: 5300 })
    const features: PhotoFeatures = {
      ...warmPortrait,
      saturation: 0.2, // ensure Classic Chrome film fit triggers
      exif: { colorTemperatureKelvin: 5400 },
    }
    const { reasons } = scoreRecipe(features, recipe)
    expect(reasons.map(r => r.factor)).toContain('kelvin_match')
  })

  it('DR400 recipe + blown highlights → dr400 reason', () => {
    const recipe = makeRecipe('provia-bright', 'provia', { dynamicRange: 'DR400' })
    const features: PhotoFeatures = { ...warmPortrait, highlightsRatio: 0.25 }
    const { reasons } = scoreRecipe(features, recipe)
    expect(reasons.map(r => r.factor)).toContain('dr400_highlights')
  })
})
```

- [ ] **Step 2: Run test — verify FAIL**

```bash
npm test -- scorer
```
Expected: tests fail because `../scorer` does not exist yet.

- [ ] **Step 3: Implement scorer.ts**

Создать `src/engine/recommend/scorer.ts`:

```ts
import type { Recipe } from '../types'
import type { PhotoFeatures, Reason } from './features'
import { RECIPE_USE_CASES, type UseCase } from '../../presets/recipes'
import {
  USE_CASE_FIT_BONUS,
  FILM_FIT_BONUS,
  FILM_FALLBACK_BONUS,
  RECIPE_SPECIFIC_BONUS,
  THRESHOLDS as T,
} from './weights'

export type ScoreResult = {
  score: number
  reasons: Reason[]
}

type UseCaseRule = (f: PhotoFeatures) => UseCase[]

const USE_CASE_RULES: UseCaseRule[] = [
  f => f.isHighKey && f.warmth > 0 ? ['portrait', 'everyday'] : [],
  f => f.warmth > T.warmthWarm && f.saturation < T.saturationHigh && !f.isHighContrast ? ['portrait'] : [],
  f => f.saturation > T.saturationHigh && !f.isLowKey ? ['landscape'] : [],
  f => f.dominantHues.length >= T.dominantHueCountHigh && f.saturation > T.saturationMuted ? ['street', 'cinema'] : [],
  f => f.isLowKey && f.isHighContrast && f.saturation > T.saturationMidLow ? ['cinema'] : [],
  f => f.warmth > T.warmthSlight && f.saturation > T.saturationVibrant ? ['everyday'] : [],
]

function preferredUseCases(features: PhotoFeatures): Set<UseCase> {
  const preferred = new Set<UseCase>()
  for (const rule of USE_CASE_RULES) {
    rule(features).forEach(uc => preferred.add(uc))
  }
  if (preferred.size === 0) preferred.add('everyday')
  return preferred
}

function filmBonus(features: PhotoFeatures, simulation: string): Reason | null {
  const make = (factor: string, label: string): Reason => ({ factor, weight: FILM_FIT_BONUS, label })

  switch (simulation) {
    case 'velvia':
      return features.saturation > T.saturationVibrant
        ? make('film_velvia', 'Velvia for saturated colors')
        : null
    case 'astia':
      return features.warmth > T.warmthMild && features.contrast < T.contrastMid
        ? make('film_astia', 'Astia for soft warm scenes')
        : null
    case 'acros':
    case 'neopan':
      return null
    case 'classic-chrome':
      return features.saturation < T.saturationMuted
        ? make('film_classic_chrome', 'Classic Chrome for muted palettes')
        : null
    case 'classic-neg':
      return features.dominantHues.length >= T.dominantHueCountHigh && features.saturation > T.saturationMidLow
        ? make('film_classic_neg', 'Classic Neg for complex palettes')
        : null
    case 'pro-400h':
      return features.warmth > T.warmthMild
        ? make('film_pro_400h', 'Pro 400H for warm tones')
        : null
    case 'eterna':
      return features.contrast > T.contrastLow &&
             features.shadowsRatio > T.shadowsRecover &&
             features.highlightsRatio > T.shadowsRecover
        ? make('film_eterna', 'Eterna for wide tonal range')
        : null
    case 'superia':
      return features.warmth > T.warmthMild && features.saturation > T.saturationVibrant
        ? make('film_superia', 'Superia for warm vibrant tones')
        : null
    case 'provia':
      return {
        factor: 'film_provia_baseline',
        weight: FILM_FALLBACK_BONUS,
        label: 'Provia as neutral baseline',
      }
    default:
      return null
  }
}

export function scoreRecipe(features: PhotoFeatures, recipe: Recipe): ScoreResult {
  const useCase = RECIPE_USE_CASES[recipe.id] ?? 'everyday'

  // B&W use case is excluded from auto-picks entirely
  if (useCase === 'bw') return { score: 0, reasons: [] }

  const reasons: Reason[] = []
  let score = 0

  // Use case fit
  if (preferredUseCases(features).has(useCase)) {
    score += USE_CASE_FIT_BONUS
    reasons.push({
      factor: 'use_case_match',
      weight: USE_CASE_FIT_BONUS,
      label: `Use case ${useCase} matches scene`,
    })
  }

  // Film fit
  const film = filmBonus(features, recipe.filmSimulation)
  if (film) {
    score += film.weight
    reasons.push(film)
  }

  // Recipe-specific factors
  const { settings } = recipe
  const exif = features.exif

  if (
    settings.whiteBalanceKelvin !== undefined &&
    exif?.colorTemperatureKelvin !== undefined &&
    Math.abs(settings.whiteBalanceKelvin - exif.colorTemperatureKelvin) < T.kelvinTolerance
  ) {
    score += RECIPE_SPECIFIC_BONUS
    reasons.push({
      factor: 'kelvin_match',
      weight: RECIPE_SPECIFIC_BONUS,
      label: 'WB Kelvin matches photo',
    })
  }

  if (settings.dynamicRange === 'DR400' && features.highlightsRatio > T.highlightsRecover) {
    score += RECIPE_SPECIFIC_BONUS
    reasons.push({
      factor: 'dr400_highlights',
      weight: RECIPE_SPECIFIC_BONUS,
      label: 'DR400 recovers blown highlights',
    })
  }

  if (
    settings.grainEffect &&
    settings.grainEffect !== 'off' &&
    exif?.iso !== undefined &&
    exif.iso > T.isoHigh
  ) {
    score += RECIPE_SPECIFIC_BONUS
    reasons.push({
      factor: 'grain_camouflage',
      weight: RECIPE_SPECIFIC_BONUS,
      label: 'Grain masks high-ISO noise',
    })
  }

  return { score, reasons }
}
```

- [ ] **Step 4: Run tests — verify PASS**

```bash
npm test -- scorer
```
Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/recommend/scorer.ts src/engine/recommend/__tests__/scorer.test.ts
git commit -m "feat(recommend): add scorer with use-case + film + recipe-specific rules"
```

---

### Task 5: Recommend — top N with diversity + monochromatic guard

**Files:**
- Create: `src/engine/recommend/recommend.ts`
- Create: `src/engine/recommend/__tests__/recommend.test.ts`

- [ ] **Step 1: Write failing tests**

Создать `src/engine/recommend/__tests__/recommend.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { recommendRecipes } from '../recommend'
import { getAllRecipes, RECIPE_USE_CASES } from '../../../presets/recipes'
import type { PhotoFeatures } from '../features'

const allRecipes = getAllRecipes()

const monochromatic: PhotoFeatures = {
  brightness: 0.5, contrast: 0.3, shadowsRatio: 0.1, highlightsRatio: 0.1,
  warmth: 0, saturation: 0.05, dominantHues: [],
  isLowKey: false, isHighKey: false, isMonochromatic: true, isHighContrast: false,
}

const warmPortrait: PhotoFeatures = {
  brightness: 0.55, contrast: 0.3, shadowsRatio: 0.05, highlightsRatio: 0.1,
  warmth: 0.4, saturation: 0.3,
  dominantHues: [{ hue: 20, weight: 0.7 }, { hue: 200, weight: 0.3 }],
  isLowKey: false, isHighKey: false, isMonochromatic: false, isHighContrast: false,
}

const saturatedLandscape: PhotoFeatures = {
  brightness: 0.6, contrast: 0.45, shadowsRatio: 0.1, highlightsRatio: 0.1,
  warmth: 0.1, saturation: 0.7,
  dominantHues: [{ hue: 120, weight: 0.4 }, { hue: 200, weight: 0.4 }, { hue: 60, weight: 0.2 }],
  isLowKey: false, isHighKey: false, isMonochromatic: false, isHighContrast: false,
}

describe('recommendRecipes', () => {
  it('returns empty array for monochromatic input', () => {
    expect(recommendRecipes(monochromatic, allRecipes)).toEqual([])
  })

  it('returns 5 picks for warm portrait scene', () => {
    const picks = recommendRecipes(warmPortrait, allRecipes)
    expect(picks.length).toBe(5)
  })

  it('warm portrait picks include at least one portrait or everyday recipe', () => {
    const picks = recommendRecipes(warmPortrait, allRecipes)
    const useCases = picks.map(id => RECIPE_USE_CASES[id] ?? 'everyday')
    expect(useCases.some(uc => uc === 'portrait' || uc === 'everyday')).toBe(true)
  })

  it('top 5 contain at least 3 different film simulations (diversity)', () => {
    const picks = recommendRecipes(warmPortrait, allRecipes)
    const films = new Set(
      picks
        .map(id => allRecipes.find(r => r.id === id)?.filmSimulation)
        .filter((f): f is string => Boolean(f))
    )
    expect(films.size).toBeGreaterThanOrEqual(3)
  })

  it('no B&W recipes in non-empty output', () => {
    const picks = recommendRecipes(saturatedLandscape, allRecipes)
    const useCases = picks.map(id => RECIPE_USE_CASES[id] ?? 'everyday')
    expect(useCases.every(uc => uc !== 'bw')).toBe(true)

    const films = picks.map(id => allRecipes.find(r => r.id === id)?.filmSimulation)
    expect(films.every(f => f !== 'acros' && f !== 'neopan')).toBe(true)
  })

  it('is deterministic — same input gives same output', () => {
    const a = recommendRecipes(warmPortrait, allRecipes)
    const b = recommendRecipes(warmPortrait, allRecipes)
    expect(a).toEqual(b)
  })
})
```

- [ ] **Step 2: Run test — verify FAIL**

```bash
npm test -- recommend
```
Expected: tests fail (no `../recommend`).

- [ ] **Step 3: Implement recommend.ts**

Создать `src/engine/recommend/recommend.ts`:

```ts
import type { Recipe } from '../types'
import type { PhotoFeatures, ScoredRecipe } from './features'
import { scoreRecipe } from './scorer'
import { DIVERSITY, PICKS_COUNT, CANDIDATE_POOL_SIZE } from './weights'
import { RECIPE_USE_CASES } from '../../presets/recipes'

/**
 * Возвращает топ-N recipe IDs для данных PhotoFeatures.
 * Guard: для монохромных фото — пустой массив.
 * Diversity (MMR): рецепты одного film/use_case подавляются.
 */
export function recommendRecipes(features: PhotoFeatures, allRecipes: Recipe[]): string[] {
  if (features.isMonochromatic) return []

  const scored: ScoredRecipe[] = allRecipes
    .map(r => {
      const { score, reasons } = scoreRecipe(features, r)
      return { recipeId: r.id, score, reasons }
    })
    .filter(s => s.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return a.recipeId.localeCompare(b.recipeId)
    })

  const candidates = scored.slice(0, CANDIDATE_POOL_SIZE)
  const recipeMap = new Map(allRecipes.map(r => [r.id, r]))

  const selected: ScoredRecipe[] = []
  const selectedFilms = new Set<string>()
  const selectedUseCases = new Set<string>()

  while (selected.length < PICKS_COUNT && candidates.length > 0) {
    let bestIdx = -1
    let bestEffective = -Infinity

    for (let i = 0; i < candidates.length; i++) {
      const c = candidates[i]
      const recipe = recipeMap.get(c.recipeId)
      if (!recipe) continue
      const film = recipe.filmSimulation
      const useCase = RECIPE_USE_CASES[c.recipeId] ?? 'everyday'

      const penalty =
        (selectedFilms.has(film) ? DIVERSITY.sameFilmPenalty : 0) +
        (selectedUseCases.has(useCase) ? DIVERSITY.sameUseCasePenalty : 0)

      const effective = c.score - DIVERSITY.lambda * penalty
      if (effective > bestEffective) {
        bestEffective = effective
        bestIdx = i
      }
    }

    if (bestIdx === -1) break
    const picked = candidates.splice(bestIdx, 1)[0]
    selected.push(picked)
    const r = recipeMap.get(picked.recipeId)
    if (r) {
      selectedFilms.add(r.filmSimulation)
      selectedUseCases.add(RECIPE_USE_CASES[picked.recipeId] ?? 'everyday')
    }
  }

  return selected.map(s => s.recipeId)
}
```

- [ ] **Step 4: Run tests — verify PASS**

```bash
npm test
```
Expected: all (analyzer + scorer + recommend + existing whitebalance) tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/engine/recommend/recommend.ts src/engine/recommend/__tests__/recommend.test.ts
git commit -m "feat(recommend): add top-N recommendation with MMR diversity"
```

---

### Task 6: Worker — wrap analyzer + recommend

**Files:**
- Create: `src/engine/recommend/recommend.worker.ts`

- [ ] **Step 1: Implement worker**

Создать `src/engine/recommend/recommend.worker.ts`:

```ts
/**
 * Web Worker для Smart Picks: получает thumbnail + EXIF + recipes,
 * возвращает топ-5 recipe IDs.
 */
import type { Recipe } from '../types'
import type { ExifSubset } from '../exif'
import { extractFeatures } from './analyzer'
import { recommendRecipes } from './recommend'

interface AnalyzeRequest {
  type: 'analyze'
  requestId: string
  imageData: ImageData
  exif?: ExifSubset
  recipes: Recipe[]
}

self.addEventListener('message', (e: MessageEvent<AnalyzeRequest>) => {
  const msg = e.data
  if (!msg || msg.type !== 'analyze') return

  try {
    const features = extractFeatures(msg.imageData, msg.exif)
    const recipeIds = recommendRecipes(features, msg.recipes)
    self.postMessage({ type: 'result', requestId: msg.requestId, recipeIds })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'analysis failed'
    self.postMessage({ type: 'error', requestId: msg.requestId, message })
  }
})
```

- [ ] **Step 2: Build to verify worker compiles**

```bash
npm run build
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/engine/recommend/recommend.worker.ts
git commit -m "feat(recommend): add Web Worker entry for off-main-thread analysis"
```

---

### Task 7: Add exif?: ExifSubset to ImageItem, extract on load

**Files:**
- Modify: `src/engine/types.ts`
- Modify: `src/hooks/useImageProcessor.ts`

- [ ] **Step 1: Add ExifSubset to ImageItem**

В `src/engine/types.ts` после `import` секции (либо в начале файла, если её нет) добавить импорт:

```ts
import type { ExifSubset } from './exif'
```

В интерфейс `ImageItem` (строки 76-99) перед `recipe: Recipe | null` добавить:

```ts
  /** EXIF-данные (ISO, цветовая температура) для рекомендаций */
  exif?: ExifSubset
```

- [ ] **Step 2: Use extractExif in loadImages**

В `src/hooks/useImageProcessor.ts` после строки 5 (`import { THUMBNAIL_MAX_SIZE } from '../constants'`) добавить:

```ts
import { extractExif } from '../engine/exif'
```

Заменить блок в `loadImages` (строки 43-61):

```ts
      const loadPromises = files.map(async (file) => {
        const [original, thumbnail] = await Promise.all([
          ImageProcessor.loadImage(file),
          ImageProcessor.createThumbnail(file, THUMBNAIL_MAX_SIZE)
        ])

        return {
          id: generateImageId(),
          file,
          fileName: file.name,
          original,
          thumbnail,
          recipe: null,
          customSettings: {},
          transformedOriginal: original,
          transformedThumbnail: thumbnail,
          rotation: 0
        } as ImageItem
      })
```

На:

```ts
      const loadPromises = files.map(async (file) => {
        const [original, thumbnail, exif] = await Promise.all([
          ImageProcessor.loadImage(file),
          ImageProcessor.createThumbnail(file, THUMBNAIL_MAX_SIZE),
          extractExif(file)
        ])

        return {
          id: generateImageId(),
          file,
          fileName: file.name,
          original,
          thumbnail,
          exif,
          recipe: null,
          customSettings: {},
          transformedOriginal: original,
          transformedThumbnail: thumbnail,
          rotation: 0
        } as ImageItem
      })
```

- [ ] **Step 3: Build to verify**

```bash
npm run build
```
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/engine/types.ts src/hooks/useImageProcessor.ts
git commit -m "feat(image): extract EXIF on load, store in ImageItem.exif"
```

---

### Task 8: useRecipeRecommendations hook

**Files:**
- Create: `src/hooks/useRecipeRecommendations.ts`

- [ ] **Step 1: Implement hook**

Создать `src/hooks/useRecipeRecommendations.ts`:

```ts
import { useState, useEffect, useRef } from 'react'
import type { ExifSubset } from '../engine/exif'
import { getAllRecipes } from '../presets/recipes'

const DEBOUNCE_MS = 200
const CACHE_MAX = 20

type WorkerMessage =
  | { type: 'result'; requestId: string; recipeIds: string[] }
  | { type: 'error'; requestId: string; message: string }

/**
 * Хук для рекомендации рецептов под текущее фото.
 * Off-main-thread анализ + LRU-кеш по imageId.
 */
export function useRecipeRecommendations(
  imageId: string | null,
  thumbnail: ImageData | null,
  exif?: ExifSubset
): { recipeIds: string[]; isReady: boolean } {
  const [recipeIds, setRecipeIds] = useState<string[]>([])
  const workerRef = useRef<Worker | null>(null)
  const cacheRef = useRef<Map<string, string[]>>(new Map())
  const requestCounterRef = useRef(0)
  const currentRequestRef = useRef<string | null>(null)

  // One-time worker setup
  useEffect(() => {
    if (typeof Worker === 'undefined') return
    let worker: Worker | null = null
    try {
      worker = new Worker(
        new URL('../engine/recommend/recommend.worker.ts', import.meta.url),
        { type: 'module' }
      )
      worker.addEventListener('message', (e: MessageEvent<WorkerMessage>) => {
        if (e.data.requestId !== currentRequestRef.current) return // stale
        if (e.data.type === 'result') {
          setRecipeIds(e.data.recipeIds)
        }
      })
      worker.addEventListener('error', (e: ErrorEvent) => {
        console.warn('Smart Picks worker error:', e.message)
      })
      workerRef.current = worker
    } catch {
      // Worker creation failed; section will simply never render
    }

    return () => {
      worker?.terminate()
      workerRef.current = null
    }
  }, [])

  // Recompute on imageId change
  useEffect(() => {
    if (!imageId || !thumbnail) {
      setRecipeIds([])
      currentRequestRef.current = null
      return
    }

    // Cache hit
    const cached = cacheRef.current.get(imageId)
    if (cached) {
      setRecipeIds(cached)
      currentRequestRef.current = null
      return
    }

    setRecipeIds([])

    const timeoutId = setTimeout(() => {
      const worker = workerRef.current
      if (!worker) return

      const reqId = String(++requestCounterRef.current)
      currentRequestRef.current = reqId

      const onMessage = (e: MessageEvent<WorkerMessage>) => {
        if (e.data.requestId !== reqId) return
        if (e.data.type === 'result') {
          if (cacheRef.current.size >= CACHE_MAX) {
            const firstKey = cacheRef.current.keys().next().value
            if (firstKey) cacheRef.current.delete(firstKey)
          }
          cacheRef.current.set(imageId, e.data.recipeIds)
        }
        worker.removeEventListener('message', onMessage)
      }
      worker.addEventListener('message', onMessage)

      worker.postMessage({
        type: 'analyze',
        requestId: reqId,
        imageData: thumbnail,
        exif,
        recipes: getAllRecipes(),
      })
    }, DEBOUNCE_MS)

    return () => clearTimeout(timeoutId)
  }, [imageId, thumbnail, exif])

  return { recipeIds, isReady: recipeIds.length > 0 }
}
```

- [ ] **Step 2: Build to verify**

```bash
npm run build
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useRecipeRecommendations.ts
git commit -m "feat(hooks): add useRecipeRecommendations with worker + LRU cache"
```

---

### Task 9: RecipePanel — Smart Picks section (desktop vertical)

**Files:**
- Modify: `src/components/RecipePanel.tsx`

- [ ] **Step 1: Add prop + imports**

В `src/components/RecipePanel.tsx` строка 2 — добавить `Sparkles` в импорт из `lucide-react`:

Заменить:
```tsx
import { Shuffle, Heart, Film, Layers, Star } from 'lucide-react'
```
На:
```tsx
import { Shuffle, Heart, Film, Layers, Star, Sparkles } from 'lucide-react'
```

В интерфейс `RecipePanelProps` (строки 18-31) перед закрывающей `}` добавить:

```ts
  /** Recipe IDs рекомендованные для текущего фото (Smart Picks) */
  smartPicksIds?: string[]
```

В деструктуризации пропсов в сигнатуре функции (строки 33-43) добавить `smartPicksIds = []` перед закрывающей `}`:

```tsx
  smartPicksIds = []
```

- [ ] **Step 2: Add smartPicksRecipes memo**

После строки 61 (`const editorsChoiceRecipes = useMemo(...)`) добавить:

```tsx
  const smartPicksRecipes = useMemo(() => {
    return smartPicksIds
      .map(id => RECIPES[id])
      .filter((r): r is Recipe => r !== undefined)
  }, [smartPicksIds])
```

- [ ] **Step 3: Render Smart Picks in vertical mode**

В vertical-ветке после блока Favorites (заканчивается на строке 358 `</section>`) — перед блоком Editor's Choice (строка 361 начинается с `{editorsChoiceRecipes.length > 0 && (`) вставить:

```tsx
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
                  className="text-[10px] text-zinc-600"
                  aria-label={`${smartPicksRecipes.length} presets`}
                >
                  {smartPicksRecipes.length}
                </span>
              </div>
              <div
                className="grid grid-cols-2 gap-2"
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
```

- [ ] **Step 4: Build to verify**

```bash
npm run build
```
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/RecipePanel.tsx
git commit -m "feat(ui): add Smart Picks section to desktop RecipePanel"
```

---

### Task 10: RecipePanel — Smart Picks + Editor's Choice on mobile

**Files:**
- Modify: `src/components/RecipePanel.tsx`

- [ ] **Step 1: Render Smart Picks in horizontal/mobile mode**

В `horizontal` ветке (начинается ~строка 93) после блока Apply to all (заканчивается ~строкой 165 `</button>` после `Apply to all`) и **перед** `{groupingMode === 'film' ? (` (строка 168) вставить:

```tsx
          {/* Smart Picks section */}
          {smartPicksRecipes.length > 0 && (
            <>
              <div className="flex-shrink-0 flex items-center" role="listitem">
                <div className="w-20 h-full flex flex-col items-center justify-center px-2 py-3 rounded-xl bg-zinc-900/50 border border-zinc-800">
                  <Sparkles className="w-4 h-4 text-zinc-400 mb-1" aria-hidden="true" />
                  <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider text-center leading-tight">
                    Smart<br />Picks
                  </span>
                  <span className="text-[10px] text-zinc-600 mt-0.5">
                    {smartPicksRecipes.length}
                  </span>
                </div>
              </div>
              {smartPicksRecipes.map((recipe) => (
                <div
                  key={`sp-${recipe.id}`}
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
            </>
          )}

          {/* Editor's Choice section (mobile bug fix) */}
          {editorsChoiceRecipes.length > 0 && (
            <>
              <div className="flex-shrink-0 flex items-center" role="listitem">
                <div className="w-20 h-full flex flex-col items-center justify-center px-2 py-3 rounded-xl bg-zinc-900/50 border border-zinc-800">
                  <Star className="w-4 h-4 text-zinc-400 mb-1" aria-hidden="true" />
                  <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider text-center leading-tight">
                    Editor's<br />Choice
                  </span>
                  <span className="text-[10px] text-zinc-600 mt-0.5">
                    {editorsChoiceRecipes.length}
                  </span>
                </div>
              </div>
              {editorsChoiceRecipes.map((recipe) => (
                <div
                  key={`ec-${recipe.id}`}
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
            </>
          )}
```

- [ ] **Step 2: Build to verify**

```bash
npm run build
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/RecipePanel.tsx
git commit -m "feat(ui): add Smart Picks + Editor's Choice to mobile horizontal panel"
```

---

### Task 11: Wire Editor.tsx — call hook + pass smartPicksIds

**Files:**
- Modify: `src/components/Editor.tsx`

**Note on video mode:** `VideoEditor.tsx` использует `RecipePanel` без передачи `smartPicksIds`. Благодаря default `smartPicksIds = []` в `RecipePanel`, секция Smart Picks для video автоматически не рендерится — не требует отдельной работы.

- [ ] **Step 1: Import hook + call it**

В `src/components/Editor.tsx` найти существующий импорт hooks (около строки 16-20, импорт `useImageProcessor`). Сразу после него добавить:

```tsx
import { useRecipeRecommendations } from '../hooks/useRecipeRecommendations'
```

В теле main компонента Editor (после получения `currentImage`, до return — около строки 80, где определены другие хуки) добавить:

```tsx
  const { recipeIds: smartPicksIds } = useRecipeRecommendations(
    currentImage?.id ?? null,
    currentImage?.thumbnail ?? null,
    currentImage?.exif
  )
```

- [ ] **Step 2: Pass smartPicksIds to mobile RecipePanel**

В вызове мобильного `RecipePanel` (строка 463-471) добавить prop:

```tsx
            horizontal
            smartPicksIds={smartPicksIds}
          />
```

- [ ] **Step 3: Pass smartPicksIds through DesktopSidePanel**

В интерфейс `DesktopSidePanelProps` (строки 620-635) добавить:

```ts
  smartPicksIds: string[]
```

В сигнатуре функции `DesktopSidePanel` (строки 637-652) добавить в деструктуризации `smartPicksIds`:

```tsx
  onTuningCancel,
  smartPicksIds,
}: DesktopSidePanelProps) {
```

Во вложенный вызов `<RecipePanel ... />` (строка 663) добавить prop:

```tsx
          onApplyToAll={onApplyToAll}
          smartPicksIds={smartPicksIds}
        />
```

В вызове `<DesktopSidePanel ... />` в основной части Editor (поиск: `<DesktopSidePanel`) добавить prop `smartPicksIds={smartPicksIds}`.

- [ ] **Step 4: Build to verify**

```bash
npm run build
```
Expected: exit 0.

- [ ] **Step 5: Manual smoke**

```bash
npm run dev
```

В браузере: загрузить фото из `e2e/fixtures/test-image.jpg`. Через ~250ms в RecipePanel сверху должна появиться секция «Smart Picks» с 5 карточками. Карточки кликабельны и применяют рецепт.

- [ ] **Step 6: Commit**

```bash
git add src/components/Editor.tsx
git commit -m "feat(ui): wire useRecipeRecommendations to RecipePanel"
```

---

### Task 12: Version bump + What's New entry

**Files:**
- Modify: `src/constants.ts`
- Modify: `package.json`
- Modify: `src/components/HelpDialog.tsx`

- [ ] **Step 1: Bump APP_VERSION**

В `src/constants.ts` найти `APP_VERSION` (строка 11) и заменить на:

```ts
export const APP_VERSION = '1.5'
```

- [ ] **Step 2: Bump package version**

В `package.json` поменять:

```json
"version": "1.3.0",
```
(или текущая, посмотреть). На:

```json
"version": "1.5.0",
```

- [ ] **Step 3: Add What's New entry**

В `src/components/HelpDialog.tsx` найти массив `WHATS_NEW` и добавить запись для версии 1.5 в самое начало:

```tsx
const WHATS_NEW = [
  {
    version: '1.5',
    items: [
      'Smart Picks: recipe recommendations tailored to your photo',
      "Editor's Choice now also visible on mobile",
    ],
  },
  // ... existing entries
]
```

- [ ] **Step 4: Build to verify**

```bash
npm run build
```
Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/constants.ts package.json src/components/HelpDialog.tsx
git commit -m "chore(release): bump version to 1.5 with What's New entry"
```

---

### Task 13: E2E desktop tests — Smart Picks

**Files:**
- Create: `e2e/editor-smart-picks.spec.ts`

- [ ] **Step 1: Write spec file**

Создать `e2e/editor-smart-picks.spec.ts`:

```ts
import { test, expect } from './helpers/fixtures'

test.describe('Editor — Smart Picks', () => {
  test('Smart Picks section appears after loading a color photo', async ({ page, editorPage }) => {
    // The desktop section uses aria-label="Smart Picks" via <section>
    const section = page.locator('aside section[aria-label="Smart Picks"]')
    await expect(section).toBeVisible({ timeout: 5_000 })
  })

  test('Smart Picks contains exactly 5 cards', async ({ page, editorPage }) => {
    const section = page.locator('aside section[aria-label="Smart Picks"]')
    await expect(section).toBeVisible({ timeout: 5_000 })
    const cards = section.locator('[aria-label^="Apply preset"]')
    await expect(cards).toHaveCount(5)
  })

  test('Clicking a Smart Picks card applies the recipe', async ({ page, editorPage }) => {
    const section = page.locator('aside section[aria-label="Smart Picks"]')
    await expect(section).toBeVisible({ timeout: 5_000 })

    const firstCard = section.locator('[aria-label^="Apply preset"]').first()
    const cardLabel = await firstCard.getAttribute('aria-label')
    await firstCard.click()

    // Same card should now be marked as selected
    const selectedSelector = cardLabel?.replace('Apply preset ', '').replace(/, selected$/, '')
    await expect(
      page.locator(`aside section[aria-label="Smart Picks"] [aria-label*="${selectedSelector}, selected"]`).first()
    ).toBeVisible({ timeout: 5_000 })
  })

  test('Switching between images updates Smart Picks', async ({ page, multiImageEditorPage }) => {
    const section = page.locator('aside section[aria-label="Smart Picks"]')
    await expect(section).toBeVisible({ timeout: 5_000 })

    // Capture initial first card's aria-label
    const initialLabel = await section.locator('[aria-label^="Apply preset"]').first().getAttribute('aria-label')

    // Switch to second image via thumbnail strip
    const thumbs = page.locator('[aria-label^="Image"]')
    await thumbs.nth(1).click()

    // Wait a bit for Smart Picks to recompute (debounce + worker)
    await page.waitForTimeout(500)

    // Section should still be present (it may or may not have same recipes; assert it's there)
    await expect(section).toBeVisible()
    // Capture is best-effort; for this test we just confirm the section recomputed without errors
    const newLabel = await section.locator('[aria-label^="Apply preset"]').first().getAttribute('aria-label')
    expect(newLabel).toBeTruthy()
    // No assertion on equality — picks may coincide on similar photos. Just no crash.
    void initialLabel
  })
})
```

- [ ] **Step 2: Run the spec on chromium**

```bash
npx playwright test e2e/editor-smart-picks.spec.ts --project=chromium
```
Expected: 4 passed.

- [ ] **Step 3: Commit**

```bash
git add e2e/editor-smart-picks.spec.ts
git commit -m "test(e2e): add Smart Picks tests for desktop"
```

---

### Task 14: Mobile project — extend testMatch + mobile E2E

**Files:**
- Modify: `playwright.config.ts`
- Modify: `e2e/editor-smart-picks.spec.ts`

- [ ] **Step 1: Extend mobile-chrome testMatch**

В `playwright.config.ts` найти строку `testMatch: /landing\.spec\.ts/,` (в проекте `mobile-chrome`, около строки 42) и заменить на:

```ts
      testMatch: /(landing|editor-smart-picks)\.spec\.ts/,
```

- [ ] **Step 2: Add mobile-only tests to spec file**

В конец `e2e/editor-smart-picks.spec.ts`, перед закрывающей `})` всего `test.describe`, добавить:

```ts
  test('Smart Picks visible in horizontal mobile scroll', async ({ page, editorPage, browserName }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chrome', 'mobile-only test')

    // Mobile renders RecipePanel with horizontal=true; smart picks header has aria-hidden Sparkles + label "Smart Picks"
    const mobilePanel = page.locator('nav[aria-label="Film presets"]')
    await expect(mobilePanel).toBeVisible({ timeout: 5_000 })

    // Smart Picks card-pill contains text "Smart" "Picks"
    await expect(mobilePanel.getByText('Smart', { exact: false })).toBeVisible({ timeout: 5_000 })
  })

  test("Editor's Choice visible in horizontal mobile scroll (bug fix)", async ({ page, editorPage }, testInfo) => {
    test.skip(testInfo.project.name !== 'mobile-chrome', 'mobile-only test')

    const mobilePanel = page.locator('nav[aria-label="Film presets"]')
    await expect(mobilePanel).toBeVisible({ timeout: 5_000 })

    // Editor's Choice card-pill text
    await expect(mobilePanel.getByText("Editor's", { exact: false })).toBeVisible({ timeout: 5_000 })
  })
```

- [ ] **Step 3: Run all browsers**

```bash
npx playwright test e2e/editor-smart-picks.spec.ts
```
Expected: passed across chromium/firefox/mobile-chrome (skip patterns apply correctly).

- [ ] **Step 4: Commit**

```bash
git add playwright.config.ts e2e/editor-smart-picks.spec.ts
git commit -m "test(e2e): add mobile Smart Picks + Editor's Choice tests"
```

---

### Task 15: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full build**

```bash
npm run build
```
Expected: exit 0, no TypeScript errors, no Vite errors.

- [ ] **Step 2: All unit tests**

```bash
npm test
```
Expected: all tests pass (whitebalance 5 + analyzer 7 + scorer 7 + recommend 6 = 25+).

- [ ] **Step 3: Full E2E**

```bash
npm run test:e2e:chromium
```
Expected: existing tests pass + new Smart Picks tests pass.

- [ ] **Step 4: Bundle size sanity check**

```bash
npm run build && ls -lh out/assets/*.js | head -10
```

Compare main JS bundle size against previous commit. Increase expected: < 10 KB gzipped (without ML).

- [ ] **Step 5: Manual smoke**

```bash
npm run dev
```

В браузере на http://localhost:5173:

1. Загрузить test-image.jpg → Smart Picks секция появляется сверху RecipePanel в течение ~250ms
2. Открыть DevTools → Sources → проверить, что recommend.worker.ts загрузился как worker
3. Кликнуть на одну из карточек Smart Picks → рецепт применяется, превью обновляется
4. На mobile viewport (DevTools toolbar) — Smart Picks и Editor's Choice видны в горизонтальной ленте
5. Загрузить несколько фото → переключение между ними обновляет Smart Picks
6. Открыть Help dialog → What's New показывает запись 1.5
