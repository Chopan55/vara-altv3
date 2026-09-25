import { tryCreateClient } from './client'
import { log } from '@/lib/observability/logger'

/**
 * Fotos del reporte de visita.
 *
 * En una visita donde la persona dueña no estuvo presente, la foto es la
 * única prueba de en qué estado quedó la propiedad. El campo existía en la
 * base desde el principio y se guardaba siempre vacío.
 *
 * Bucket propio, privado, con URL firmada que vence: esto muestra el interior
 * de la casa de alguien, a veces con gente adentro.
 */

const BUCKET = 'visit-photos'
/** 10 minutos. Alcanza para mirar el reporte; no sobrevive a un reenvío. */
const SIGNED_URL_TTL = 60 * 10

/** Lo que una cámara de teléfono produce. Nada más. */
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']
/** 10 MB. Una foto de teléfono ronda los 3–5 MB. */
const MAX_BYTES = 10 * 1024 * 1024

export interface PhotoUploadResult {
  ok: boolean
  /** Mensaje listo para mostrar. */
  error?: string
  /** Ruta en Storage. Es lo que se guarda en el reporte. */
  path?: string
}

export function checkVisitPhoto(file: { type: string; size: number }): PhotoUploadResult {
  if (file.size === 0) return { ok: false, error: 'La foto está vacía.' }
  if (file.size > MAX_BYTES) {
    return {
      ok: false,
      error: `Pesa ${(file.size / (1024 * 1024)).toFixed(1)} MB y el máximo son 10 MB.`,
    }
  }
  if (!ACCEPTED.includes((file.type || '').toLowerCase())) {
    return { ok: false, error: 'Tiene que ser una foto (JPG, PNG, WEBP o HEIC).' }
  }
  return { ok: true }
}

export async function uploadVisitPhoto(
  bookingId: string,
  file: File,
): Promise<PhotoUploadResult> {
  const check = checkVisitPhoto({ type: file.type, size: file.size })
  if (!check.ok) return check

  const supabase = tryCreateClient()
  if (!supabase) return { ok: false, error: 'No hay conexión.' }
  const { data: u } = await supabase.auth.getUser()
  const userId = u.user?.id
  if (!userId) return { ok: false, error: 'Necesitás iniciar sesión.' }

  const ext = (file.type.split('/')[1] ?? 'jpg').replace('jpeg', 'jpg')
  // El path arranca con el user_id porque la política de Storage lo exige.
  const path = `${userId}/${bookingId}/vp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`

  const up = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type || 'image/jpeg',
    upsert: false,
  })
  if (up.error) {
    log.error('visit.photo.upload.failed', up.error, { bytes: file.size })
    return { ok: false, error: 'No pudimos subir la foto. Probá de nuevo.' }
  }

  return { ok: true, path }
}

export async function visitPhotoUrl(path: string): Promise<string | null> {
  const supabase = tryCreateClient()
  if (!supabase) return null
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL)
  if (error || !data) return null
  return data.signedUrl
}

export async function removeVisitPhoto(path: string): Promise<boolean> {
  const supabase = tryCreateClient()
  if (!supabase) return false
  const { error } = await supabase.storage.from(BUCKET).remove([path])
  return !error
}
