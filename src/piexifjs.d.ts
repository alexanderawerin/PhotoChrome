declare module 'piexifjs' {
  interface ExifDict {
    '0th'?: Record<number, unknown>
    Exif?: Record<number, unknown>
    GPS?: Record<number, unknown>
    '1st'?: Record<number, unknown>
  }

  const ImageIFD: Record<string, number>
  const ExifIFD: Record<string, number>
  const GPSIFD: Record<string, number>

  function load(jpegBinary: string): ExifDict
  function dump(exifObj: ExifDict): string
  function insert(exifStr: string, jpegBinary: string): string
  function remove(jpegBinary: string): string

  export { ImageIFD, ExifIFD, GPSIFD, load, dump, insert, remove }
  export default { ImageIFD, ExifIFD, GPSIFD, load, dump, insert, remove }
}
