# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Команды разработки

```bash
npm run dev        # Dev сервер (Vite с hot reload)
npm run build      # Сборка: tsc -b && vite build
npm run lint       # ESLint проверка
npm run preview    # Просмотр продакшен сборки
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
├── engine/         # Движок обработки (портируемый)
│   ├── processor.ts    # ImageProcessor — главный класс
│   ├── curves.ts       # Тональные кривые
│   ├── color.ts        # Цветокоррекция, баланс белого
│   ├── grain.ts        # Плёночное зерно
│   ├── effects.ts      # Clarity, Sharpness, Color Chrome
│   ├── transform.ts    # Поворот, crop
│   ├── video.ts        # Обработка видео (frame extraction)
│   └── webgl/          # GPU-ускорение для видео
├── presets/
│   ├── simulations/    # Базовые симуляции Fujifilm (JSON)
│   └── recipes/        # Готовые рецепты (JSON)
├── components/     # React UI
└── hooks/          # React хуки с бизнес-логикой
```

### Поток данных

```
File Upload → useImageProcessor (загрузка, thumbnail)
    → Editor (оркестрация)
        → RecipePanel/RecipeCard (выбор рецепта с live preview)
        → useTransform (rotation, crop)
        → useTuning (тонкая настройка)
    → Preview (отображение обработанного ImageData)
    → Export (canvas → JPEG/PNG)
```

### Система рецептов

**Симуляция** (`/src/presets/simulations/`) — базовая плёнка:
- Тональная кривая, цветовой баланс, базовая насыщенность
- 10 типов: Provia, Velvia, Astia, Pro 400H, Superia, Acros, Neopan, Eterna, Classic Chrome, Classic Neg

**Рецепт** (`/src/presets/recipes/`) — симуляция + настройки:
- highlight/shadow, color, sharpness, clarity, grain, color chrome, WB shift

### Порядок обработки в ImageProcessor.process()

1. Тональная кривая (из симуляции)
2. Цветовой баланс (из симуляции)
3. Базовая насыщенность (из симуляции)
4. Настройки рецепта: highlight/shadow → saturation → WB shift → color chrome → grain → clarity → sharpness

### Видео обработка

- WebGL для GPU-ускорения (`/src/engine/webgl/`)
- mp4-muxer для кодирования
- Отдельный fallback для Safari через MediaRecorder (`safari-export.ts`)

## Важные константы

Все магические числа в `/src/constants.ts`:
- `THUMBNAIL_MAX_SIZE = 1600` — размер превью для редактора
- `RECIPE_CARD_PREVIEW_SIZE = 250` — превью в карточках рецептов
- `KEYBOARD_SHORTCUTS` — горячие клавиши (R, C, Space, Ctrl+S)

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
  "filmSimulation": "provia", // ID симуляции
  "settings": {
    "highlight": 0, "shadow": 0,
    "color": 0, "sharpness": 0, "clarity": 0,
    "grainEffect": "off",
    "colorChromeEffect": "off",
    "wbShiftRed": 0, "wbShiftBlue": 0
  }
}
```
