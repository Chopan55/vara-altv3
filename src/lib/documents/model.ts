/**
 * Documentos de una operación.
 *
 * Hasta acá VARA mostraba documentos requeridos que no se podían cargar: una
 * lista de deberes sin lugar donde entregarlos. Este módulo es la parte pura
 * —qué archivo se acepta, en qué estado está, qué falta— y no toca ni la red
 * ni el navegador, así que se puede testear entera.
 *
 * La subida vive en `src/lib/supabase/documents.ts`.
 */
import type { CountryCode } from '@/types'

export type DocumentCategory =
  | 'ESCRITURA' | 'PLANOS' | 'INFORMES' | 'IMPUESTOS' | 'EXPENSAS'
  | 'SERVICIOS' | 'CERTIFICADOS' | 'CONTRATOS' | 'RESERVA' | 'TASACIONES' | 'OTROS'

export type DocumentStatus =
  | 'PENDING'    // lo pedimos, todavía no llegó
  | 'RECEIVED'   // el usuario lo subió
  | 'IN_REVIEW'  // alguien lo está mirando
  | 'APPROVED'
  | 'REJECTED'
  | 'EXPIRED'

export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  PENDING: 'Falta subirlo',
  RECEIVED: 'Subido',
  IN_REVIEW: 'En revisión',
  APPROVED: 'Aprobado',
  REJECTED: 'Rechazado',
  EXPIRED: 'Vencido',
}

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  ESCRITURA: 'Escritura',
  PLANOS: 'Planos',
  INFORMES: 'Informes',
  IMPUESTOS: 'Impuestos',
  EXPENSAS: 'Expensas',
  SERVICIOS: 'Servicios',
  CERTIFICADOS: 'Certificados',
  CONTRATOS: 'Contratos',
  RESERVA: 'Reserva',
  TASACIONES: 'Tasaciones',
  OTROS: 'Otros',
}

/**
 * Categorías sin las cuales una compraventa no cierra.
 *
 * No es una opinión de producto: sin escritura ni informe de dominio no se
 * puede verificar quién es el titular ni si la propiedad está libre.
 */
export const CRITICAL_CATEGORIES: DocumentCategory[] = ['ESCRITURA', 'INFORMES', 'CERTIFICADOS']

export function isCriticalCategory(c: DocumentCategory): boolean {
  return CRITICAL_CATEGORIES.includes(c)
}

const MX_CATEGORY_OVERRIDES: Partial<Record<DocumentCategory, string>> = {
  ESCRITURA: 'Escritura Notarial',
  RESERVA: 'Apartado',
  IMPUESTOS: 'ISAI / ISR',
  EXPENSAS: 'Mantenimiento / Cuotas',
}

export function getDocumentCategoryLabels(country?: CountryCode | null): Record<DocumentCategory, string> {
  if (country === 'MX') {
    return { ...DOCUMENT_CATEGORY_LABELS, ...MX_CATEGORY_OVERRIDES }
  }
  return DOCUMENT_CATEGORY_LABELS
}

export interface OperationDocument {
  id: string
  operationId: string
  taskId?: string
  name: string
  category: DocumentCategory
  status: DocumentStatus
  /** Ruta en Storage. Ausente mientras el documento está solo pedido. */
  storagePath?: string
  version: number
  notes?: string
  /** Fecha del documento en sí (no la de subida). ISO corta: "2026-03-15". */
  documentDate?: string
  createdAt: number
}

// ───────────────────────── Validación de archivos ─────────────────────────

/**
 * Lo que aceptamos. Es a propósito angosto: un documento de una compraventa
 * es un PDF o una foto del papel. Aceptar .docx o .zip invitaría a subir
 * cosas que después nadie puede abrir del otro lado.
 */
export const ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
] as const

export const ACCEPTED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'heic']

/** 15 MB. Un escaneo de escritura de 20 páginas entra cómodo. */
export const MAX_FILE_BYTES = 15 * 1024 * 1024

export interface FileCheck {
  ok: boolean
  /** Mensaje para mostrar tal cual. Dice qué pasó y qué hacer. */
  error?: string
}

function extensionOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i > 0 ? name.slice(i + 1).toLowerCase() : ''
}

/**
 * ¿Se puede subir este archivo?
 *
 * Miramos el tipo declarado y, si viene vacío o raro, la extensión. Es una
 * validación de conveniencia para no hacerle perder el tiempo a la persona,
 * no un control de seguridad: quien sirve el archivo es Storage, con el
 * bucket privado y URL firmada.
 */
export function checkFile(file: { name: string; type: string; size: number }): FileCheck {
  if (file.size === 0) {
    return { ok: false, error: 'El archivo está vacío.' }
  }
  if (file.size > MAX_FILE_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1)
    return {
      ok: false,
      error: `Pesa ${mb} MB y el máximo son 15 MB. Probá con un PDF comprimido o sacale una foto más liviana.`,
    }
  }

  const type = (file.type || '').toLowerCase()
  const ext = extensionOf(file.name)

  const typeOk = (ACCEPTED_MIME_TYPES as readonly string[]).includes(type)
  const extOk = ACCEPTED_EXTENSIONS.includes(ext)

  // Si el navegador no declara tipo (pasa con algunos archivos), la extensión decide.
  if (typeOk || (!type && extOk)) return { ok: true }

  return {
    ok: false,
    error: 'Solo aceptamos PDF o una foto del documento (JPG, PNG, WEBP o HEIC).',
  }
}

// ───────────────────────── Estados ─────────────────────────

/**
 * Transiciones permitidas.
 *
 * Un documento subido se puede reemplazar por una versión nueva (vuelve a
 * RECEIVED), y uno rechazado o vencido también: es exactamente lo que hace
 * alguien cuando le dicen que el informe está viejo. Lo que no existe es
 * volver a PENDING, porque el archivo ya está y borrarlo es otra acción.
 */
export const ALLOWED_DOCUMENT_TRANSITIONS: Record<DocumentStatus, DocumentStatus[]> = {
  PENDING: ['RECEIVED'],
  RECEIVED: ['IN_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED'],
  IN_REVIEW: ['APPROVED', 'REJECTED', 'RECEIVED'],
  APPROVED: ['EXPIRED', 'RECEIVED'],
  REJECTED: ['RECEIVED'],
  EXPIRED: ['RECEIVED'],
}

export function canTransitionDocument(from: DocumentStatus, to: DocumentStatus): boolean {
  return ALLOWED_DOCUMENT_TRANSITIONS[from].includes(to)
}

/** Ya hay un archivo del otro lado. */
export function hasFile(d: OperationDocument): boolean {
  return typeof d.storagePath === 'string' && d.storagePath.length > 0
}

/** Los que todavía le deben algo a alguien. */
export function pendingDocuments(docs: OperationDocument[]): OperationDocument[] {
  return docs.filter(d => d.status === 'PENDING' || d.status === 'REJECTED' || d.status === 'EXPIRED')
}

/**
 * Los que frenan la operación: críticos y sin resolver.
 * Es lo que el motor de Next Best Action usa para priorizar.
 */
export function blockingDocuments(docs: OperationDocument[]): OperationDocument[] {
  return pendingDocuments(docs).filter(d => isCriticalCategory(d.category))
}

/**
 * Orden en que conviene atacarlos: primero lo que bloquea, después lo
 * pendiente, y al final lo ya resuelto.
 */
const STATUS_WEIGHT: Record<DocumentStatus, number> = {
  REJECTED: 0,
  EXPIRED: 1,
  PENDING: 2,
  IN_REVIEW: 3,
  RECEIVED: 4,
  APPROVED: 5,
}

export function sortDocuments(docs: OperationDocument[]): OperationDocument[] {
  return [...docs].sort((a, b) => {
    const critA = isCriticalCategory(a.category) ? 0 : 1
    const critB = isCriticalCategory(b.category) ? 0 : 1
    if (critA !== critB) return critA - critB
    const w = STATUS_WEIGHT[a.status] - STATUS_WEIGHT[b.status]
    if (w !== 0) return w
    return a.name.localeCompare(b.name, 'es')
  })
}

/**
 * Resumen honesto del estado documental.
 * `total` cuenta lo pedido, no lo subido: la diferencia es justamente la deuda.
 */
export interface DocumentSummary {
  total: number
  uploaded: number
  approved: number
  blocking: number
}

export function summarize(docs: OperationDocument[]): DocumentSummary {
  return {
    total: docs.length,
    uploaded: docs.filter(hasFile).length,
    approved: docs.filter(d => d.status === 'APPROVED').length,
    blocking: blockingDocuments(docs).length,
  }
}
