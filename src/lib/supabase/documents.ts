import { tryCreateClient } from './client'
import { log } from '@/lib/observability/logger'
import type { OperationDocumentRow } from './types'
import {
  checkFile, canTransitionDocument,
  type DocumentCategory, type DocumentStatus, type OperationDocument,
} from '@/lib/documents/model'

/**
 * Documentos en Supabase Storage.
 *
 * El bucket es privado y se sirve con URL firmada que vence: una escritura o
 * un informe de dominio tienen el nombre, el DNI y el domicilio de personas
 * reales. Nunca quedan públicos.
 *
 * El path arranca con el user_id porque la política de Storage lo exige.
 */

const BUCKET = 'documents'
/** 5 minutos. Alcanza para abrir o descargar, y no sobrevive a un link reenviado. */
const SIGNED_URL_TTL = 60 * 5

function rowToDocument(r: OperationDocumentRow): OperationDocument {
  return {
    id: r.id,
    operationId: r.operation_id,
    taskId: r.task_id ?? undefined,
    name: r.name,
    category: r.category,
    status: r.status,
    storagePath: r.storage_path ?? undefined,
    version: r.version,
    notes: r.notes ?? undefined,
    documentDate: r.document_date ?? undefined,
    createdAt: Date.parse(r.created_at),
  }
}

export async function hasDocumentSession(): Promise<boolean> {
  const supabase = tryCreateClient()
  if (!supabase) return false
  const { data } = await supabase.auth.getUser()
  return Boolean(data.user)
}

export async function fetchDocuments(operationId: string): Promise<OperationDocument[]> {
  const supabase = tryCreateClient()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('operation_documents')
    .select('*')
    .eq('operation_id', operationId)
    .order('created_at', { ascending: true })
  if (error || !data) return []
  return data.map(rowToDocument)
}

/**
 * Registra un documento que hace falta, sin archivo todavía.
 * Es lo que hace el checklist: pedirlo antes de que exista.
 */
export async function createDocumentRequest(input: {
  operationId: string
  name: string
  category: DocumentCategory
  taskId?: string
}): Promise<OperationDocument | null> {
  const supabase = tryCreateClient()
  if (!supabase) return null
  const { data: u } = await supabase.auth.getUser()
  const userId = u.user?.id
  if (!userId) return null

  const { data, error } = await supabase
    .from('operation_documents')
    .insert({
      user_id: userId,
      operation_id: input.operationId,
      task_id: input.taskId ?? null,
      name: input.name,
      category: input.category,
      status: 'PENDING',
    })
    .select('*')
    .maybeSingle()
  if (error || !data) {
    if (error) log.error('document.request.failed', error, { operationId: input.operationId, category: input.category })
    return null
  }
  return rowToDocument(data)
}

export interface UploadResult {
  ok: boolean
  /** Mensaje listo para mostrar. Dice qué pasó y qué hacer. */
  error?: string
  document?: OperationDocument
}

function extensionOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i > 0 ? name.slice(i + 1).toLowerCase() : 'pdf'
}

/**
 * Sube el archivo y lo ata al documento pedido.
 *
 * Primero va el archivo y después la fila: si la subida falla, el documento
 * sigue en PENDING y la persona puede reintentar. Al revés quedaría una fila
 * diciendo "subido" y apuntando a la nada.
 *
 * Reemplazar sube una versión nueva y **conserva la anterior en Storage**:
 * borrar el archivo viejo en el mismo momento en que llega el nuevo es la
 * forma más rápida de perder el único ejemplar de una escritura.
 */
export async function uploadDocument(
  documentId: string,
  file: File,
): Promise<UploadResult> {
  const check = checkFile({ name: file.name, type: file.type, size: file.size })
  if (!check.ok) return { ok: false, error: check.error }

  const supabase = tryCreateClient()
  if (!supabase) return { ok: false, error: 'No hay conexión con la base.' }
  const { data: u } = await supabase.auth.getUser()
  const userId = u.user?.id
  if (!userId) return { ok: false, error: 'Necesitás iniciar sesión para subir documentos.' }

  const { data: current, error: readErr } = await supabase
    .from('operation_documents')
    .select('*')
    .eq('id', documentId)
    .maybeSingle()
  if (readErr || !current) {
    return { ok: false, error: 'No encontramos ese documento.' }
  }

  const doc = rowToDocument(current)
  if (!canTransitionDocument(doc.status, 'RECEIVED')) {
    return { ok: false, error: 'Ese documento no admite una versión nueva.' }
  }

  const version = doc.version + (doc.storagePath ? 1 : 0)
  const ext = extensionOf(file.name)
  const storagePath =
    `${userId}/${doc.operationId}/doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`

  const up = await supabase.storage.from(BUCKET).upload(storagePath, file, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  })
  if (up.error) {
    log.error('document.upload.failed', up.error, { documentId, bytes: file.size })
    return { ok: false, error: 'No pudimos subir el archivo. Probá de nuevo en un momento.' }
  }

  const patch: Partial<OperationDocumentRow> = {
    storage_path: storagePath,
    status: 'RECEIVED',
    version,
  }
  const { data, error } = await supabase
    .from('operation_documents')
    .update(patch)
    .eq('id', documentId)
    .select('*')
    .maybeSingle()

  if (error || !data) {
    // La fila no se actualizó: sacamos el archivo huérfano para no dejar basura.
    await supabase.storage.from(BUCKET).remove([storagePath])
    return { ok: false, error: 'Subimos el archivo pero no pudimos guardarlo. Probá de nuevo.' }
  }

  return { ok: true, document: rowToDocument(data) }
}

/** URL temporal para abrir el documento. Vence a los 5 minutos. */
export async function signedUrlFor(storagePath: string): Promise<string | null> {
  const supabase = tryCreateClient()
  if (!supabase) return null
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL)
  if (error || !data) return null
  return data.signedUrl
}

export async function setDocumentStatus(
  documentId: string,
  to: DocumentStatus,
  notes?: string,
): Promise<OperationDocument | null> {
  const supabase = tryCreateClient()
  if (!supabase) return null

  const patch: Partial<OperationDocumentRow> = { status: to }
  if (notes !== undefined) patch.notes = notes || null

  const { data, error } = await supabase
    .from('operation_documents')
    .update(patch)
    .eq('id', documentId)
    .select('*')
    .maybeSingle()
  if (error || !data) return null
  return rowToDocument(data)
}

/**
 * Borra el pedido y su archivo.
 * El archivo va después de la fila: si falla el borrado del objeto queda un
 * huérfano en Storage, que es preferible a una fila apuntando a la nada.
 */
export async function deleteDocument(documentId: string): Promise<boolean> {
  const supabase = tryCreateClient()
  if (!supabase) return false

  const { data: current } = await supabase
    .from('operation_documents')
    .select('storage_path')
    .eq('id', documentId)
    .maybeSingle()

  const { error } = await supabase.from('operation_documents').delete().eq('id', documentId)
  if (error) return false

  const path = current?.storage_path
  if (path) await supabase.storage.from(BUCKET).remove([path])
  return true
}
