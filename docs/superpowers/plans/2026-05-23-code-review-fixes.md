# Code Review Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Устранить 5 замечаний из code review обновления v1.2.0 (100 рецептов + Kelvin WB).

**Architecture:** Точечные хирургические правки в 5 файлах. Нет новых абстракций, нет рефакторинга. E2E-тест добавляется в существующий `editor-kelvin-wb.spec.ts`.

**Tech Stack:** TypeScript, React, Playwright E2E

---

### Task 1: Fix tsconfig — exclude test files from build

**Files:**
- Modify: `tsconfig.json`

**Problem:** `src/engine/whitebalance.test.ts` попадает в `"include": ["src"]`, из-за чего `tsc -b` не может разрешить тип `vitest` при `npm run build` в fresh checkout (CI).

- [ ] **Step 1: Add exclude to tsconfig.json**

Заменить:
```json
  "include": ["src"]
}
```
На:
```json
  "include": ["src"],
  "exclude": ["src/**/*.test.ts"]
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```
Expected: exit 0, no TypeScript errors about `vitest`.

- [ ] **Step 3: Verify tests still run**

```bash
npm test
```
Expected: `5 tests passed`.

- [ ] **Step 4: Commit**

```bash
git add tsconfig.json
git commit -m "fix(build): exclude test files from tsconfig to fix CI build"
```

---

### Task 2: Fix phantom recipe ID in RECIPE_USE_CASES

**Files:**
- Modify: `src/presets/recipes/index.ts:444`

**Problem:** `'superia-everyday': 'everyday'` — такого JSON-файла нет. При этом существующий `astia-everyday.json` (и `import` на строке 35) не имеет записи в `RECIPE_USE_CASES`, хотя рецепт уже зарегистрирован в `RAW_RECIPES`.

- [ ] **Step 1: Replace phantom entry**

В `src/presets/recipes/index.ts` найти строку 444:
```ts
  'superia-everyday': 'everyday',
```
Заменить на:
```ts
  'astia-everyday': 'everyday',
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/presets/recipes/index.ts
git commit -m "fix(recipes): replace phantom superia-everyday with astia-everyday in RECIPE_USE_CASES"
```

---

### Task 3: Hoist 5500K reference to module-level constant

**Files:**
- Modify: `src/engine/color.ts:133-136`

**Problem:** `applyWhiteBalanceKelvin` вызывает `kelvinToRGBMultipliers(5500)` при каждом вызове. Значение константно — нет смысла пересчитывать.

- [ ] **Step 1: Add module-level constant and update function**

В `src/engine/color.ts`, непосредственно перед функцией `applyWhiteBalanceKelvin` (строка 133), добавить константу и убрать вычисление из тела функции:

```ts
const WB_REF_5500K = kelvinToRGBMultipliers(5500)

/**
 * Applies white balance correction based on a color temperature in Kelvin.
 * Uses Tanner Helland's approximation. Kelvin range: 2500-10000.
 */
export function applyWhiteBalanceKelvin(imageData: ImageData, kelvin: number): void {
  const [rMult, , bMult] = kelvinToRGBMultipliers(kelvin)
  // Normalize relative to 5500K (daylight neutral)
  const [rRef, , bRef] = WB_REF_5500K
  const rScale = rMult / rRef
  const bScale = bMult / bRef

  const data = imageData.data
  for (let i = 0; i < data.length; i += 4) {
    data[i]     = Math.max(0, Math.min(255, data[i]     * rScale))
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] * bScale))
  }
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/engine/color.ts
git commit -m "perf: hoist 5500K WB reference to module-level constant in color.ts"
```

---

### Task 4: Add role="tablist" to HelpDialog tab container

**Files:**
- Modify: `src/components/HelpDialog.tsx:95`

**Problem:** Кнопки с `role="tab"` должны быть обёрнуты в контейнер с `role="tablist"` — иначе семантика ARIA неполна.

- [ ] **Step 1: Add role="tablist" to wrapper div**

В `src/components/HelpDialog.tsx` строка 95, заменить:
```tsx
        <div className="flex border-b border-zinc-800 mt-4">
```
На:
```tsx
        <div className="flex border-b border-zinc-800 mt-4" role="tablist">
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/HelpDialog.tsx
git commit -m "fix(a11y): add role=tablist to HelpDialog tab container"
```

---

### Task 5: Add E2E test for Kelvin-override scenario

**Files:**
- Modify: `e2e/editor-kelvin-wb.spec.ts`

**Problem:** Ключевой сценарий из фикса `5967755` не покрыт тестом: рецепт с `whiteBalanceKelvin` в настройках, пользователь явно переключается на WB-пресет → kelvin не должен применяться. Используем рецепт `classic-color` (содержит `whiteBalanceKelvin: 5300`).

- [ ] **Step 1: Add test to editor-kelvin-wb.spec.ts**

Добавить в конец описания `test.describe('Editor — Kelvin White Balance', ...)`, перед закрывающей `})`:

```ts
  test('recipe with kelvin WB: switching to preset mode disables kelvin', async ({ page, editorPage }) => {
    // Select Classic Color — a recipe that has whiteBalanceKelvin: 5300
    const classicColorCard = page.locator('aside [aria-label="Apply preset Classic Color"]')
    await classicColorCard.click()
    await page.locator('aside [aria-label="Apply preset Classic Color, selected"]').waitFor({ state: 'visible', timeout: 10_000 })

    // Open tuning panel for this recipe
    await page.locator('[aria-label^="Tune "]').first().click()
    await expect(tuningOverlay(page)).toHaveClass(/tuning-panel-open/)

    const panel = tuningOverlay(page)

    // Recipe has whiteBalanceKelvin — panel should start in Kelvin mode
    await expect(panel.locator('#slider-kelvin')).toBeVisible()

    // Switch to Preset mode explicitly
    await panel.getByRole('button', { name: 'White Balance Preset mode' }).click()

    // Kelvin slider must disappear and preset buttons must be visible
    await expect(panel.locator('#slider-kelvin')).not.toBeVisible()
    await expect(panel.getByText('Auto')).toBeVisible()
  })
```

- [ ] **Step 2: Run the new test to verify it passes**

```bash
npx playwright test e2e/editor-kelvin-wb.spec.ts --project=chromium
```
Expected: 4 passed (3 existing + 1 new).

- [ ] **Step 3: Commit**

```bash
git add e2e/editor-kelvin-wb.spec.ts
git commit -m "test(e2e): add kelvin-to-preset override scenario for classic-color recipe"
```

---

## Verification

После всех 5 задач:

```bash
npm run build   # exit 0, no tsc errors
npm test        # 5 unit tests passed
npx playwright test e2e/editor-kelvin-wb.spec.ts --project=chromium  # 4 passed
```
