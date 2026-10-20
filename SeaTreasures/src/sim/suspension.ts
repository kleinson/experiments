/** View-capped mm/s: microscopic magnification must not turn silt into rainfall. */
export function suspension(width: number, height: number) {
  return {
    sink: Math.min(0.9, height * 0.001),
    drift: Math.min(2, width * 0.0015),
    sway: Math.min(10, width * 0.008),
  }
}
