'use client'
import { useEffect } from 'react'

/**
 * Corre una carga async al montar y cada vez que cambia `load`.
 *
 * Reemplaza `useEffect(() => { void load() }, [load])`. La carga arranca en
 * una microtarea, así ningún setState de `load` ocurre dentro del cuerpo del
 * efecto (React lo desaconseja porque provoca renders en cascada). Si el
 * componente se desmonta antes de arrancar, la carga no corre.
 */
export function useLoad(load: () => unknown): void {
  useEffect(() => {
    let alive = true
    queueMicrotask(() => { if (alive) void load() })
    return () => { alive = false }
  }, [load])
}
