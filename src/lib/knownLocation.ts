import { loadOperations } from '@/lib/userOperations'

/**
 * Dónde está operando la persona, según lo que ya dijo (onboarding u operación activa).
 * Los formularios lo usan para precargar zona/ciudad en vez de volver a preguntar.
 * Es un valor de partida: la persona puede cambiarlo.
 */
export interface KnownLocation {
  city: string
  province: string
  /** Lo más específico que sabemos: ciudad si hay, si no provincia. Vacío si no sabemos nada. */
  label: string
}

const EMPTY: KnownLocation = { city: '', province: '', label: '' }

export async function loadKnownLocation(): Promise<KnownLocation> {
  let storedProvince = ''
  let selectedId = ''
  try {
    storedProvince = localStorage.getItem('vara_province') ?? ''
    selectedId = localStorage.getItem('vara_operation_id') ?? ''
  } catch { /* sin acceso al almacenamiento */ }

  try {
    const ops = await loadOperations()
    const op = ops.find(o => o.id === selectedId) ?? ops[0]
    if (op) {
      const city = (op.city ?? '').trim()
      const province = (op.province ?? '').trim() || storedProvince
      return { city, province, label: city || province }
    }
  } catch { /* se usa lo guardado en este navegador */ }

  return storedProvince ? { city: '', province: storedProvince, label: storedProvince } : EMPTY
}
