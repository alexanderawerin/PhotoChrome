import { useState, useCallback, useEffect, useRef } from 'react'
import { RecipeSettings, Recipe } from '../engine/types'

interface TuningState {
  /** Режим тюнинга активен */
  isTuning: boolean
  /** Пользовательские настройки (поверх рецепта) */
  customSettings: RecipeSettings
}

interface TuningActions {
  /** Открыть/закрыть режим тюнинга */
  toggleTuning: () => void
  /** Применить настройки и закрыть тюнинг */
  applyTuning: () => void
  /** Отменить настройки и закрыть тюнинг */
  cancelTuning: () => void
  /** Изменить настройки */
  updateSettings: (settings: RecipeSettings) => void
  /** Сбросить кастомные настройки */
  resetSettings: () => void
  /** Получить объединённые настройки (рецепт + кастомные) */
  getMergedSettings: (recipe: Recipe | null) => RecipeSettings
}

interface UseTuningOptions {
  /** Callback при изменении настроек */
  onSettingsChange?: (settings: RecipeSettings) => void
  /** Начальные настройки (для multi-image режима) */
  initialSettings?: RecipeSettings
}

/**
 * Хук для управления режимом тюнинга и пользовательскими настройками.
 * Позволяет тонко настраивать параметры поверх выбранного рецепта.
 */
export function useTuning({
  onSettingsChange,
  initialSettings = {},
}: UseTuningOptions): TuningState & TuningActions {
  const [isTuning, setIsTuning] = useState(false)
  const [customSettings, setCustomSettings] = useState<RecipeSettings>(initialSettings)
  const [settingsBeforeTuning, setSettingsBeforeTuning] = useState<RecipeSettings>(initialSettings)

  // Ref для отслеживания предыдущего значения initialSettings (стабильное сравнение по ссылке)
  const prevInitialRef = useRef(initialSettings)

  // Синхронизация с внешними settings (для переключения между изображениями)
  // Используем ref чтобы не реагировать на новые объекты с тем же содержимым
  useEffect(() => {
    if (prevInitialRef.current !== initialSettings) {
      prevInitialRef.current = initialSettings
      if (!isTuning) {
        setCustomSettings(initialSettings)
        setSettingsBeforeTuning(initialSettings)
      }
    }
  }, [initialSettings, isTuning])

  /**
   * Объединяет настройки рецепта с пользовательскими настройками
   */
  const getMergedSettings = useCallback((recipe: Recipe | null): RecipeSettings => {
    if (!recipe) return {}
    return {
      ...recipe.settings,
      ...customSettings
    }
  }, [customSettings])

  /**
   * Toggle режима тюнинга (открыть/закрыть)
   */
  const toggleTuning = useCallback(() => {
    if (isTuning) {
      // Закрываем — применяем настройки
      setIsTuning(false)
    } else {
      // Открываем — сохраняем настройки для возможности отмены
      setSettingsBeforeTuning(customSettings)
      setIsTuning(true)
    }
  }, [isTuning, customSettings])

  /**
   * Применить настройки и закрыть тюнинг
   */
  const applyTuning = useCallback(() => {
    setIsTuning(false)
  }, [])

  /**
   * Отменить настройки и закрыть тюнинг
   */
  const cancelTuning = useCallback(() => {
    setCustomSettings(settingsBeforeTuning)
    onSettingsChange?.(settingsBeforeTuning)
    setIsTuning(false)
  }, [settingsBeforeTuning, onSettingsChange])

  /**
   * Изменить настройки
   */
  const updateSettings = useCallback((newSettings: RecipeSettings) => {
    setCustomSettings(newSettings)
    onSettingsChange?.(newSettings)
  }, [onSettingsChange])

  /**
   * Сбросить кастомные настройки
   */
  const resetSettings = useCallback(() => {
    setCustomSettings({})
    setSettingsBeforeTuning({})
  }, [])

  return {
    // State
    isTuning,
    customSettings,
    // Actions
    toggleTuning,
    applyTuning,
    cancelTuning,
    updateSettings,
    resetSettings,
    getMergedSettings,
  }
}

