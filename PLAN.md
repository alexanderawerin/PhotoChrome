# Photochrome — Веб-MVP

## Стек и архитектура

**Frontend:** React + shadcn/ui + Tailwind CSS
- shadcn/ui: Button, Card, Slider, Select, Tabs, ToggleGroup, Dialog
- Tailwind + dark mode (дефолтный монохром shadcn)
- Vite + TypeScript
- Движок (engine) отделён от UI — портируется на Android

**Структура проекта:**
```
/src/
├── engine/
│   ├── processor.ts         # Ядро обработки
│   ├── curves.ts            # Тональные кривые
│   ├── color.ts             # Цветокоррекция
│   ├── grain.ts             # Зерно
│   ├── effects.ts           # Clarity, Sharpness
│   └── transform.ts         # Поворот, crop
├── presets/
│   ├── simulations/         # Базовые симуляции
│   └── recipes/             # Готовые рецепты
├── components/
│   ├── ui/                  # shadcn/ui
│   ├── LandingScreen.tsx    # Стартовый экран (empty state)
│   ├── PhotoArc.tsx         # Карусель-арка с примерами
│   ├── Editor.tsx           # Главный layout редактора
│   ├── Preview.tsx          # Большое фото по центру
│   ├── RecipePanel.tsx      # Панель пресетов справа
│   ├── RecipeCard.tsx       # Карточка с live preview
│   ├── Toolbar.tsx          # Инструменты внизу
│   ├── CropTool.tsx         # Crop с пресетами
│   ├── AdvancedPanel.tsx    # Ползунки настроек
│   └── ExportButton.tsx
└── hooks/
    └── useImageProcessor.ts
```

---

## Стартовый экран (Empty State)

**Референс:** Gather-style арка из карточек

```
          ┌───┐  ┌───┐  ┌───┐
        ┌───┐      ┌───┐      ┌───┐
      ┌───┐                      ┌───┐
    
              Photochrome
         Плёночные симуляции Fujifilm
              для любых фото

            [ Загрузить фото ]
```

**Элементы:**
- Арка/полукруг из карточек с примерами обработанных фото
- Каждая карточка — пример результата одного из рецептов
- По центру: название, короткое описание, кнопка загрузки
- Анимация: лёгкое покачивание или rotation карточек
- Тёмный фон (dark mode shadcn)

**Компонент PhotoArc:**
- CSS transform для расположения карточек полукругом
- Примеры фото с разными рецептами (статичные, заготовленные заранее)

---

## UI Layout — Редактор (после загрузки)

```
┌─────────────────────────────────────────────────────────┐
│                        Header                           │
├───────────────────────────────────────────┬─────────────┤
│                                           │  Рецепты    │
│                                           │  ┌───────┐  │
│              Большое фото                 │  │ prev1 │  │
│              (Preview)                    │  ├───────┤  │
│                                           │  │ prev2 │  │
│                                           │  ├───────┤  │
│                                           │  │ prev3 │  │
│                                           │  └───────┘  │
├───────────────────────────────────────────┴─────────────┤
│  [Rotate] [Crop] [Advanced]           [Export]          │
└─────────────────────────────────────────────────────────┘
```

- **Центр:** большое превью загруженного фото
- **Справа:** панель рецептов (карточки с live preview твоего фото)
- **Внизу:** toolbar с инструментами

---

## Инструменты редактирования

**Поворот:** 90° по часовой / против часовой

**Crop:**
- Пресеты: 1:1, 4:3, 3:4, 16:9, 9:16, Free
- Draggable область на фото
- Apply / Cancel

---

## Рецепты Fujifilm

**Рецепт** = Базовая симуляция + Параметры настройки

**Параметры:**
| Параметр | Значения |
|----------|----------|
| Film Simulation | Classic Neg, Provia, Velvia, Classic Chrome... |
| Dynamic Range | DR100, DR200, DR400 |
| Highlight / Shadow | -2 ... +4 |
| Color | -4 ... +4 |
| Sharpness / Clarity | -4 ... +4 |
| Grain Effect | Off, Weak, Strong |
| Color Chrome Effect | Off, Weak, Strong |
| WB Shift Red/Blue | -9 ... +9 |

**Live Preview:** карточки показывают твоё фото с применённым рецептом

**Формат рецепта (JSON):**
```json
{
  "id": "maple-letter",
  "name": "Maple Letter",
  "filmSimulation": "classic-neg",
  "settings": {
    "dynamicRange": "DR400",
    "highlight": -1.5,
    "shadow": -1.5,
    "color": 3,
    "sharpness": 1,
    "grainEffect": "off",
    "colorChromeEffect": "strong",
    "wbShiftRed": 2,
    "wbShiftBlue": -3
  }
}
```

---

## Флоу пользователя

1. **Стартовый экран:** арка из примеров + кнопка "Загрузить фото"
2. Загрузил фото → переход в Editor
3. Карточки рецептов с live preview твоего фото
4. Клик на карточку → применяет рецепт
5. Rotate / Crop / Advanced настройки
6. Export → скачивание

---

## Исследование

**Задачи:**
- GitHub: реализации симуляций (кривые, LUT)
- Fuji X Weekly, FUJISTYLE, r/FujifilmSimulations — сбор рецептов
- Эмуляция Color Chrome Effect, Dynamic Range

**Источники:**
- darktable / RawTherapee профили
- LUT-файлы (.cube)
- GitHub: "fujifilm simulation", "film emulation"

---

## Этапы реализации

### Этап 0: Исследование
- [ ] Поиск реализаций симуляций на GitHub
- [ ] Сбор рецептов из Fuji X Weekly, FUJISTYLE

### Этап 1: Инфраструктура
- [ ] Vite + React + TS + Tailwind + shadcn

### Этап 2: Движок
- [ ] Базовые симуляции (кривые, цвет)
- [ ] Параметры рецепта
- [ ] Поворот и crop

### Этап 3: Стартовый экран
- [ ] LandingScreen + PhotoArc (арка из примеров)
- [ ] Кнопка загрузки файла

### Этап 4: Editor layout
- [ ] Preview, RecipePanel, RecipeCard с live preview
- [ ] Toolbar, ExportButton

### Этап 5: Инструменты
- [ ] Rotate, CropTool с пресетами

### Этап 6: Продвинутый режим
- [ ] AdvancedPanel — ползунки параметров

---

## Перспектива: Android

- Те же JSON-рецепты
- Kotlin + тот же движок
- Общая база рецептов между платформами

