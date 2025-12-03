import { useState, useLayoutEffect } from 'react'

/**
 * Хук для отслеживания высоты viewport.
 * Решает проблему мобильных браузеров, где 100vh не учитывает
 * адресную строку и другие элементы интерфейса браузера.
 * 
 * @returns Текущая высота viewport в пикселях или null если ещё не измерена
 */
export function useViewportHeight(): number | null {
  const [viewportHeight, setViewportHeight] = useState<number | null>(null)
  
  useLayoutEffect(() => {
    const updateHeight = () => {
      setViewportHeight(window.innerHeight)
    }
    
    // Первоначальное измерение
    updateHeight()
    
    // Обновление при resize
    window.addEventListener('resize', updateHeight)
    
    // Обновление при смене ориентации (с задержкой для мобильных браузеров)
    const handleOrientationChange = () => {
      setTimeout(updateHeight, 100)
    }
    window.addEventListener('orientationchange', handleOrientationChange)
    
    return () => {
      window.removeEventListener('resize', updateHeight)
      window.removeEventListener('orientationchange', handleOrientationChange)
    }
  }, [])

  return viewportHeight
}

/**
 * Возвращает CSS-значение высоты для контейнера.
 * Использует измеренную высоту viewport или fallback на 100dvh.
 * 
 * @param viewportHeight - Измеренная высота viewport
 * @returns CSS-строка для свойства height
 */
export function getViewportHeightStyle(viewportHeight: number | null): string {
  return viewportHeight ? `${viewportHeight}px` : '100dvh'
}

