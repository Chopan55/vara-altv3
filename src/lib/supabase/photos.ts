import { tryCreateClient } from './client'
import { log } from '@/lib/observability/logger'

/**
 * Fotos en Supabase Storage.
 * El bucket es privado: se sirven con URL firmada que vence, no quedan públicas.
 * El path arranca con el user_id porque la política de Storage lo exige.
 */

const BUCKET = 'property-photos'
const SIGNED_URL_TTL = 60 * 60 // 1 hora

export interface RemotePhoto {
  id: string
  storagePath: string
  label: string
  isCover: boolean
  url: string
  createdAt: number
}

export async function hasPhotoSession(): Promise<boolean> {
  const supabase = tryCreateClient()
  if (!supabase) return false
  const { data } = await supabase.auth.getUser()
  return Boolean(data.user)
}

export async function uploadPhoto(file: Blob, label: string, isCover: boolean, propertyId?: string): Promise<RemotePhoto | null> {
  const supabase = tryCreateClient()
  if (!supabase) return null
  const { data: u } = await supabase.auth.getUser()
  const userId = u.user?.id
  if (!userId) return null

  const ext = file.type.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg'
  const name = `ph-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`
  const storagePath = `${userId}/${name}`

  const up = await supabase.storage.from(BUCKET).upload(storagePath, file, {
    contentType: file.type || 'image/jpeg',
    upsert: false,
  })
  if (up.error) {
    log.error('photo.upload.failed', up.error, { bytes: file.size })
    return null
  }

  const { data, error } = await supabase
    .from('property_photos')
    .insert({ user_id: userId, storage_path: storagePath, label, is_cover: isCover, property_id: propertyId ?? null })
    .select('id, created_at')
    .single()

  if (error || !data) {
    // Si falló la metadata, no dejamos el archivo huérfano.
    await supabase.storage.from(BUCKET).remove([storagePath])
    return null
  }

  const url = await signedUrl(storagePath)
  return { id: data.id, storagePath, label, isCover, url: url ?? '', createdAt: new Date(data.created_at).getTime() }
}

async function signedUrl(path: string): Promise<string | null> {
  const supabase = tryCreateClient()
  if (!supabase) return null
  const { data } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL)
  return data?.signedUrl ?? null
}

export async function listPhotos(propertyId?: string): Promise<RemotePhoto[]> {
  const supabase = tryCreateClient()
  if (!supabase) return []
  let query = supabase
    .from('property_photos')
    .select('id, storage_path, label, is_cover, created_at, property_id')
    .order('created_at', { ascending: true })
  if (propertyId) query = query.eq('property_id', propertyId)
  const { data, error } = await query
  if (error || !data) return []

  const out: RemotePhoto[] = []
  for (const r of data) {
    const url = await signedUrl(r.storage_path)
    out.push({
      id: r.id,
      storagePath: r.storage_path,
      label: r.label,
      isCover: r.is_cover,
      url: url ?? '',
      createdAt: new Date(r.created_at).getTime(),
    })
  }
  return out
}

export async function deletePhotoRemote(id: string, storagePath: string): Promise<void> {
  const supabase = tryCreateClient()
  if (!supabase) return
  await supabase.storage.from(BUCKET).remove([storagePath])
  await supabase.from('property_photos').delete().eq('id', id)
}

export async function updatePhotoRemote(
  id: string,
  patch: { label?: string; isCover?: boolean }
): Promise<void> {
  const supabase = tryCreateClient()
  if (!supabase) return
  const row: { label?: string; is_cover?: boolean } = {}
  if (patch.label !== undefined) row.label = patch.label
  if (patch.isCover !== undefined) row.is_cover = patch.isCover
  if (Object.keys(row).length === 0) return
  await supabase.from('property_photos').update(row).eq('id', id)
}

/** Una sola portada: apaga el resto antes de encender esta. */
export async function setCoverRemote(id: string): Promise<void> {
  const supabase = tryCreateClient()
  if (!supabase) return
  const { data: u } = await supabase.auth.getUser()
  if (!u.user) return
  await supabase.from('property_photos').update({ is_cover: false }).eq('user_id', u.user.id)
  await supabase.from('property_photos').update({ is_cover: true }).eq('id', id)
}
