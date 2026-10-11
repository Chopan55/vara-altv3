import { loadPhotos } from '@/lib/photoStore'
import { hasPhotoSession, listPhotos } from '@/lib/supabase/photos'

/**
 * Fotos del vendedor, leídas del mismo lugar que "Mi propiedad": con sesión viven
 * en la nube (Supabase Storage, URL firmada); sin sesión, en este navegador.
 * La portada va primero.
 */
export interface SellerPhoto { id: string; url: string; label: string; isCover: boolean }

export async function loadSellerPhotos(): Promise<SellerPhoto[]> {
  let list: SellerPhoto[] = []
  try {
    if (await hasPhotoSession()) {
      const remote = await listPhotos()
      list = remote.map(p => ({ id: p.id, url: p.url, label: p.label, isCover: p.isCover }))
    }
  } catch { /* si falla la nube, probamos con las del navegador */ }
  if (list.length === 0) {
    try {
      const local = await loadPhotos()
      list = local.map(p => ({ id: p.id, url: p.preview, label: p.label, isCover: p.isCover }))
    } catch { /* sin fotos */ }
  }
  return list.filter(p => p.url).sort((a, b) => Number(b.isCover) - Number(a.isCover))
}
