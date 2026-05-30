/**
 * Минимальный срез EXIF, релевантный для рекомендаций рецептов.
 */
export type ExifSubset = {
  iso?: number
  colorTemperatureKelvin?: number
}

/**
 * Извлекает ISO (и потенциально Kelvin) из EXIF JPEG-файла.
 * Возвращает undefined, если файл не JPEG, EXIF отсутствует, или парсинг провалился.
 */
export async function extractExif(file: File): Promise<ExifSubset | undefined> {
  const type = file.type.toLowerCase()
  if (!type.includes('jpeg') && !type.includes('jpg')) return undefined

  try {
    const piexif = await import('piexifjs')
    const dataUrl = await fileToDataURL(file)
    const exif = piexif.load(dataUrl)

    const isoRaw = exif['Exif']?.[piexif.ExifIFD.ISOSpeedRatings]
    const iso = typeof isoRaw === 'number' ? isoRaw : undefined

    const result: ExifSubset = {}
    if (iso !== undefined) result.iso = iso
    return Object.keys(result).length > 0 ? result : undefined
  } catch {
    return undefined
  }
}

function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
