'use client'
import { useState, useSyncExternalStore } from 'react'

const noopSubscribe = () => () => {}

/**
 * true en el navegador una vez hidratada la página; false en el servidor y
 * durante la hidratación. Sirve para leer cosas del navegador (localStorage,
 * la URL, APIs del dispositivo) sin que el HTML del servidor y el del cliente
 * difieran.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false)
}

const UNSET = Symbol('unset')

/**
 * Estado que arranca con un valor leído del navegador (por ejemplo, un
 * borrador en localStorage) y después se edita como cualquier useState.
 *
 * - En el servidor y durante la hidratación vale `fallback`.
 * - Apenas la página está hidratada se llama a `read()` una vez.
 * - Si cambia `key` (por ejemplo, otra operación), se vuelve a leer.
 *
 * Reemplaza el patrón `useEffect(() => setX(leerStorage()), [])`, que pinta
 * dos veces y React desaconseja.
 */
export function useBrowserState<T>(read: () => T, fallback: T, key: unknown = null) {
  const hydrated = useHydrated()
  const [state, setState] = useState<T>(fallback)
  const [readFor, setReadFor] = useState<unknown>(UNSET)
  if (hydrated && readFor !== key) {
    setReadFor(key)
    let next = fallback
    try { next = read() } catch { /* storage bloqueado: queda el valor por defecto */ }
    setState(next)
  }
  return [state, setState] as const
}

/** Igual que useBrowserState, para valores que solo se leen. */
export function useBrowserValue<T>(read: () => T, fallback: T, key: unknown = null): T {
  return useBrowserState(read, fallback, key)[0]
}
