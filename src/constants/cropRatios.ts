import type { AspectRatio } from '../engine/transform'

export type CropPresetRatio = AspectRatio

/** Совпадает с Tailwind `md` — граница мобильной и десктопной компоновки. */
export const MD_BREAKPOINT_MEDIA = '(min-width: 768px)'

/** Порядок пропорций в общей панели Crop для фото и видео. */
export const CROP_RATIO_ORDER_MOBILE: CropPresetRatio[] = ['original', 'free', '9:16', '3:4', '1:1', '4:3', '16:9']

const LABELS: Record<CropPresetRatio, string> = {
  'original': 'Original',
  'free': 'Free',
  '1:1': '1:1',
  '4:3': '4:3',
  '3:4': '3:4',
  '16:9': '16:9',
  '9:16': '9:16',
}

export function cropRatioPanelItems(order: CropPresetRatio[]) {
  return order.map((value) => ({ value, label: LABELS[value] }))
}
