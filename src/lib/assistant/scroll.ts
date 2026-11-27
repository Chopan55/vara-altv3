/** ¿La persona está leyendo el final de la conversación? Si subió a releer algo, no se la arrastra hacia abajo. */
export function isNearBottom(scrollY: number, viewportHeight: number, scrollHeight: number, threshold = 160): boolean {
  if (![scrollY, viewportHeight, scrollHeight].every(Number.isFinite)) return true
  return scrollY + viewportHeight >= scrollHeight - threshold
}
