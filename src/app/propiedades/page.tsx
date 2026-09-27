'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, MapPin, Bed, Bath, Square, Plus, Search, ArrowRight,
  X, CheckCircle2, AlertCircle, ExternalLink, Loader2, Home, Pencil,
  Heart, Eye, Trash2, RotateCcw, Columns3, StickyNote, Check, Sparkles,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { formatPrice, formatSurface, getPropertyTypeLabel } from '@/lib/utils'
import {
  CANDIDATE_STATUS_LABELS, buildComparison, missingForDecision, sortCandidates,
  type CandidateStatus, type PropertyCandidate,
} from '@/lib/candidates/model'
import {
  loadCandidates, setCandidateStatus, setCandidateNotes,
  promoteCandidate, removeCandidate,
} from '@/lib/candidates/store'
import type { ScrapeResult } from '@/app/api/scrape-property/route'

function PropertyImage({ neighborhood, image }: { neighborhood: string; image?: string }) {
  if (image) {
    return (
      <div className="h-36 relative overflow-hidden bg-slate-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={image} alt={neighborhood || 'Propiedad'} className="w-full h-full object-cover" />
      </div>
    )
  }
  return (
    <div className="h-36 relative overflow-hidden flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
      <div className="flex flex-col items-center">
        <div className="w-9 h-9 rounded-full flex items-center justify-center shadow-lg border-2 border-white bg-slate-500">
          <MapPin size={16} className="text-white fill-white" />
        </div>
        <div className="mt-1.5 bg-white/90 px-2.5 py-0.5 rounded-full shadow-sm">
          <p className="text-[11px] font-bold text-slate-600">{neighborhood || 'Sin fotos'}</p>
        </div>
      </div>
    </div>
  )
}

/** Guarda en la base si hay sesión; si no, en el navegador. */
async function saveImported(url: string, r: ScrapeResult): Promise<void> {
  const d = r.data ?? {}
  const photos = r.photos?.slice(0, 6) ?? []

  try {
    const { hasSession, insertProperty } = await import('@/lib/supabase/properties')
    if (await hasSession()) {
      await insertProperty({
        source: 'IMPORTED',
        sourceUrl: url,
        portal: r.portal,
        title: d.title,
        price: d.price,
        currency: d.currency === 'ARS' ? 'ARS' : 'USD',
        address: d.address,
        neighborhood: d.neighborhood,
        city: d.city,
        province: d.province,
        surfaceTotal: d.totalM2,
        surfaceCovered: d.coveredM2,
        rooms: d.rooms,
        bedrooms: d.bedrooms,
        bathrooms: d.bathrooms,
        description: d.description,
        features: d.features,
        expenses: d.expenses,
        remoteImages: photos,
      })
      return
    }
  } catch {
    // Sin base, cae al navegador.
  }

  try {
    const item = { url, portal: r.portal, data: d, photos, importedAt: Date.now() }
    const raw = localStorage.getItem('vara_imported_properties')
    const list: unknown[] = raw ? JSON.parse(raw) : []
    const filtered = list.filter((x: unknown) => (x as { url: string }).url !== url)
    filtered.push(item)
    localStorage.setItem('vara_imported_properties', JSON.stringify(filtered))
    // Clave legacy para compatibilidad con código que aún la lea.
    localStorage.setItem('vara_imported_property', JSON.stringify(item))
  } catch {}
}

function ImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [url, setUrl] = useState('')
  const [pasteText, setPasteText] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ScrapeResult | null>(null)

  const run = useCallback(async (text?: string) => {
    if (!url.trim()) return
    try { new URL(url) } catch { return }
    setLoading(true); setResult(null)
    try {
      const res = await fetch('/api/scrape-property', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, ...(text ? { text } : {}) }),
      })
      if (!res.ok) {
        setResult({
          status: 'error', url, portal: null, method: 'none', data: {}, photos: [],
          missingFields: [],
          errorMessage: res.status === 401 ? 'No autorizado. Cerrá sesión y volvé a entrar.' : 'El servidor devolvió un error. Probá de nuevo.',
        })
        return
      }
      const data: ScrapeResult = await res.json()
      setResult(data)
      if (data.status !== 'error' && data.status !== 'blocked') {
        await saveImported(url, data)
        onImported()
      }
    } catch {
      setResult({
        status: 'error', url, portal: null, method: 'none', data: {}, photos: [],
        missingFields: [], errorMessage: 'Error de conexión. Probá de nuevo.',
      })
    } finally { setLoading(false) }
  }, [url, onImported])

  const ok = result && (result.status === 'success' || result.status === 'partial' || result.status === 'expired')
  const needsPaste = result && (result.status === 'blocked' || result.status === 'error')

  return (
    <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-end sm:items-center justify-center p-3" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100 sticky top-0 bg-white">
          <div>
            <p className="font-bold text-slate-900 text-sm">Sumar una propiedad</p>
            <p className="text-xs text-slate-400 mt-0.5">Pegá el link de Zonaprop, Argenprop o MeLi</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Cerrar"><X size={18} /></button>
        </div>

        {ok ? (
          <div className="p-5 space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={20} className="text-emerald-500" />
              <p className="font-bold text-slate-900 text-sm">
                {result.status === 'expired' ? 'Aviso vencido — datos rescatados' : 'Propiedad sumada'}
              </p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 space-y-1">
              {result.data.title && <p className="text-xs font-semibold text-slate-700">{result.data.title}</p>}
              {result.data.price && <p className="text-xs text-slate-600">{result.data.currency ?? 'USD'} {result.data.price.toLocaleString('es-AR')}</p>}
              {result.data.totalM2 && <p className="text-xs text-slate-600">{result.data.totalM2} m²</p>}
              {result.data.rooms && <p className="text-xs text-slate-600">{result.data.rooms} ambientes</p>}
            </div>
            {result.missingFields.length > 0 && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5">
                <AlertCircle size={12} className="text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-[10px] text-amber-700">Faltó extraer: {result.missingFields.join(', ')}. Completalo desde la ficha.</p>
              </div>
            )}
            <button onClick={onClose} className="w-full bg-slate-900 text-white font-bold text-xs py-2.5 rounded-xl">
              Volver a mis propiedades
            </button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div>
              <label htmlFor="imp-url" className="text-xs font-semibold text-slate-500 block mb-1.5">Link de la publicación</label>
              <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2.5 focus-within:border-brand-400 transition-colors">
                <ExternalLink size={13} className="text-slate-300 flex-shrink-0" />
                <input
                  id="imp-url" type="url" value={url} onChange={e => { setUrl(e.target.value); setResult(null) }}
                  placeholder="https://www.zonaprop.com.ar/..."
                  className="flex-1 text-sm text-slate-800 focus:outline-none bg-transparent" autoFocus
                />
              </div>
            </div>

            {needsPaste && (
              <div className="space-y-2">
                <div className="flex items-start gap-2 bg-slate-100 rounded-xl px-3 py-2.5">
                  <AlertCircle size={12} className="text-slate-500 mt-0.5 flex-shrink-0" />
                  <p className="text-[11px] text-slate-600">{result.errorMessage}</p>
                </div>
                <textarea
                  value={pasteText} onChange={e => setPasteText(e.target.value)} rows={4}
                  placeholder="Pegá acá el texto del aviso (Ctrl+A, Ctrl+C en la página del portal)…"
                  className="w-full border-2 border-slate-100 focus:border-brand-400 rounded-xl px-3 py-2 text-xs text-slate-700 outline-none resize-none placeholder:text-slate-300"
                />
                <button
                  onClick={() => run(pasteText)} disabled={pasteText.trim().length < 150 || loading}
                  className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white font-bold text-xs py-2.5 rounded-xl"
                >
                  {loading ? 'Leyendo…' : pasteText.trim().length < 150 ? `Pegá el aviso (${pasteText.trim().length}/150)` : 'Leer datos del texto'}
                </button>
              </div>
            )}

            {!needsPaste && (
              <>
                <div className="bg-slate-50 rounded-xl p-3 space-y-1.5">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">VARA intenta extraer</p>
                  {['Precio y superficie', 'Ambientes, dormitorios y baños', 'Ubicación y barrio', 'Fotos de la publicación'].map(item => (
                    <div key={item} className="flex items-center gap-2 text-xs text-slate-600">
                      <CheckCircle2 size={11} className="text-emerald-500 flex-shrink-0" /> {item}
                    </div>
                  ))}
                  <p className="text-[10px] text-slate-400 pt-1">Si el portal bloquea la lectura, te pedimos pegar el texto.</p>
                </div>
                <button
                  onClick={() => run()} disabled={!url.trim() || loading}
                  className="w-full bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white font-bold text-sm py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {loading ? <><Loader2 size={14} className="animate-spin" />Leyendo el aviso…</> : <><Search size={14} /> Sumar con VARA</>}
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function EmptyState({ onImport }: { onImport: () => void }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-8 text-center">
      <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
        <Home size={26} className="text-slate-300" />
      </div>
      <p className="font-bold text-slate-900 text-base mb-1">Todavía no estás mirando ninguna propiedad</p>
      <p className="text-sm text-slate-400 mb-5 max-w-sm mx-auto leading-relaxed">
        Sumá las que estés evaluando y compará precio, superficie y costo por m² una al lado de la otra.
        Recién cuando decidas con cuál avanzar se abre una operación.
      </p>
      <div className="flex flex-col sm:flex-row gap-2 justify-center">
        <button onClick={onImport}
          className="flex items-center justify-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-bold px-4 py-2.5 rounded-xl transition-colors">
          <Plus size={14} /> Sumar desde un link
        </button>
        <Link href="/publicar"
          className="flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-600 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
          <Pencil size={14} /> Cargar a mano
        </Link>
      </div>
    </div>
  )
}

const STATUS_STYLE: Record<CandidateStatus, string> = {
  FAVORITE: 'bg-rose-50 text-rose-600 border-rose-100',
  VISITED: 'bg-sky-50 text-sky-600 border-sky-100',
  ANALYZING: 'bg-slate-50 text-slate-500 border-slate-200',
  PROMOTED: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  DISCARDED: 'bg-slate-100 text-slate-400 border-slate-200',
}

/**
 * Qué hacer con esta propiedad ahora.
 *
 * Es deliberadamente corto y NO inventa análisis: solo dice lo que se
 * desprende de lo que hay cargado.
 */
function nextStepFor(c: PropertyCandidate): string {
  if (c.status === 'PROMOTED') return 'Ya avanzaste: seguí en la operación.'
  if (c.status === 'DISCARDED') return c.discardReason ? `La descartaste: ${c.discardReason}` : 'La descartaste.'
  const missing = missingForDecision(c)
  if (missing.length > 0) return `Completá ${missing.join(' y ')} para poder compararla.`
  if (c.status === 'ANALYZING') return 'Marcala si te interesa, o descartala para sacarla del medio.'
  if (c.status === 'FAVORITE') return 'Andá a verla y marcala como visitada.'
  return 'Ya la viste: si te convence, avanzá con ella.'
}

function ComparisonTable({ candidates }: { candidates: PropertyCandidate[] }) {
  const rows = useMemo(() => buildComparison(candidates), [candidates])

  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card overflow-hidden">
      <div className="px-5 pt-4 pb-3 border-b border-slate-100">
        <p className="font-bold text-slate-900 text-sm">Comparación</p>
        <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
          VARA no elige por vos ni arma un puntaje: marca cuál gana en cada dato.
          El peso que tiene cada uno lo ponés vos.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left text-[10px] font-bold text-slate-400 uppercase tracking-wide px-5 py-2.5 w-36">Dato</th>
              {candidates.map(c => (
                <th key={c.id} className="text-left px-4 py-2.5 min-w-[140px]">
                  <span className="text-xs font-bold text-slate-800 line-clamp-2">{c.title}</span>
                  <span className="block text-[10px] text-slate-400 font-normal mt-0.5">
                    {[c.neighborhood, c.city].filter(Boolean).join(', ') || 'Sin ubicación'}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.key} className="border-b border-slate-50 last:border-0">
                <td className="px-5 py-2.5 align-top">
                  <span className="text-xs font-semibold text-slate-500">{row.label}</span>
                  {row.note && <span className="block text-[10px] text-slate-300 leading-snug mt-0.5">{row.note}</span>}
                </td>
                {row.values.map((v, i) => (
                  <td key={candidates[i].id} className="px-4 py-2.5 align-top">
                    {v === null ? (
                      <span className="text-xs text-slate-300 italic">Sin dato</span>
                    ) : (
                      <span className={`text-xs tabular-nums ${
                        row.bestIndexes.includes(i)
                          ? 'font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-md'
                          : 'text-slate-700'
                      }`}>
                        {v}
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="px-5 py-3 text-[10px] text-slate-400 border-t border-slate-50 leading-relaxed">
        Un empate no se destaca, y un dato que cargó una sola propiedad tampoco: ganar por ser
        la única con ese número no es ganar.
      </p>
    </div>
  )
}

function NotesBox({ candidate, onSave }: { candidate: PropertyCandidate; onSave: (t: string) => void }) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState(candidate.userNotes ?? '')

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="flex items-start gap-1.5 text-left w-full text-xs text-slate-400 hover:text-slate-600 transition-colors mb-3">
        <StickyNote size={11} className="mt-0.5 flex-shrink-0" />
        {candidate.userNotes
          ? <span className="text-slate-600 line-clamp-2">{candidate.userNotes}</span>
          : <span>Agregar una nota</span>}
      </button>
    )
  }

  return (
    <div className="mb-3">
      <textarea
        value={text} rows={2} autoFocus
        onChange={e => setText(e.target.value)}
        placeholder="Lo que quieras recordar de esta propiedad…"
        className="w-full border-2 border-slate-100 focus:border-brand-400 rounded-xl px-3 py-2 text-xs text-slate-700 outline-none resize-none placeholder:text-slate-300"
      />
      <div className="flex items-center gap-3 mt-1.5">
        <button
          onClick={() => { onSave(text); setOpen(false) }}
          className="text-xs font-semibold text-brand-600 hover:text-brand-700">Guardar</button>
        <button
          onClick={() => { setText(candidate.userNotes ?? ''); setOpen(false) }}
          className="text-xs text-slate-400 hover:text-slate-600">Cancelar</button>
      </div>
    </div>
  )
}

const FILTERS: { key: 'ACTIVE' | CandidateStatus; label: string }[] = [
  { key: 'ACTIVE', label: 'En juego' },
  { key: 'FAVORITE', label: 'Me interesan' },
  { key: 'VISITED', label: 'Visitadas' },
  { key: 'PROMOTED', label: 'Con operación' },
  { key: 'DISCARDED', label: 'Descartadas' },
]

export default function PropiedadesPage() {
  const [showModal, setShowModal] = useState(false)
  const [candidates, setCandidates] = useState<PropertyCandidate[]>([])
  const [loaded, setLoaded] = useState(false)
  const [filter, setFilter] = useState<'ACTIVE' | CandidateStatus>('ACTIVE')
  const [selected, setSelected] = useState<string[]>([])
  const [comparing, setComparing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setCandidates(sortCandidates(await loadCandidates()))
  }, [])

  useEffect(() => { refresh().finally(() => setLoaded(true)) }, [refresh])

  const visible = useMemo(() => candidates.filter(c =>
    filter === 'ACTIVE'
      ? c.status !== 'DISCARDED' && c.status !== 'PROMOTED'
      : c.status === filter,
  ), [candidates, filter])

  const comparable = useMemo(
    () => candidates.filter(c => selected.includes(c.id)),
    [candidates, selected],
  )

  const toggleSelected = (id: string) =>
    setSelected(s => (s.includes(id) ? s.filter(x => x !== id) : s.length >= 3 ? s : [...s, id]))

  const changeStatus = async (id: string, to: CandidateStatus) => {
    setError(null)
    const reason = to === 'DISCARDED'
      ? window.prompt('¿Por qué la descartás? (opcional — te va a servir para acordarte)') ?? undefined
      : undefined
    const r = await setCandidateStatus(id, to, { discardReason: reason || undefined })
    if (!r.ok) setError(r.reason ?? 'No pudimos guardar el cambio.')
    await refresh()
  }

  const promote = async (id: string) => {
    setError(null)
    const r = await promoteCandidate(id)
    if (!r.ok) { setError(r.reason ?? 'No pudimos avanzar.'); return }
    setSelected(s => s.filter(x => x !== id))
    await refresh()
  }

  const drop = async (id: string) => {
    if (!window.confirm('¿Sacarla de la lista? Se borra el análisis que hiciste sobre ella.')) return
    await removeCandidate(id)
    setSelected(s => s.filter(x => x !== id))
    await refresh()
  }

  const activeCount = candidates.filter(
    c => c.status !== 'DISCARDED' && c.status !== 'PROMOTED',
  ).length

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {showModal && <ImportModal onClose={() => setShowModal(false)} onImported={refresh} />}

      <header className="px-4 lg:px-6 pt-8 pb-3">
        <div className="max-w-4xl mx-auto">
          <Link href="/dashboard" className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-sm mb-4 transition-colors">
            <ArrowLeft size={14} /> Volver al inicio
          </Link>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Propiedades que estoy mirando</h1>
              <p className="text-sm text-slate-500 mt-1">
                {!loaded ? '—' : activeCount === 0 ? 'Ninguna en evaluación' : `${activeCount} en evaluación`}
              </p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="flex-shrink-0 flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors">
              <Plus size={13} /> Sumar
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 pt-4 space-y-3 pb-8">
        {error && (
          <div className="flex items-start gap-2 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2.5">
            <AlertCircle size={12} className="text-rose-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-rose-700">{error}</p>
          </div>
        )}

        {loaded && candidates.length === 0 && <EmptyState onImport={() => setShowModal(true)} />}

        {candidates.length > 0 && (
          <>
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {FILTERS.map(f => {
                const count = f.key === 'ACTIVE'
                  ? activeCount
                  : candidates.filter(c => c.status === f.key).length
                if (count === 0 && f.key !== 'ACTIVE') return null
                return (
                  <button
                    key={f.key} onClick={() => setFilter(f.key)}
                    className={`flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
                      filter === f.key
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300'
                    }`}>
                    {f.label} <span className="tabular-nums opacity-60">{count}</span>
                  </button>
                )
              })}
            </div>

            {activeCount >= 2 && (
              <div className="bg-slate-900 rounded-2xl p-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-bold text-white text-sm mb-0.5">Compará lado a lado</p>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    {selected.length === 0
                      ? 'Elegí de a dos o tres con el tilde de cada tarjeta.'
                      : selected.length === 1
                        ? 'Elegí al menos una más.'
                        : `${selected.length} elegidas${selected.length === 3 ? ' (el máximo)' : ''}.`}
                  </p>
                </div>
                <button
                  onClick={() => setComparing(c => !c)} disabled={selected.length < 2}
                  className="flex-shrink-0 flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-30 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-colors whitespace-nowrap">
                  <Columns3 size={12} /> {comparing ? 'Ocultar' : 'Comparar'}
                </button>
              </div>
            )}

            {comparing && comparable.length >= 2 && <ComparisonTable candidates={comparable} />}
          </>
        )}

        {loaded && candidates.length > 0 && visible.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-6 text-center">
            <p className="text-sm text-slate-400">No hay propiedades en este estado.</p>
          </div>
        )}

        {visible.map(prop => {
          const missing = missingForDecision(prop)
          const isSelected = selected.includes(prop.id)
          const closed = prop.status === 'PROMOTED' || prop.status === 'DISCARDED'

          return (
            <div key={prop.id}
              className={`bg-white rounded-2xl border shadow-card overflow-hidden transition-colors ${
                isSelected ? 'border-brand-400' : 'border-slate-200/70'
              } ${prop.status === 'DISCARDED' ? 'opacity-60' : ''}`}>
              <div className="relative">
                <PropertyImage neighborhood={prop.neighborhood} image={prop.images[0]} />
                <div className="absolute top-3 left-3 flex items-center gap-2">
                  <Badge variant="brand" size="sm">{getPropertyTypeLabel(prop.type)}</Badge>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_STYLE[prop.status]}`}>
                    {CANDIDATE_STATUS_LABELS[prop.status]}
                  </span>
                </div>
                {!closed && (
                  <button
                    onClick={() => toggleSelected(prop.id)}
                    aria-label={isSelected ? 'Quitar de la comparación' : 'Sumar a la comparación'}
                    className={`absolute top-3 right-3 w-7 h-7 rounded-full flex items-center justify-center border-2 transition-colors ${
                      isSelected
                        ? 'bg-brand-600 border-brand-600 text-white'
                        : 'bg-white/90 border-white text-slate-300 hover:text-slate-500'
                    }`}>
                    <Check size={14} />
                  </button>
                )}
              </div>

              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-900 text-base leading-tight">{prop.title}</h3>
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                      <MapPin size={10} />
                      {[prop.neighborhood, prop.city].filter(Boolean).join(', ') || 'Ubicación sin cargar'}
                    </p>
                  </div>
                  <div className="text-right ml-3 flex-shrink-0">
                    {prop.price > 0 ? (
                      <>
                        <p className="font-extrabold text-slate-900 text-base tabular-nums">{formatPrice(prop.price, prop.currency)}</p>
                        {prop.surface > 0 && (
                          <p className="text-xs text-slate-400 tabular-nums">
                            {prop.currency} {Math.round(prop.price / prop.surface).toLocaleString('es-AR')}/m²
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-slate-300 italic">Sin precio</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-slate-500 my-3">
                  {prop.bedrooms > 0 && <span className="flex items-center gap-1 text-xs"><Bed size={12} />{prop.bedrooms} dorm.</span>}
                  {prop.bathrooms > 0 && <span className="flex items-center gap-1 text-xs"><Bath size={12} />{prop.bathrooms} baños</span>}
                  {prop.surface > 0 && <span className="flex items-center gap-1 text-xs"><Square size={12} />{formatSurface(prop.surface)}</span>}
                  {prop.bedrooms === 0 && prop.bathrooms === 0 && prop.surface === 0 && (
                    <span className="text-xs text-slate-300 italic">Sin datos de superficie ni ambientes</span>
                  )}
                </div>

                {missing.length > 0 && (
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mb-3">
                    <AlertCircle size={11} className="text-amber-500 mt-0.5 flex-shrink-0" />
                    <p className="text-[10px] text-amber-700">
                      Falta {missing.join(' y ')}. Sin eso no se puede comparar contra las otras.
                    </p>
                  </div>
                )}

                <div className="bg-slate-50 rounded-xl px-3 py-2 mb-3">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Siguiente paso</p>
                  <p className="text-xs text-slate-600 leading-relaxed">{nextStepFor(prop)}</p>
                </div>

                {!closed && (
                  <NotesBox candidate={prop} onSave={async t => { await setCandidateNotes(prop.id, t); await refresh() }} />
                )}

                <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-50">
                  {prop.status === 'PROMOTED' && prop.promotedOperationId ? (
                    <Link href={`/operacion/${prop.promotedOperationId}`}
                      className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors">
                      Ir a la operación <ArrowRight size={12} />
                    </Link>
                  ) : prop.status === 'DISCARDED' ? (
                    <button onClick={() => changeStatus(prop.id, 'ANALYZING')}
                      className="flex items-center gap-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-600 text-xs font-semibold px-3 py-2 rounded-xl transition-colors">
                      <RotateCcw size={12} /> Recuperar
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => changeStatus(prop.id, prop.status === 'FAVORITE' ? 'ANALYZING' : 'FAVORITE')}
                        className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border transition-colors ${
                          prop.status === 'FAVORITE'
                            ? 'bg-rose-50 border-rose-100 text-rose-600'
                            : 'bg-white border-slate-200 hover:border-slate-300 text-slate-600'
                        }`}>
                        <Heart size={12} /> Me interesa
                      </button>
                      {prop.status !== 'VISITED' && (
                        <button onClick={() => changeStatus(prop.id, 'VISITED')}
                          className="flex items-center gap-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-600 text-xs font-semibold px-3 py-2 rounded-xl transition-colors">
                          <Eye size={12} /> Ya la vi
                        </button>
                      )}
                      <button onClick={() => changeStatus(prop.id, 'DISCARDED')}
                        className="flex items-center gap-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-500 text-xs font-semibold px-3 py-2 rounded-xl transition-colors">
                        <Trash2 size={12} /> Descartar
                      </button>
                      <button onClick={() => promote(prop.id)}
                        className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors ml-auto">
                        Avanzar con esta <ArrowRight size={12} />
                      </button>
                    </>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3 pt-3 mt-1">
                  {prop.sourceUrl ? (
                    <a href={prop.sourceUrl} target="_blank" rel="noopener noreferrer"
                      className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">
                      <ExternalLink size={10} /> Ver aviso original
                    </a>
                  ) : <span />}
                  <div className="flex items-center gap-3">
                    {/*
                      Ver la casa reformada es parte de decidir, no un extra:
                      "esto con la cocina abierta" cambia el voto. Solo con
                      fotos — sin imagen no hay nada que transformar.
                    */}
                    {prop.images.length > 0 && (
                      <Link href={`/propiedades/${prop.id}`}
                        className="flex items-center gap-1 text-xs font-semibold text-amber-600 hover:text-amber-700 transition-colors">
                        <Sparkles size={11} /> Ver reformada
                      </Link>
                    )}
                    <button onClick={() => drop(prop.id)} className="text-xs text-slate-300 hover:text-rose-500 transition-colors">
                      Sacar de la lista
                    </button>
                    <Link href={`/propiedades/${prop.id}`} className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors">
                      Ver ficha →
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
