'use client'

/**
 * Los archivos de verdad de una operación.
 *
 * El checklist dice qué papeles hacen falta; esto es dónde se entregan.
 * Hasta ahora VARA solo sabía pedirlos.
 *
 * Sin sesión no se puede subir nada, y lo decimos en vez de mostrar un botón
 * que falla al tocarlo: los archivos viven en un bucket privado atado al
 * usuario, y sin usuario no hay dónde guardarlos.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  FileText, Upload, Loader2, AlertCircle, Trash2, ExternalLink, Plus, Check,
} from 'lucide-react'
import {
  DOCUMENT_CATEGORY_LABELS, DOCUMENT_STATUS_LABELS, sortDocuments, summarize,
  isCriticalCategory, hasFile, ACCEPTED_EXTENSIONS,
  type DocumentCategory, type OperationDocument,
} from '@/lib/documents/model'
import {
  hasDocumentSession, fetchDocuments, createDocumentRequest,
  uploadDocument, signedUrlFor, deleteDocument,
} from '@/lib/supabase/documents'

const ACCEPT_ATTR = ACCEPTED_EXTENSIONS.map(e => `.${e}`).join(',')
const CATEGORIES = Object.keys(DOCUMENT_CATEGORY_LABELS) as DocumentCategory[]

function StatusPill({ doc }: { doc: OperationDocument }) {
  const tone =
    doc.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
    : doc.status === 'REJECTED' || doc.status === 'EXPIRED' ? 'bg-rose-50 text-rose-600 border-rose-100'
    : doc.status === 'RECEIVED' ? 'bg-sky-50 text-sky-600 border-sky-100'
    : 'bg-amber-50 text-amber-700 border-amber-100'
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 ${tone}`}>
      {DOCUMENT_STATUS_LABELS[doc.status]}
    </span>
  )
}

function AddDocumentForm({ onCreate, busy }: {
  onCreate: (name: string, category: DocumentCategory) => void
  busy: boolean
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [category, setCategory] = useState<DocumentCategory>('OTROS')

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-1.5 border-2 border-dashed border-slate-200 hover:border-slate-300 text-slate-500 text-xs font-semibold py-2.5 rounded-xl transition-colors">
        <Plus size={13} /> Agregar un documento
      </button>
    )
  }

  return (
    <div className="border border-slate-200 rounded-xl p-3 space-y-2">
      <input
        value={name} onChange={e => setName(e.target.value)} autoFocus
        placeholder="Nombre del documento (ej: Informe de dominio)"
        className="w-full border border-slate-200 focus:border-brand-400 rounded-lg px-3 py-2 text-xs text-slate-700 outline-none placeholder:text-slate-300"
      />
      <select
        value={category} onChange={e => setCategory(e.target.value as DocumentCategory)}
        className="w-full border border-slate-200 focus:border-brand-400 rounded-lg px-3 py-2 text-xs text-slate-700 outline-none bg-white">
        {CATEGORIES.map(c => (
          <option key={c} value={c}>{DOCUMENT_CATEGORY_LABELS[c]}</option>
        ))}
      </select>
      <div className="flex items-center gap-3">
        <button
          onClick={() => { onCreate(name.trim(), category); setName(''); setOpen(false) }}
          disabled={name.trim().length < 3 || busy}
          className="text-xs font-bold text-brand-600 hover:text-brand-700 disabled:opacity-40">
          Agregar
        </button>
        <button onClick={() => setOpen(false)} className="text-xs text-slate-400 hover:text-slate-600">
          Cancelar
        </button>
      </div>
    </div>
  )
}

function DocumentRow({ doc, onUpload, onDelete, uploading }: {
  doc: OperationDocument
  onUpload: (id: string, file: File) => void
  onDelete: (id: string) => void
  uploading: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [opening, setOpening] = useState(false)

  const open = async () => {
    if (!doc.storagePath) return
    setOpening(true)
    const url = await signedUrlFor(doc.storagePath)
    setOpening(false)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
  }

  const uploaded = hasFile(doc)

  return (
    <div className={`bg-white rounded-xl border p-3 ${
      isCriticalCategory(doc.category) && !uploaded ? 'border-amber-200' : 'border-slate-200/70'
    }`}>
      <div className="flex items-start gap-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
          uploaded ? 'bg-emerald-50' : 'bg-slate-50'
        }`}>
          {uploaded ? <Check size={13} className="text-emerald-600" /> : <FileText size={13} className="text-slate-400" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-slate-800 leading-tight break-words">{doc.name}</p>
            <StatusPill doc={doc} />
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {DOCUMENT_CATEGORY_LABELS[doc.category]}
            {doc.version > 1 && ` · versión ${doc.version}`}
          </p>

          <div className="flex flex-wrap items-center gap-3 mt-2">
            <input
              ref={inputRef} type="file" accept={ACCEPT_ATTR} className="hidden"
              onChange={e => {
                const f = e.target.files?.[0]
                if (f) onUpload(doc.id, f)
                e.target.value = ''
              }}
            />
            <button
              onClick={() => inputRef.current?.click()} disabled={uploading}
              className="flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700 disabled:opacity-40">
              {uploading
                ? <><Loader2 size={11} className="animate-spin" /> Subiendo…</>
                : <><Upload size={11} /> {uploaded ? 'Subir otra versión' : 'Subir archivo'}</>}
            </button>

            {uploaded && (
              <button onClick={open} disabled={opening}
                className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800">
                {opening ? <Loader2 size={11} className="animate-spin" /> : <ExternalLink size={11} />} Abrir
              </button>
            )}

            <button onClick={() => onDelete(doc.id)}
              className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-rose-500 ml-auto">
              <Trash2 size={11} /> Quitar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function OperationDocuments({ operationId }: { operationId: string }) {
  const [docs, setDocs] = useState<OperationDocument[]>([])
  const [session, setSession] = useState<boolean | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setDocs(sortDocuments(await fetchDocuments(operationId)))
  }, [operationId])

  useEffect(() => {
    let alive = true
    hasDocumentSession().then(async ok => {
      if (!alive) return
      setSession(ok)
      if (ok) await refresh()
      if (alive) setLoaded(true)
    })
    return () => { alive = false }
  }, [refresh])

  const create = async (name: string, category: DocumentCategory) => {
    setBusy(true); setError(null)
    const d = await createDocumentRequest({ operationId, name, category })
    if (!d) setError('No pudimos agregar el documento. Probá de nuevo.')
    await refresh()
    setBusy(false)
  }

  const upload = async (id: string, file: File) => {
    setBusyId(id); setError(null)
    const r = await uploadDocument(id, file)
    if (!r.ok) setError(r.error ?? 'No pudimos subir el archivo.')
    await refresh()
    setBusyId(null)
  }

  const remove = async (id: string) => {
    if (!window.confirm('¿Quitar este documento? Si tenía un archivo, se borra.')) return
    setBusyId(id)
    await deleteDocument(id)
    await refresh()
    setBusyId(null)
  }

  if (session === false) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-5">
        <p className="text-sm font-semibold text-slate-800 mb-1">Tus archivos</p>
        <p className="text-xs text-slate-500 leading-relaxed">
          Para subir documentos necesitás iniciar sesión. Los archivos van a un espacio privado
          tuyo — una escritura tiene nombre, DNI y domicilio de personas reales, así que no los
          guardamos en el navegador.
        </p>
      </div>
    )
  }

  if (!loaded) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-5 flex items-center gap-2">
        <Loader2 size={14} className="animate-spin text-slate-300" />
        <p className="text-xs text-slate-400">Cargando tus archivos…</p>
      </div>
    )
  }

  const s = summarize(docs)

  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-slate-800">Tus archivos</p>
        <p className="text-[11px] text-slate-400 mt-0.5">
          {s.total === 0
            ? 'Todavía no subiste ninguno.'
            : `${s.uploaded} de ${s.total} con archivo${s.blocking > 0 ? ` · ${s.blocking} sin resolver frena la operación` : ''}`}
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">
          <AlertCircle size={12} className="text-rose-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-rose-700">{error}</p>
        </div>
      )}

      {docs.map(d => (
        <DocumentRow
          key={d.id} doc={d} uploading={busyId === d.id}
          onUpload={upload} onDelete={remove}
        />
      ))}

      <AddDocumentForm onCreate={create} busy={busy} />

      <p className="text-[10px] text-slate-400 leading-relaxed">
        PDF o foto del documento, hasta 15 MB. Se guardan en privado y se abren con un
        link que vence a los 5 minutos.
      </p>
    </div>
  )
}
