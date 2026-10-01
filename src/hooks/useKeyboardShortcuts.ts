import { useEffect, useCallback } from 'react'
import type { EditorCommands } from '../engine/editor-commands'

interface KeyboardShortcutsConfig {
  commands: EditorCommands
  /** Режим обрезки активен */
  isCropping: boolean
  /** Режим тюнинга активен */
  isTuning: boolean
  /** Общее количество изображений */
  totalImages?: number
}

interface KeyboardShortcutsHandlers {
  /** Поворот по часовой */
  onRotateClockwise: () => void
  /** Поворот против часовой */
  onRotateCounterClockwise: () => void
  /** Отразить изображение горизонтально */
  onFlipHorizontal: () => void
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
 * - F: Отразить горизонтально
 * - ArrowLeft/ArrowRight: Предыдущее/следующее фото
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
  handlers: KeyboardShortcutsHandlers,
  enabled = true
): void {
  const {
    commands,
    isCropping,
    isTuning,
    totalImages = 1,
  } = config

  const {
    onRotateClockwise,
    onRotateCounterClockwise,
    onFlipHorizontal,
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
    if (e.defaultPrevented) return
    // Игнорируем если фокус в текстовом поле
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return
    }

    const key = e.key.toLowerCase()
    const isSliderFocused = e.target instanceof HTMLElement && e.target.closest('[role="slider"]') !== null
    if ((key === 'enter' || key === ' ') && e.target instanceof HTMLElement && e.target.closest('button, [role="button"], [role="tab"]')) return

    switch (key) {
      case 'r':
        if (commands.geometry) {
          if (e.shiftKey) {
            onRotateCounterClockwise()
          } else {
            onRotateClockwise()
          }
        }
        break

      case 'c':
        if (!e.metaKey && !e.ctrlKey && commands.geometry) {
          onCropOpen()
        }
        break

      case 'f':
        if (!e.metaKey && !e.ctrlKey && commands.geometry) {
          onFlipHorizontal()
        }
        break

      case 't':
        if (!e.metaKey && !e.ctrlKey && commands.advanced) {
          onTuningToggle()
        }
        break

      case 'p':
        if (!e.metaKey && !e.ctrlKey && commands.panel) {
          onPanelToggle()
        }
        break

      case 'arrowleft':
        // Навигация к предыдущему изображению
        if (!isSliderFocused && commands.navigate && totalImages > 1 && onPreviousImage) {
          e.preventDefault()
          onPreviousImage()
        }
        break

      case 'arrowright':
        // Навигация к следующему изображению
        if (!isSliderFocused && commands.navigate && totalImages > 1 && onNextImage) {
          e.preventDefault()
          onNextImage()
        }
        break

      case 'escape':
        if (!commands.editDraft) break
        if (isCropping) {
          onCropCancel()
        } else if (isTuning) {
          onTuningCancel()
        }
        break

      case 'enter':
        if (!commands.editDraft || isSliderFocused) break
        if (isCropping) {
          onCropApply()
        } else if (isTuning) {
          onTuningApply()
        }
        break

      case ' ':
        if (commands.compare) {
          e.preventDefault()
          onCompareStart()
        }
        break

      case 's':
        if (e.metaKey || e.ctrlKey) {
          e.preventDefault()
          if (commands.export) onExport()
        }
        break
    }
  }, [
    commands,
    isCropping,
    isTuning,
    onRotateClockwise,
    onRotateCounterClockwise,
    onFlipHorizontal,
    onCropOpen,
    onCropCancel,
    onCropApply,
    onTuningToggle,
    onTuningCancel,
    onTuningApply,
    onPanelToggle,
    onExport,
    onCompareStart,
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
    // Pausing shortcuts must also release a held before/after comparison.
    if (!enabled || !commands.compare) onCompareEnd()
  }, [enabled, commands.compare, onCompareEnd])

  useEffect(() => {
    if (!enabled) return
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', onCompareEnd)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', onCompareEnd)
    }
  }, [enabled, handleKeyDown, handleKeyUp, onCompareEnd])
}
