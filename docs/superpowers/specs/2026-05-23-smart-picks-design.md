# Smart Picks — Design Spec

**Дата:** 2026-05-23
**Статус:** approved, готово к imp.-плану
**Скоуп:** одна спека = одна фича. Smart Picks как фундаментальный модуль рекомендаций. Smart Auto-Tune, Smart WB, объяснения «почему» — отдельные follow-up.

---

## Goal

Решить проблему выбора из 100 рецептов: для активной фотографии показать секцию из 5 рецептов, которые с высокой вероятностью подойдут к этой сцене. Без ML — на эвристиках (статистика изображения + EXIF). Privacy promise проекта (всё локально, в браузере) сохраняется без компромиссов.

## Архитектурный фундамент (зафиксировано)

**Вариант A — только эвристики.** ML и cloud-API отброшены: ML раздувает bundle и требует загрузки модели, cloud противоречит обещанию privacy-first в README/manifest.

## Out of scope (явно)

- Smart Auto-Tune после применения рецепта
- Smart WB suggestion на загрузке
- Smart Initial Recipe (auto-apply без подтверждения)
- Explanation UI («почему этот рецепт?») — reasons собираются в scorer для тестов и будущей фичи, в UI не показываются
- Toggle «Show B&W picks» в UI
- Кастомизация веса категорий пользователем
- Video mode: Smart Picks для видео — отдельная follow-up задача
- ML-классификатор сцены, face-detection, sky-detection

---

## Архитектура и поток данных

Новый изолированный модуль:

```
src/engine/recommend/
├── analyzer.ts             # extractFeatures(imageData, exif?) → PhotoFeatures
├── features.ts             # типы PhotoFeatures, HueWeight, ExifSubset
├── scorer.ts               # scoreRecipe(features, recipe) → { score, reasons }
├── recommend.ts            # recommendRecipes(features, recipes, n) → ScoredRecipe[]
├── weights.ts              # все веса и пороги — никакой магии в scorer.ts
├── recommend.worker.ts     # worker-обёртка
└── __tests__/
    ├── analyzer.test.ts
    ├── scorer.test.ts
    └── recommend.test.ts
```

**Направление зависимостей:**

- `analyzer.ts` — чистая функция `(ImageData, ExifSubset?) → PhotoFeatures`. Не знает про рецепты.
- `scorer.ts` — чистая функция `(PhotoFeatures, Recipe) → ScoreResult`. Не знает про список рецептов и DOM.
- `recommend.ts` — комбинирует scorer для всех рецептов + diversity-фильтр (MMR). Здесь же бизнес-guard: `if features.isMonochromatic → return []`.
- `recommend.worker.ts` — единственная точка вызова из UI.

**Изоляция:** модуль может быть удалён вместе со своей секцией в UI без последствий для engine processor pipeline.

**Поток в приложении:**

```
loadImages → для каждого файла, помимо original+thumbnail, извлекается ExifSubset
           → ImageItem пополняется полем exif?: ExifSubset
↓
смена активного фото
  → useRecipeRecommendations(currentImage.id, currentImage.thumbnail, currentImage.exif)
    → cache lookup по id
    → cache miss: postMessage в recommend.worker
    → worker возвращает топ-5 recipe id
    → hook кладёт в cache + state
  → RecipePanel рендерит секцию "Smart Picks"
```

**Cache key**: `ImageItem.id` (стабилен per-load в рамках сессии). Контент-хеш не считается — внутри одной сессии перезагрузки того же файла дают новый `id`, что приемлемо (cache miss = повторный анализ ~15ms).

**Что НЕ меняем:**
- Engine processor pipeline
- API рецептов (`getAllRecipes`, `RECIPES`, use case groups)
- WebGL / HaldCLUT
- Любую существующую секцию RecipePanel (только добавляем новую + фиксим Editor's Choice на mobile)

---

## Data contracts

### PhotoFeatures

```ts
type PhotoFeatures = {
  // Tonal — нормализовано 0-1
  brightness: number              // средняя luminance
  contrast: number                // нормализованное std dev luminance
  shadowsRatio: number            // доля пикселей L < 0.2
  highlightsRatio: number         // доля пикселей L > 0.8

  // Color
  warmth: number                  // -1..+1, (avgR - avgB) / 255
  saturation: number              // 0-1, среднее HSV-S
  dominantHues: HueWeight[]       // 3 самых частых оттенка

  // Derived scene flags
  isLowKey: boolean               // brightness<0.3 && contrast<0.3
  isHighKey: boolean              // brightness>0.7 && contrast<0.3
  isMonochromatic: boolean        // saturation<0.1
  isHighContrast: boolean         // contrast>0.6

  // EXIF опционально
  exif?: ExifSubset
}

type HueWeight = { hue: number; weight: number }  // hue 0-360, weight 0-1

/** Минимальный срез EXIF, релевантный для скоринга */
type ExifSubset = {
  iso?: number                       // ISO speed (например 100, 1600, 3200)
  colorTemperatureKelvin?: number    // если EXIF содержит явный WB, иначе undefined
}
```

`ExifSubset` извлекается один раз при загрузке файла через `piexifjs.load()` и сохраняется в `ImageItem.exif`. Большую часть фотографий в EXIF содержат ISO; явный Kelvin WB бывает редко — это OK, fallback всё равно работает.

### Worker messages

```ts
// inbound (ImageData передаётся transferable через postMessage)
{ type: 'analyze', requestId: string, imageData: ImageData, exif?: ExifSubset }

// outbound success
{ type: 'result', requestId: string, recipeIds: string[] }

// outbound failure
{ type: 'error', requestId: string, message: string }
```

`requestId` отсекает stale-результаты при быстрой смене фото.

### Hook API

```ts
function useRecipeRecommendations(
  imageId: string | null,
  thumbnail: ImageData | null,
  exif?: ExifSubset
): { recipeIds: string[]; isReady: boolean }
```

- `imageId` — стабильный `ImageItem.id` из useImageProcessor.
- `thumbnail` — `currentImage.thumbnail`, тот же что для preview (1600px max).
- `recipeIds = []` означает «секцию не рендерим» (нет фото / monochromatic / video / worker упал).
- `recipeIds.length > 0` → ровно 5 элементов.

---

## Scoring

Score рецепта = взвешенная сумма по трём категориям. **Без отрицательных штрафов** — рецепт либо набирает бонусы, либо естественно проседает.

### Категория 1: Use case fit (~40% от max score)

Сцена → предпочтительные use case'ы:

| Условие | Бонус для use case |
|---|---|
| `isHighKey && warmth > 0` | portrait, everyday |
| `warmth > 0.3 && saturation < 0.5 && !isHighContrast` | portrait |
| `saturation > 0.5 && !isLowKey` | landscape |
| `dominantHues.length >= 3 && saturation > 0.3` | street, cinema |
| `isLowKey && isHighContrast && saturation > 0.2` | cinema |
| `warmth > 0.1 && saturation > 0.4` | everyday |
| fallback | everyday |

**Use case `bw` исключён из всех правил.** B&W рецепты не всплывают в Smart Picks автоматически. Доступ — через ручную группу Use → B&W.

Рецепт получает бонус, если его `RECIPE_USE_CASES[id]` попал в предпочтительные.

### Категория 2: Film simulation fit (~40%)

| Симуляция | Условие сценария для бонуса |
|---|---|
| Velvia | `saturation > 0.4` |
| Astia | `warmth > 0.2 && contrast < 0.4` |
| Acros, Neopan | (никаких — B&W исключены) |
| Classic Chrome | `saturation < 0.3` |
| Classic Neg | `dominantHues.length >= 3 && saturation > 0.2` |
| Pro 400H | `warmth > 0.2` |
| Eterna | `contrast > 0.3 && shadowsRatio > 0.1 && highlightsRatio > 0.1` (широкий tonal) |
| Superia | `warmth > 0.2 && saturation > 0.4` |
| Provia | малый фоновый бонус (нейтральная, для разнообразия) |

### Категория 3: Recipe-specific (~20%)

- `recipe.whiteBalanceKelvin` совпадает с `features.exif.colorTemperatureKelvin` (±500K) → бонус
- `recipe.dynamicRange === 'DR400'` && `features.highlightsRatio > 0.15` → бонус
- `recipe.grain.effect !== 'off'` && `features.exif.iso > 1600` → бонус

### Diversity filter (MMR-style)

1. Все рецепты получают score
2. Берём top-3N = 15 кандидатов
3. Жадно отбираем 5:
   - первый = max score
   - каждый следующий = `max(score - λ × similarity_to_selected)`
4. `similarity(a, b)` = `(same film ? 0.6 : 0) + (same use case ? 0.4 : 0)`
5. λ = 0.3 (умеренное разнообразие)

**Цель:** не показать 5 Velvia подряд. Получить mix из разных film simulations.

### Tie-breaking

При равных score — сортировка по `recipe.id` алфавитно. Гарантирует детерминированный output.

### Параметризация

Все веса категорий, пороги (saturation>0.4, warmth>0.3, λ=0.3 и т.д.) — в `src/engine/recommend/weights.ts`. Никаких магических чисел в `scorer.ts`.

### Reasons

`scorer.ts` возвращает `{ score: number; reasons: Reason[] }`, где `Reason = { factor: string; weight: number; label: string }`. Reasons собираются для:
1. Unit-тестов (легче assert'ить «правило применилось»)
2. Будущей фичи «почему» — фундамент готов, UI не делается в MVP

---

## UI

### Размещение

```
RecipePanel
├── Header (Films + Random)
├── Favorites
├── Smart Picks        ← новая секция
├── Editor's Choice    ← теперь и на mobile (фикс бага)
└── Groups (Film / Use)
```

Логика порядка: личное (Favorites) → контекстное (Smart Picks для фото) → курируемое (Editor's Choice) → каталог.

### Анатомия

- **Заголовок:** «Smart Picks» (uppercase tracking, как другие секции)
- **Иконка:** `Sparkles` из lucide-react
- **Счётчик:** «5» справа в стиле других секций
- **Cards:** ровно 5 `RecipeCard` без модификаций
- **Layout:** 2-col grid на desktop, горизонтальная лента на mobile

### States секции

| Состояние | Поведение |
|---|---|
| Нет фото | секция не рендерится |
| Анализ идёт | секция не рендерится (тишина <200ms, без скелетона) |
| Готово (`recipeIds.length === 5`) | 5 карточек |
| Worker error / fallback | секция не рендерится |
| Активный рецепт ∈ picks | стандартная подсветка `isActive` |
| `isMonochromatic` / video mode | секция не рендерится |

### Mobile (horizontal mode)

Та же ленточная структура, что у других секций — вертикальный card-pill с заголовком «Smart Picks» + 5 карточек. После Favorites/ApplyToAll, перед Editor's Choice.

### Editor's Choice on mobile (bug fix, включён в скоуп)

В `horizontal` ветке RecipePanel добавляется рендер `editorsChoiceRecipes.map(...)` в формате section с card-pill заголовком — копия структуры из vertical-ветки.

---

## Performance / lifecycle

### Worker

- Singleton — создаётся один раз через `useRef`, переиспользуется
- Thumbnail передаётся через структурированный клон (`postMessage` без transferable). Transferable detach сделал бы `thumbnail` недоступным в main thread, где он используется для preview-рендера. Стоимость клона на 1600px (~10MB Uint8ClampedArray): 2-5ms, не блокирует

### Cache

- Memory-only LRU по `ImageItem.id`
- Ключ: imageId (string), значение: `string[]` (5 recipe id)
- Max size: 20 записей
- Реализация: `useRef<Map>` внутри хука

### Lifecycle

```
mount → создать worker, создать cache
↓
imageId изменился → debounce 200ms → cache lookup
  → hit: setState немедленно
  → miss: postMessage в worker (старые requestId считаются stale)
    → on result: validate requestId → setState + cache.set
↓
unmount → terminate worker
```

### Performance budget

| Операция | Цена |
|---|---|
| Создание worker | ~5ms (один раз) |
| Клон thumbnail в worker (1600px ≈10MB) | 2-5ms |
| Analyzer (1600px thumbnail) | 5-15ms |
| Scorer (100 рецептов × 3 категории) | <1ms |
| Diversity filter | <1ms |
| **Wall time** | **~15-25ms p50** |

При debounce 200ms и compute <25ms — секция появляется почти моментально без видимого скелетона.

### Триггеры пересчёта

- Загрузка фото
- Смена активного фото (multi-image)
- **НЕ** на crop / rotate / tuning / применение рецепта

---

## Edge cases

| Сценарий | Поведение |
|---|---|
| Фото < 256px по короткой стороне | Analyzer считает с уменьшенным subsample, рекомендации могут быть менее точны — приемлемо |
| Нет EXIF | `features.exif = undefined`, recipe-specific factors не применяются |
| `isMonochromatic` (saturation<0.1) | **Секция не рендерится.** Guard в `recommend.ts` возвращает `[]` |
| Multi-image: быстрая смена фото | `requestId` отсекает stale-результаты; cache по `ImageItem.id` сразу отдаёт уже посчитанное |
| Активный рецепт ∈ picks | Стандартная подсветка `isActive` |
| Активный рецепт ∉ picks | Picks показывает свои 5, активный виден в Favorites или ниже |
| Apply to All + Picks | Разные фичи, не интегрируются |
| **Video mode** | **Секция не рендерится.** Follow-up |
| Скриншот / документ | Analyzer вернёт features, picks могут предложить неожиданное — нецелевой кейс |
| Гигантское фото (>10MB) | Thumbnail (1600px) уже срезает до попадания в worker |
| Worker не создался | log warn один раз, секция не рендерится |
| Worker exception | `{type: 'error'}`, секция не рендерится, worker не пересоздаётся |
| StrictMode перерендер | Worker через `useRef` переживает re-render |

---

## Testing

### Unit: analyzer (`__tests__/analyzer.test.ts`)

Синтетические `ImageData` через хелпер `createTestImageData(width, height, fillFn)` — без PNG-фикстур.

| Фикстура | Проверяем |
|---|---|
| Полностью белая | brightness=1, contrast=0, highlightsRatio=1, saturation=0, isHighKey=true |
| Полностью чёрная | brightness=0, shadowsRatio=1, isLowKey=true |
| Полностью красная | warmth>0.5, saturation=1, dominantHues[0].hue≈0 |
| Шахматка чёрный/белый | brightness≈0.5, isHighContrast=true |
| Радужный градиент | dominantHues — несколько с близкими весами |
| EXIF ISO=3200, WB=6500K | features.exif заполнен |

### Unit: scorer (`__tests__/scorer.test.ts`)

| Features (прототип) | Recipe | Ожидание |
|---|---|---|
| warm portrait | astia-portrait | score>0, reasons содержит use case + film бонусы |
| warm portrait | acros-* | score=0 (B&W исключён) |
| saturated landscape | velvia-* | score>0 |
| saturated landscape | astia-portrait | ≈0 |
| highISO + grain в рецепте | recipe with grain | recipe-specific бонус применён |
| EXIF Kelvin=5300 + recipe.whiteBalanceKelvin=5300 | match-бонус | применён |

Каждое правило в weights.ts имеет минимум 1 положительный + 1 отрицательный тест.

### Unit: recommend (`__tests__/recommend.test.ts`)

```ts
test('monochromatic input returns empty array')
test('warm portrait returns at least 1 portrait/everyday recipe in top 5')
test('top 5 contain at least 3 different film simulations')
test('result deterministic — same input → same output')
test('B&W recipes never appear in non-empty output')
```

### E2E (`e2e/editor-smart-picks.spec.ts`)

```ts
test('Smart Picks section appears after loading a color photo')
test('Smart Picks contains exactly 5 cards')
test('Clicking Smart Picks card applies the recipe')
test('Switching between images updates Smart Picks')
```

Mobile project:
```ts
test('Smart Picks visible in horizontal mobile scroll')
test('Editor\'s Choice visible in horizontal mobile scroll')  // bug fix
```

### Не тестируем

- Внутреннюю механику worker (create/terminate)
- LRU eviction в cache
- Performance budgets — один ручной бенчмарк после имплементации, без CI assertion
- Качество рекомендаций «на глаз» — субъективно

---

## Files affected

**Новые:**
- `src/engine/recommend/analyzer.ts`
- `src/engine/recommend/features.ts`
- `src/engine/recommend/scorer.ts`
- `src/engine/recommend/recommend.ts`
- `src/engine/recommend/weights.ts`
- `src/engine/recommend/recommend.worker.ts`
- `src/engine/recommend/__tests__/analyzer.test.ts`
- `src/engine/recommend/__tests__/scorer.test.ts`
- `src/engine/recommend/__tests__/recommend.test.ts`
- `src/hooks/useRecipeRecommendations.ts`
- `e2e/editor-smart-picks.spec.ts`

**Модифицируемые:**
- `src/components/RecipePanel.tsx` — добавить Smart Picks секцию (desktop + mobile); добавить Editor's Choice в mobile horizontal-ветке
- `src/components/Editor.tsx` — вызвать `useRecipeRecommendations(currentImage.id, currentImage.thumbnail, currentImage.exif)` и пробросить `recipeIds` в RecipePanel через новый prop `smartPicksIds?: string[]`
- `src/hooks/useImageProcessor.ts` — в `loadImages` извлекать EXIF из File через piexifjs и сохранять в `ImageItem.exif`
- `src/engine/types.ts` — добавить поле `exif?: ExifSubset` в `ImageItem`; экспортировать `ExifSubset` (re-export из engine/recommend/features.ts или дублирующее определение, по фактору простоты)
- `package.json` — версия 1.4 → 1.5
- `src/constants.ts` — `APP_VERSION` 1.4 → 1.5
- `src/components/HelpDialog.tsx` — добавить запись в WHATS_NEW для 1.5: «Smart Picks: рекомендации рецептов по содержимому фото»

**Не трогаем:**
- `src/engine/processor.ts`, `processor.worker.ts`, `color.ts`, `curves.ts`, `effects.ts`, `grain.ts`, `haldclut.ts`, `transform.ts`, `video.ts`, `webgl/*`, `safari-export.ts`
- `src/presets/simulations/*`, `src/presets/recipes/*`
- `src/components/Preview.tsx`, `TuningPanel.tsx`, `CropPanel.tsx`, `VideoEditor.tsx`, `Toolbar.tsx`, `RecipeCard.tsx`, `ThumbnailStrip.tsx`

---

## Success criteria

1. Загрузка цветного фото → секция «Smart Picks» с 5 карточками появляется в верхней части RecipePanel в течение ~250ms после готовности thumbnail (200ms debounce + <25ms compute)
2. Загрузка ч/б фото → секция не появляется
3. Видео-режим → секция не появляется
4. Multi-image: переключение между фото обновляет picks
5. Возврат к ранее открытому фото в той же сессии — cache HIT, моментально
6. На mobile в горизонтальной ленте видны и Smart Picks, и Editor's Choice
7. Unit-тесты analyzer, scorer, recommend проходят
8. E2E тесты для desktop + mobile проходят
9. `npm run build` проходит без ошибок
10. Bundle size не увеличивается значимо (< 10 KB gzipped прирост, поскольку без ML)
