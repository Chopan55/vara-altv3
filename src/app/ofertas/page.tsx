'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, Phone, Mail, ExternalLink, MessageSquare, ChevronDown, ChevronUp,
  Star, Clock, DollarSign, AlertCircle, CheckCircle2, BarChart3, StickyNote, X, Inbox,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  MOCK_OFERTAS, ASKING_PRICE_DEMO, METODO_PAGO_LABEL, ESTADO_CONFIG,
} from '@/data/mockOfertas'
import type { OfertaConScore } from '@/data/mockOfertas'
import { RealOffersPanel } from '@/components/offers/RealOffersPanel'

function ScoreBar({ value, max, color }: { value: number; max: number; color: string }) {
  return (
    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
      <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${(value / max) * 100}%` }} />
    </div>
  )
}

function ScoreBadge({ score }: { score: number }) {
  const tier = score >= 85
    ? { label: 'Excelente', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' }
    : score >= 70
    ? { label: 'Muy buena', color: 'text-blue-700 bg-blue-50 border-blue-200' }
    : score >= 50
    ? { label: 'Aceptable', color: 'text-amber-700 bg-amber-50 border-amber-200' }
    : { label: 'Baja', color: 'text-red-600 bg-red-50 border-red-200' }
  return (
    <span className={cn('text-[11px] font-bold px-2 py-0.5 rounded-full border', tier.color)}>
      {tier.label}
    </span>
  )
}

function VaraAnalysis({ oferta }: { oferta: OfertaConScore }) {
  const pct = Math.round((oferta.offeredPrice / oferta.askingPrice) * 100)
  const lines: string[] = []
  if (oferta.paymentMethod === 'CONTADO') lines.push('✅ Pago al contado: elimina riesgo crediticio y acelera el cierre.')
  if (oferta.paymentMethod === 'HIPOTECA') lines.push('⚠️ Hipoteca bancaria: dependés de la aprobación del crédito. Pedí pre-aprobación antes de avanzar.')
  if (oferta.paymentMethod === 'CUOTAS') lines.push('🔴 Pago en cuotas: mayor riesgo de incumplimiento. Recomendamos garantía real o aval.')
  if (pct >= 100) lines.push(`💰 Ofrece el precio de publicación completo (${pct}%). Muy pocas ofertas llegan al 100%.`)
  else if (pct >= 97) lines.push(`💰 Descuento mínimo del ${100 - pct}%. Dentro del rango negociable estándar.`)
  else if (pct >= 94) lines.push(`⚠️ Descuento del ${100 - pct}%. Margen aceptable pero vale pedir una contraoferta.`)
  else lines.push(`🔴 Descuento del ${100 - pct}% sobre el precio pedido. Bastante bajo — contraofertá o rechazá.`)
  if (oferta.timelineDays <= 30) lines.push('⚡ Cierre rápido (menos de 30 días): ideal si necesitás liquidez pronto.')
  if (oferta.conditions.length === 0) lines.push('✅ Sin condiciones: oferta limpia, minimiza riesgos de caída.')
  if (oferta.conditions.length >= 2) lines.push(`⚠️ ${oferta.conditions.length} condiciones adjuntas: cada una es un punto de potencial caída. Negociá reducirlas.`)
  return (
    <div className="mt-3 bg-slate-50 rounded-xl p-3 border border-slate-100">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Análisis VARA</p>
      <ul className="space-y-1.5">
        {lines.map((l, i) => <li key={i} className="text-xs text-slate-600 leading-snug">{l}</li>)}
      </ul>
    </div>
  )
}

export default function OfertasPage() {
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [noteInput, setNoteInput] = useState('')
  // Arranca vacío: no mostramos compradores inventados como si fueran ofertas reales.
  const [ofertas, setOfertas] = useState<typeof MOCK_OFERTAS>([])
  // Si hay ofertas reales no ofrecemos el ejemplo: ya hay algo verdadero que mirar.
  const [hasReal, setHasReal] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [compareIds, setCompareIds] = useState<string[]>([])
  const [showCompare, setShowCompare] = useState(false)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('vara_oferta_notes')
      if (saved) setNotes(JSON.parse(saved))
    } catch {}
  }, [])

  function saveNote(id: string, text: string) {
    const next = { ...notes, [id]: text }
    setNotes(next)
    try { localStorage.setItem('vara_oferta_notes', JSON.stringify(next)) } catch {}
    setEditingNote(null)
  }

  function toggleCompare(id: string) {
    setCompareIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : prev.length < 3 ? [...prev, id] : prev
    )
  }

  const mostrandoEjemplo = ofertas.length > 0
  const mejorOferta = ofertas[0]
  const promedioOfrecido = ofertas.length
    ? Math.round(ofertas.reduce((s, o) => s + o.offeredPrice, 0) / ofertas.length)
    : 0

  const cargarEjemplo = () => {
    setOfertas(MOCK_OFERTAS)
    setExpanded(MOCK_OFERTAS[0]?.id ?? null)
  }
  const vaciar = () => { setOfertas([]); setExpanded(null); setCompareIds([]) }

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="px-4 lg:px-6 pt-8 pb-3">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <Link href="/dashboard" className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-sm mb-4 transition-colors">
              <ArrowLeft size={14} /> Volver al inicio
            </Link>
            <span className="text-xs font-bold tracking-widest text-brand-500">VARA</span>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Ofertas recibidas</h1>
              <p className="text-sm text-slate-500 mt-1">
                {mostrandoEjemplo ? 'Ejemplo · compradores no reales' : 'Sin ofertas todavía'}
              </p>
            </div>
            {mostrandoEjemplo && (
              <div className="flex items-center gap-1.5 text-xs bg-amber-50 border border-amber-200 text-amber-700 px-2.5 py-1 rounded-full font-semibold flex-shrink-0">
                <AlertCircle size={11} /> Ejemplo
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 pt-5">
        <RealOffersPanel onHasOffers={setHasReal} />

        {!mostrandoEjemplo && !hasReal && (
          <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-8 text-center mb-5">
            <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Inbox size={24} className="text-slate-300" />
            </div>
            <p className="font-bold text-slate-900 mb-1">Todavía no recibiste ofertas</p>
            <p className="text-sm text-slate-400 mb-5 max-w-sm mx-auto leading-relaxed">
              Cuando publiques tu propiedad y alguien haga una oferta, la vas a ver acá con el análisis
              de VARA: precio, forma de pago, plazo y condiciones.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Link href="/publicar"
                className="flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-900 text-sm font-bold px-4 py-2.5 rounded-xl transition-colors">
                Publicar mi propiedad
              </Link>
              <button onClick={cargarEjemplo}
                className="flex items-center justify-center gap-1.5 bg-white border border-slate-200 hover:border-slate-300 text-slate-500 text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
                Ver un ejemplo
              </button>
            </div>
          </div>
        )}

        {mostrandoEjemplo && (
        <>
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 mb-4">
          <AlertCircle size={13} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 flex-1">
            Estás viendo un <strong>ejemplo</strong>. Estos compradores y sus ofertas no son reales.
          </p>
          <button onClick={vaciar} className="text-xs font-bold text-amber-700 hover:text-amber-900 whitespace-nowrap">
            Vaciar
          </button>
        </div>

        {/* Resumen ejecutivo */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="bg-white rounded-2xl border border-slate-100 p-4 text-center">
            <p className="text-2xl font-extrabold text-slate-900">{ofertas.length}</p>
            <p className="text-xs text-slate-400 mt-0.5">Ofertas totales</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 p-4 text-center">
            <p className="text-lg font-extrabold text-slate-900">USD {(promedioOfrecido / 1000).toFixed(0)}k</p>
            <p className="text-xs text-slate-400 mt-0.5">Precio promedio</p>
          </div>
          <div className="bg-emerald-50 rounded-2xl border border-emerald-100 p-4 text-center">
            <p className="text-lg font-extrabold text-emerald-800">USD {(mejorOferta.offeredPrice / 1000).toFixed(0)}k</p>
            <p className="text-xs text-emerald-600 mt-0.5">Mejor oferta</p>
          </div>
        </div>

        {compareIds.length >= 2 && (
          <button
            onClick={() => setShowCompare(true)}
            className="w-full mb-4 bg-slate-900 text-white font-bold py-3 rounded-2xl text-sm flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors"
          >
            <BarChart3 size={15} /> Comparar {compareIds.length} ofertas seleccionadas
          </button>
        )}
        {compareIds.length === 1 && (
          <p className="text-xs text-slate-400 text-center mb-3">Seleccioná 1 oferta más para comparar</p>
        )}

        <div className="space-y-3 pb-20">
          {ofertas.map((oferta, idx) => {
            const isTop = idx === 0
            const isExpanded = expanded === oferta.id
            const estado = ESTADO_CONFIG[oferta.estado]
            const pct = Math.round((oferta.offeredPrice / oferta.askingPrice) * 100)
            const isCompared = compareIds.includes(oferta.id)

            return (
              <div
                key={oferta.id}
                className={cn(
                  'bg-white rounded-2xl border transition-all',
                  isTop ? 'border-emerald-200 ring-1 ring-emerald-200/60' : 'border-slate-100',
                  isCompared && 'ring-2 ring-blue-400/40'
                )}
              >
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center text-sm font-extrabold flex-shrink-0',
                      idx === 0 ? 'bg-emerald-500 text-white' : idx === 1 ? 'bg-slate-200 text-slate-600' : 'bg-slate-100 text-slate-400'
                    )}>
                      {idx === 0 ? <Star size={14} /> : idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-slate-900 text-sm">{oferta.buyerName}</p>
                        <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full', estado.bg, estado.color)}>
                          {estado.label}
                        </span>
                        <ScoreBadge score={oferta.score} />
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{oferta.portalName} · {oferta.date}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-lg font-extrabold text-slate-900">USD {oferta.offeredPrice.toLocaleString('es-AR')}</p>
                      <p className={cn('text-xs font-semibold', pct >= 97 ? 'text-emerald-600' : pct >= 94 ? 'text-amber-600' : 'text-red-500')}>
                        {pct}% del precio
                      </p>
                    </div>
                  </div>

                  {/* Score breakdown */}
                  <div className="mt-3 grid grid-cols-4 gap-2">
                    {[
                      { label: 'Precio', value: oferta.scoreDetalle.precio, max: 40, color: 'bg-emerald-500' },
                      { label: 'Pago', value: oferta.scoreDetalle.metodoPago, max: 30, color: 'bg-blue-500' },
                      { label: 'Plazo', value: oferta.scoreDetalle.timeline, max: 20, color: 'bg-amber-500' },
                      { label: 'Condic.', value: oferta.scoreDetalle.condiciones, max: 10, color: 'bg-purple-500' },
                    ].map(d => (
                      <div key={d.label}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[9px] text-slate-400 font-medium">{d.label}</span>
                          <span className="text-[9px] font-bold text-slate-600">{d.value}/{d.max}</span>
                        </div>
                        <ScoreBar value={d.value} max={d.max} color={d.color} />
                      </div>
                    ))}
                  </div>

                  {/* Pills resumen */}
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    <span className="flex items-center gap-1 text-[10px] bg-slate-50 text-slate-600 border border-slate-100 px-2 py-0.5 rounded-full">
                      <DollarSign size={9} /> {METODO_PAGO_LABEL[oferta.paymentMethod]}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] bg-slate-50 text-slate-600 border border-slate-100 px-2 py-0.5 rounded-full">
                      <Clock size={9} /> {oferta.timelineDays} días para escriturar
                    </span>
                    {oferta.conditions.length === 0 ? (
                      <span className="flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full">
                        <CheckCircle2 size={9} /> Sin condiciones
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10px] bg-amber-50 text-amber-700 border border-amber-100 px-2 py-0.5 rounded-full">
                        <AlertCircle size={9} /> {oferta.conditions.length} condición{oferta.conditions.length > 1 ? 'es' : ''}
                      </span>
                    )}
                  </div>

                  {/* Acciones rápidas */}
                  <div className="flex gap-2 mt-3">
                    <a href={`tel:${oferta.buyerPhone}`}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-2.5 rounded-xl transition-colors">
                      <Phone size={12} /> {oferta.buyerPhone}
                    </a>
                    <a href={oferta.portalUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold px-3 py-2.5 rounded-xl transition-colors">
                      <ExternalLink size={12} /> {oferta.portalName}
                    </a>
                    <button
                      onClick={() => toggleCompare(oferta.id)}
                      title={isCompared ? 'Quitar de comparativa' : 'Agregar a comparativa'}
                      className={cn(
                        'flex items-center justify-center gap-1 text-xs font-semibold px-3 py-2.5 rounded-xl transition-colors',
                        isCompared ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                      )}
                    >
                      <BarChart3 size={12} />
                    </button>
                  </div>
                </div>

                {/* Expandible toggle */}
                <button
                  onClick={() => setExpanded(isExpanded ? null : oferta.id)}
                  className="w-full flex items-center justify-between px-4 py-2.5 border-t border-slate-50 text-xs text-slate-400 hover:bg-slate-50 transition-colors rounded-b-2xl"
                >
                  <span>{isExpanded ? 'Menos detalles' : 'Ver análisis VARA + datos de contacto'}</span>
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3 border-t border-slate-50">
                    {/* Contacto completo */}
                    <div className="pt-3">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Contacto</p>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-xs text-slate-700">
                          <Phone size={11} className="text-slate-400" />
                          <a href={`tel:${oferta.buyerPhone}`} className="hover:underline">{oferta.buyerPhone}</a>
                        </div>
                        {oferta.buyerEmail && (
                          <div className="flex items-center gap-2 text-xs text-slate-700">
                            <Mail size={11} className="text-slate-400" />
                            <a href={`mailto:${oferta.buyerEmail}`} className="hover:underline">{oferta.buyerEmail}</a>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Condiciones */}
                    {oferta.conditions.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Condiciones de la oferta</p>
                        <ul className="space-y-1">
                          {oferta.conditions.map((c, i) => (
                            <li key={i} className="flex items-start gap-1.5 text-xs text-amber-700">
                              <AlertCircle size={10} className="mt-0.5 flex-shrink-0" /> {c}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <VaraAnalysis oferta={oferta} />

                    {/* Notas */}
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Mis notas</p>
                      {editingNote === oferta.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={noteInput}
                            onChange={e => setNoteInput(e.target.value)}
                            rows={3}
                            placeholder="Ej: Familia joven, muy interesados. Flexible en fecha si bajamos 2k..."
                            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-blue-400 resize-none"
                            autoFocus
                          />
                          <div className="flex gap-2">
                            <button onClick={() => saveNote(oferta.id, noteInput)}
                              className="flex-1 bg-slate-900 text-white text-xs font-bold py-2 rounded-xl">
                              Guardar
                            </button>
                            <button onClick={() => setEditingNote(null)}
                              className="px-3 bg-slate-100 text-slate-500 text-xs rounded-xl">
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setEditingNote(oferta.id); setNoteInput(notes[oferta.id] ?? '') }}
                          className="w-full flex items-center gap-2 text-left border border-dashed border-slate-200 rounded-xl px-3 py-2.5 hover:border-slate-300 transition-colors"
                        >
                          <StickyNote size={12} className="text-slate-400 flex-shrink-0" />
                          <span className="text-xs text-slate-400 italic">
                            {notes[oferta.id] || 'Agregar nota sobre esta oferta...'}
                          </span>
                        </button>
                      )}
                    </div>

                    <Link href="/asistente"
                      className="flex items-center gap-2 w-full bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs py-2.5 px-3 rounded-xl transition-colors border border-slate-100">
                      <MessageSquare size={12} /> Consultarle a VARA sobre esta oferta
                    </Link>
                  </div>
                )}
              </div>
            )
          })}
        </div>
        </>
        )}
      </div>

      {/* Modal comparativa */}
      {showCompare && (
        <div className="fixed inset-0 bg-slate-900/70 z-50 flex items-end sm:items-center justify-center p-2 sm:p-4" onClick={() => setShowCompare(false)}>
          <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between">
              <h2 className="font-bold text-slate-900">Comparativa de ofertas</h2>
              <button onClick={() => setShowCompare(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-left text-slate-400 font-medium pb-3 pr-4">Criterio</th>
                    {compareIds.map(id => {
                      const o = ofertas.find(x => x.id === id)!
                      return (
                        <th key={id} className="text-left text-slate-800 font-bold pb-3 pr-4 min-w-[140px]">
                          {o.buyerName.split(' ')[0]}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {([
                    { label: 'Precio ofrecido', render: (o: OfertaConScore) => `USD ${o.offeredPrice.toLocaleString('es-AR')}` },
                    { label: '% del precio pedido', render: (o: OfertaConScore) => `${Math.round((o.offeredPrice / o.askingPrice) * 100)}%` },
                    { label: 'Método de pago', render: (o: OfertaConScore) => METODO_PAGO_LABEL[o.paymentMethod] },
                    { label: 'Plazo escritura', render: (o: OfertaConScore) => `${o.timelineDays} días` },
                    { label: 'Condiciones', render: (o: OfertaConScore) => o.conditions.length === 0 ? 'Sin condiciones' : `${o.conditions.length} condiciones` },
                    { label: 'Puntuación VARA', render: (o: OfertaConScore) => `${o.score}/100` },
                    { label: 'Portal de origen', render: (o: OfertaConScore) => o.portalName },
                  ] as { label: string; render: (o: OfertaConScore) => string }[]).map(row => (
                    <tr key={row.label}>
                      <td className="py-2.5 pr-4 text-slate-500 font-medium">{row.label}</td>
                      {compareIds.map(id => {
                        const o = ofertas.find(x => x.id === id)!
                        return <td key={id} className="py-2.5 pr-4 text-slate-800 font-semibold">{row.render(o)}</td>
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
