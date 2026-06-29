/**
 * Converts a color temperature in Kelvin to RGB multipliers.
 * Uses Tanner Helland's algorithm approximating the Planckian locus.
 * Returns [r, g, b] multipliers normalized so that G=1 at 5500K (Fuji Auto WB neutral).
 *
 * Reference: https://tannerhelland.com/2012/09/18/convert-temperature-rgb-algorithm-code.html
 */
export function kelvinToRGBMultipliers(kelvin: number): [number, number, number] {
  const temp = Math.max(1000, Math.min(40000, kelvin)) / 100

  let r: number
  let g: number
  let b: number

  // Red
  if (temp <= 66) {
    r = 255
  } else {
    r = 329.698727446 * Math.pow(temp - 60, -0.1332047592)
    r = Math.max(0, Math.min(255, r))
  }

  // Green
  if (temp <= 66) {
    g = 99.4708025861 * Math.log(temp) - 161.1195681661
  } else {
    g = 288.1221695283 * Math.pow(temp - 60, -0.0755148492)
  }
  g = Math.max(0, Math.min(255, g))

  // Blue
  if (temp >= 66) {
    b = 255
  } else if (temp <= 19) {
    b = 0
  } else {
    b = 138.5177312231 * Math.log(temp - 10) - 305.0447927307
    b = Math.max(0, Math.min(255, b))
  }

  // Normalize to G=1 (so green channel is unchanged, R and B are scaled relative)
  const gNorm = g === 0 ? 1 : g
  return [r / gNorm, 1, b / gNorm]
}

const DAYLIGHT_MULTIPLIERS = kelvinToRGBMultipliers(5500)

export function kelvinToRGBScale(kelvin: number): [number, number] {
  const [r, , b] = kelvinToRGBMultipliers(kelvin)
  const [rRef, , bRef] = DAYLIGHT_MULTIPLIERS
  return [r / rRef, b / bRef]
}
