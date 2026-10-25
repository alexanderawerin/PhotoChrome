import type { SVGProps } from 'react'
import paths from './iconoteka-paths.json'

export type IconotekaName = keyof typeof paths

/** Official Iconoteka Regular / Stroke geometry. See README.md for provenance. */
export function Iconoteka({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconotekaName }) {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false" {...props}>
    <path d={paths[name]} />
  </svg>
}
