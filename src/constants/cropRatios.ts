import type { AspectRatio } from '../engine/transform'

/** Соотношения для пресетов кропа (без free) */
export type CropPresetRatio = Exclude<AspectRatio, 'free'>

/** Совпадает с Tailwind `md` — ширина, с которой показывается десктопный тулбар с кропом */
export const MD_BREAKPOINT_MEDIA = '(min-width: 768px)'

/** Порядок и значение по умолчанию для мобильной панели кропа (`md:hidden`) */
export const CROP_RATIO_ORDER_MOBILE: CropPresetRatio[] = ['9:16', '3:4', '1:1', '4:3', '16:9']

/** Порядок и значение по умолчанию для десктопного тулбара (`md:` и выше) */
export const CROP_RATIO_ORDER_DESKTOP: CropPresetRatio[] = ['4:3', '1:1', '3:4', '16:9', '9:16']

export const DEFAULT_CROP_RATIO_MOBILE: AspectRatio = '9:16'
export const DEFAULT_CROP_RATIO_DESKTOP: AspectRatio = '4:3'

const META: Record<CropPresetRatio, { label: string; ariaLabel: string }> = {
  '1:1': { label: '1:1', ariaLabel: 'Square 1:1' },
  '4:3': { label: '4:3', ariaLabel: '4:3 landscape' },
  '3:4': { label: '3:4', ariaLabel: '3:4 portrait' },
  '16:9': { label: '16:9', ariaLabel: '16:9 wide' },
  '9:16': { label: '9:16', ariaLabel: '9:16 tall' },
}

export function cropRatioToolbarItems(order: CropPresetRatio[]) {
  return order.map((value) => ({ value, ...META[value] }))
}

export function cropRatioPanelItems(order: CropPresetRatio[]) {
  return order.map((value) => ({ value, label: META[value].label }))
}
