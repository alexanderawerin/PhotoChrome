import { useEffect, useCallback } from 'react'
import { Recipe } from '../engine/types'
import { AspectRatio } from '../engine/transform'

interface KeyboardShortcutsConfig {
  /** Режим обрезки активен */
  isCropping: boolean
  /** Режим тюнинга активен */
  isTuning: boolean
  /** Текущее соотношение сторон */
  cropRatio: AspectRatio
  /** Активный рецепт */
  activeRecipe: Recipe | null
  /** Общее количество изображений */
  totalImages?: number
}

interface KeyboardShortcutsHandlers {
  /** Поворот по часовой */
  onRotateClockwise: () => void
  /** Поворот против часовой */
  onRotateCounterClockwise: () => void
  /** Открыть обрезку */
  onCropOpen: () => void
  /** Отменить обрезку */
  onCropCancel: () => void
  /** Применить обрезку */
  onCropApply: () => void
  /** Открыть/закрыть тюнинг */
  onTuningToggle: () => void
  /** Отменить тюнинг */
  onTuningCancel: () => void
  /** Применить тюнинг */
  onTuningApply: () => void
  /** Переключить панель */
  onPanelToggle: () => void
  /** Экспорт */
  onExport: () => void
  /** Начать сравнение (показать оригинал) */
  onCompareStart: () => void
  /** Закончить сравнение (показать обработанное) */
  onCompareEnd: () => void
  /** Следующее изображение */
  onNextImage?: () => void
  /** Предыдущее изображение */
  onPreviousImage?: () => void
}

/**
 * Хук для управления горячими клавишами редактора.
 * Централизует всю логику keyboard shortcuts в одном месте.
 * 
 * Shortcuts:
 * - R: Поворот по часовой
 * - Shift+R: Поворот против часовой
 * - C: Открыть обрезку
 * - T: Открыть/закрыть тюнинг
 * - P: Переключить панель
 * - Escape: Отмена (crop/tuning)
 * - Enter: Применить (crop/tuning)
 * - Space: Сравнение до/после (hold)
 * - Cmd/Ctrl+S: Экспорт
 */
export function useKeyboardShortcuts(
  config: KeyboardShortcutsConfig,
  handlers: KeyboardShortcutsHandlers
): void {
  const {
    isCropping,
    isTuning,
    cropRatio,
    activeRecipe,
    totalImages = 1,
  } = config

  const {
    onRotateClockwise,
    onRotateCounterClockwise,
    onCropOpen,
    onCropCancel,
    onCropApply,
    onTuningToggle,
    onTuningCancel,
    onTuningApply,
    onPanelToggle,
    onExport,
    onCompareStart,
    onCompareEnd,
    onNextImage,
    onPreviousImage,
  } = handlers

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Игнорируем если фокус в текстовом поле
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return
    }

    const key = e.key.toLowerCase()

    switch (key) {
      case 'r':
        if (!isCropping && !isTuning) {
          if (e.shiftKey) {
            onRotateCounterClockwise()
          } else {
            onRotateClockwise()
          }
        }
        break

      case 'c':
        if (!e.metaKey && !e.ctrlKey && !isCropping && !isTuning) {
          onCropOpen()
        }
        break

      case 't':
        if (!e.metaKey && !e.ctrlKey && !isCropping && activeRecipe) {
          onTuningToggle()
        }
        break

      case 'p':
        if (!e.metaKey && !e.ctrlKey) {
          onPanelToggle()
        }
        break

      case 'arrowleft':
        // Навигация к предыдущему изображению
        if (!isCropping && !isTuning && totalImages > 1 && onPreviousImage) {
          e.preventDefault()
          onPreviousImage()
        }
        break

      case 'arrowright':
        // Навигация к следующему изображению
        if (!isCropping && !isTuning && totalImages > 1 && onNextImage) {
          e.preventDefault()
          onNextImage()
        }
        break

      case 'escape':
        if (isCropping) {
          onCropCancel()
        } else if (isTuning) {
          onTuningCancel()
        }
        break

      case 'enter':
        if (isCropping && cropRatio !== 'free') {
          onCropApply()
        } else if (isTuning) {
          onTuningApply()
        }
        break

      case ' ':
        if (activeRecipe && !isCropping && !isTuning) {
          e.preventDefault()
          onCompareStart()
        }
        break

      case 's':
        if ((e.metaKey || e.ctrlKey) && activeRecipe) {
          e.preventDefault()
          onExport()
        }
        break
    }
  }, [
    isCropping,
    isTuning,
    cropRatio,
    activeRecipe,
    onRotateClockwise,
    onRotateCounterClockwise,
    onCropOpen,
    onCropCancel,
    onCropApply,
    onTuningToggle,
    onTuningCancel,
    onTuningApply,
    onPanelToggle,
    onExport,
    onCompareStart,
    onCompareEnd,
    onNextImage,
    onPreviousImage,
    totalImages,
  ])

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.key === ' ') {
      onCompareEnd()
    }
  }, [onCompareEnd])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [handleKeyDown, handleKeyUp])
}

