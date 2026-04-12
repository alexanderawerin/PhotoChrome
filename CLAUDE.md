# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Команды разработки

```bash
npm run dev            # Dev сервер (Vite с hot reload)
npm run build          # Сборка: tsc -b && vite build
npm run lint           # ESLint проверка
npm run preview        # Просмотр продакшен сборки
npm run test:e2e       # E2E тесты (Playwright, все браузеры)
npm run test:e2e:chromium  # E2E тесты только Chromium (быстрый фидбек)
npm run test:e2e:ui    # Playwright UI-режим (интерактивная отладка)
```

## Архитектура

**Photochrome** — веб-редактор для эмуляции плёночных симуляций Fujifilm. Вся обработка происходит в браузере.

### Ключевой принцип: отделение движка от UI

Движок (`/src/engine/`) полностью независим от React:
- Работает с `ImageData` и Canvas API
- Написан на чистом TypeScript без зависимостей от React
- Предназначен для портирования на другие платформы (Android)

```
src/
├── engine/                  # Движок обработки (портируемый)
│   ├── processor.ts         # ImageProcessor — главный класс
│   ├── processor.worker.ts  # Web Worker для async экспорта
│   ├── curves.ts            # Тональные кривые
│   ├── color.ts             # Цветокоррекция, баланс белого, DR
│   ├── grain.ts             # Плёночное зерно
│   ├── effects.ts           # Clarity, Sharpness, Color Chrome
│   ├── transform.ts         # Поворот, crop (с offset)
│   ├── video.ts             # Обработка видео (frame extraction)
│   └── webgl/               # GPU-ускорение (фото + видео)
│       ├── processor.ts     # WebGLProcessor + getPhotoWebGLProcessor()
│       └── shaders/         # base.vert, film.frag, blur.frag, sharpen.frag
├── presets/
│   ├── simulations/         # Базовые симуляции Fujifilm (JSON)
│   └── recipes/             # Готовые рецепты (JSON)
├── components/              # React UI
└── hooks/                   # React хуки с бизнес-логикой
```

### Поток данных

```
File Upload → useImageProcessor (загрузка, thumbnail)
    → Editor (оркестрация)
        → RecipePanel/RecipeCard (выбор рецепта с live preview)
        → useTransform (rotation, crop с draggable offset)
        → useTuning (тонкая настройка)
    → Preview (отображение обработанного ImageData)
    → Export (processAsync → Worker → JPEG + EXIF)
```

### Система рецептов

**Симуляция** (`/src/presets/simulations/`) — базовая плёнка:
- Тональная кривая, цветовой баланс, базовая насыщенность
- 10 типов: Provia, Velvia, Astia, Pro 400H, Superia, Acros, Neopan, Eterna, Classic Chrome, Classic Neg

**Рецепт** (`/src/presets/recipes/`) — симуляция + настройки:
- highlight/shadow, color, sharpness, clarity, grain, color chrome, WB shift
- dynamicRange (DR100/DR200/DR400), whiteBalance (пресеты), wbShiftRed/Blue

### Порядок обработки в ImageProcessor.process()

1. **Pre-step (CPU):** Dynamic Range (`applyDynamicRange`) — поднятие теней
2. **Pre-step (CPU):** White Balance preset (`applyWhiteBalancePreset`) — температурный сдвиг
3. **WebGL path** (если изображение ≤ 4096px): всё остальное через GPU-шейдер
4. **CPU fallback**: тональная кривая → цветовой баланс → насыщенность → highlight/shadow → saturation → WB shift → color chrome → grain → clarity → sharpness

### Асинхронный экспорт (Web Worker)

`ImageProcessor.processAsync(imageData, options)` — передаёт `ImageData` в `processor.worker.ts` через `Transferable` (zero-copy). Используется при экспорте, чтобы не блокировать UI. Worker выполняет полный CPU-pipeline.

### WebGL для фото

Отдельный singleton `getPhotoWebGLProcessor()` (не пересекается с видео). Используется для изображений ≤ 4096px. При инициализации важно: `UNPACK_FLIP_Y_WEBGL = 1` обязательно для всех типов источников (ImageData, Canvas, Video) — иначе изображение рендерится перевёрнутым.

### Draggable crop

`cropOffset: { x, y }` в `useTransform` (0..1, 0.5 = центр). `CropOverlay` обрабатывает Pointer Events и вызывает `onOffsetChange`. При применении кропа используется `calculateCropAreaWithOffset` из `transform.ts`.

### EXIF при экспорте

`ImageProcessor.imageDataToBlob(imageData, quality, exifInfo?)` — записывает название рецепта и настройки в EXIF через `piexifjs`. При ошибке (например, браузер не поддерживает `readAsBinaryString`) молча возвращает blob без EXIF.

### Видео обработка

- WebGL для GPU-ускорения (`/src/engine/webgl/`)
- mp4-muxer для кодирования
- Отдельный fallback для Safari через MediaRecorder (`safari-export.ts`)

## Важные константы

Все магические числа в `/src/constants.ts`:
- `THUMBNAIL_MAX_SIZE = 1600` — размер превью для редактора
- `RECIPE_CARD_PREVIEW_SIZE = 250` — превью в карточках рецептов
- `KEYBOARD_SHORTCUTS` — горячие клавиши (R, C, Space, Ctrl+S)

## E2E тестирование (Playwright)

Тесты в `/e2e/`, конфигурация в `playwright.config.ts`. Три проекта: Chromium, Firefox, Mobile Chrome.

```
e2e/
├── fixtures/               # Тестовые изображения (генерируются через generate.mjs)
├── helpers/
│   ├── fixtures.ts         # Кастомные fixtures (landingPage, editorPage, multiImageEditorPage)
│   └── upload.ts           # uploadImage(), waitForEditor(), selectFirstRecipe()
├── landing.spec.ts         # Стартовый экран, загрузка, навигация
├── editor-basic.spec.ts    # UI элементы, рецепты, панели
├── editor-export.spec.ts   # Экспорт (download, Ctrl+S)
├── editor-transform.spec.ts # Поворот, crop mode
├── editor-tuning.spec.ts   # Tuning panel (open/close, слайдеры)
├── editor-multi-image.spec.ts # Thumbnails, навигация стрелками
└── keyboard-shortcuts.spec.ts # R, C, Escape, T, Enter
```

**Важно при написании тестов:**
- Desktop и mobile layout рендерятся одновременно (CSS `hidden md:block` / `md:hidden`). Для desktop-элементов использовать точные aria-labels (например, `[aria-label="Rotate clockwise (R)"]` вместо `[aria-label*="Rotate"]`) или скоупить в `aside` / `.tuning-panel-overlay`
- Tuning panel скрывается через `translateX(100%)`, а не `display: none` — проверять CSS-класс `tuning-panel-closed` вместо visibility
- Recipe карточки: скоупить в `aside` для desktop (мобильный `RecipePanel` рендерится раньше в DOM)

## Стилизация

- shadcn/ui с тёмной монохромной темой
- Tailwind CSS с CSS-переменными для цветов (HSL)
- Компоненты UI в `/src/components/ui/`

## Добавление нового рецепта

1. Создать JSON в `/src/presets/recipes/[name].json`
2. Импортировать в `/src/presets/recipes/index.ts`
3. Структура:
```json
{
  "id": "unique-id",
  "name": "Display Name",
  "filmSimulation": "provia",
  "settings": {
    "dynamicRange": "DR400",
    "highlight": 0, "shadow": 0,
    "color": 0, "sharpness": 0, "clarity": 0,
    "grainEffect": "off",
    "colorChromeEffect": "off",
    "wbShiftRed": 0, "wbShiftBlue": 0
  }
}
```
