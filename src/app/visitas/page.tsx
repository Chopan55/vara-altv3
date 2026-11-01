'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, CheckCircle2, Circle, ChevronDown, ChevronUp,
  MessageSquare, StickyNote, RotateCcw, AlertTriangle, Camera,
} from 'lucide-react'
import { mockVisitChecklist } from '@/data/mock'
import { cn } from '@/lib/utils'

type ChecklistItem = { id: string; section: string; label: string; checked: boolean; note?: string }
type UserNotes = Record<string, string>

const SECTION_ORDER = ['Exterior', 'Interior', 'Entorno', 'Documentación']

const SECTION_META: Record<string, { tip: string; emoji: string; weight: number }> = {
  Exterior:      { tip: 'Revisá la fachada y techo antes de entrar. El mantenimiento exterior refleja el cuidado general del inmueble.', emoji: '🏠', weight: 25 },
  Interior:      { tip: 'Atención a manchas en techos y paredes. El olor a humedad es difícil de disimular y costoso de reparar.', emoji: '🛋️', weight: 40 },
  Entorno:       { tip: 'Si podés, visitá en distintos horarios. El ruido y el tráfico cambian mucho según la hora del día.', emoji: '🌳', weight: 20 },
  Documentación: { tip: 'Sin estos papeles no podés verificar titularidad ni deudas. No avances sin ellos.', emoji: '📄', weight: 15 },
}

function sectionScore(pct: number): { color: string; bg: string; label: string } {
  if (pct === 100) return { color: 'text-emerald-700', bg: 'bg-emerald-100', label: 'Completo' }
  if (pct >= 60)  return { color: 'text-amber-700',   bg: 'bg-amber-100',   label: 'En progreso' }
  return              { color: 'text-slate-500',     bg: 'bg-slate-100',   label: 'Pendiente' }
}

function varaRecommendation(progress: number, docsOk: boolean, interiorPct: number): { title: string; body: string; color: string } {
  if (!docsOk) return {
    title: 'Documentación incompleta — no avances',
    body: 'Sin escritura, planos y libre deuda verificados, cualquier acuerdo es prematuro. Pedile al vendedor estos documentos antes de la próxima reunión.',
    color: 'bg-red-50 border-red-200',
  }
  if (progress < 50) return {
    title: 'Checklist incompleto',
    body: 'Completá al menos el 70% antes de tomar una decisión. Quedan puntos clave sin verificar que pueden cambiar tu evaluación.',
    color: 'bg-amber-50 border-amber-200',
  }
  if (interiorPct < 80) return {
    title: 'Interior sin terminar de revisar',
    body: 'El interior tiene el mayor peso en la evaluación. Revisá especialmente humedad, instalaciones eléctricas y estado de baños y cocina.',
    color: 'bg-amber-50 border-amber-200',
  }
  if (progress === 100) return {
    title: '¡Visita completa!',
    body: 'Revisaste todo. Si los puntos críticos están ok, podés avanzar con confianza. Cualquier duda consultala con VARA antes de hacer una oferta.',
    color: 'bg-emerald-50 border-emerald-200',
  }
  return {
    title: 'Buen avance — seguí revisando',
    body: 'Estás bien encaminado. Completá los ítems restantes antes de comprometerte. El score final de la propiedad depende de esta revisión.',
    color: 'bg-blue-50 border-blue-200',
  }
}

function loadChecklist(): ChecklistItem[] {
  try {
    const saved = localStorage.getItem('vara_visit_checklist')
    if (saved) return JSON.parse(saved) as ChecklistItem[]
  } catch {}
  return mockVisitChecklist.map(i => ({ ...i, checked: false, note: undefined }))
}

function loadNotes(): UserNotes {
  try {
    const saved = localStorage.getItem('vara_visit_notes')
    if (saved) return JSON.parse(saved) as UserNotes
  } catch {}
  return {}
}

export default function VisitasPage() {
  const [items, setItems] = useState<ChecklistItem[]>(() => mockVisitChecklist.map(i => ({ ...i, checked: false, note: undefined })))
  const [notes, setNotes] = useState<UserNotes>({})
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(SECTION_ORDER))
  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [noteInput, setNoteInput] = useState('')

  useEffect(() => {
    setItems(loadChecklist())
    setNotes(loadNotes())
  }, [])

  useEffect(() => {
    try { localStorage.setItem('vara_visit_checklist', JSON.stringify(items)) } catch {}
  }, [items])

  useEffect(() => {
    try { localStorage.setItem('vara_visit_notes', JSON.stringify(notes)) } catch {}
  }, [notes])

  const toggle = (id: string) =>
    setItems(prev => prev.map(i => i.id === id ? { ...i, checked: !i.checked } : i))

  const toggleSection = (s: string) =>
    setOpenSections(prev => {
      const next = new Set(prev)
      next.has(s) ? next.delete(s) : next.add(s)
      return next
    })

  const saveNote = (id: string, text: string) => {
    setNotes(prev => ({ ...prev, [id]: text }))
    setEditingNote(null)
  }

  const resetAll = () => {
    setItems(mockVisitChecklist)
    setNotes({})
    try {
      localStorage.removeItem('vara_visit_checklist')
      localStorage.removeItem('vara_visit_notes')
    } catch {}
  }

  const total = items.length
  const done = items.filter(i => i.checked).length
  const progress = Math.round((done / total) * 100)

  const sections = SECTION_ORDER.map(s => ({
    name: s,
    items: items.filter(i => i.section === s),
    meta: SECTION_META[s],
  }))

  const docsSection = sections.find(s => s.name === 'Documentación')
  const docsOk = docsSection?.items.every(i => i.checked) ?? false
  const interiorSection = sections.find(s => s.name === 'Interior')
  const interiorItems = interiorSection?.items ?? []
  const interiorPct = interiorItems.length > 0
    ? Math.round((interiorItems.filter(i => i.checked).length / interiorItems.length) * 100)
    : 0

  const recommendation = varaRecommendation(progress, docsOk, interiorPct)

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="px-4 lg:px-6 pt-8 pb-3">
        <div className="max-w-4xl mx-auto">
                      <Link href="/dashboard" className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-sm mb-4 transition-colors">
              <ArrowLeft size={14} /> Volver al inicio
            </Link>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Checklist de visita</h1>
              {/*
                Acá había una dirección escrita a mano — "Av. Los Robles 432" —
                que no salía de ningún dato. El checklist sirve para cualquier
                propiedad, así que decimos eso en vez de inventar cuál.
              */}
              <p className="text-sm text-slate-500 mt-1">Qué mirar y qué preguntar cuando vas a ver una propiedad</p>
            </div>
            <button onClick={resetAll}
              className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors">
              <RotateCcw size={11} /> Reiniciar
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-5 space-y-4 pb-20">

        {/* Score global */}
        <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-5">
          <div className="flex items-end justify-between mb-3">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wide">Score de visita</p>
              <p className="text-3xl font-extrabold text-slate-900 mt-0.5">{progress}<span className="text-lg text-slate-400">%</span></p>
            </div>
            <p className="text-xs text-slate-400">{done}/{total} ítems verificados</p>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all duration-500',
                progress === 100 ? 'bg-emerald-500' : progress >= 60 ? 'bg-amber-500' : 'bg-slate-400')}
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* Score por categoría */}
          <div className="grid grid-cols-4 gap-2 mt-4">
            {sections.map(({ name, items: si, meta }) => {
              const pct = si.length > 0 ? Math.round((si.filter(i => i.checked).length / si.length) * 100) : 0
              const sc = sectionScore(pct)
              return (
                <div key={name} className="text-center">
                  <div className={cn('text-lg rounded-xl p-1.5 mb-1', sc.bg)}>{meta.emoji}</div>
                  <p className="text-[9px] font-bold text-slate-500 truncate">{name}</p>
                  <p className={cn('text-[10px] font-extrabold', sc.color)}>{pct}%</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Recomendación VARA */}
        <div className={cn('rounded-2xl border p-4 space-y-1', recommendation.color)}>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center flex-shrink-0">
              <span className="text-[8px] font-extrabold text-slate-900">V</span>
            </div>
            <p className="text-xs font-bold text-slate-800">{recommendation.title}</p>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed pl-7">{recommendation.body}</p>
        </div>

        {/* Secciones */}
        {sections.map(({ name, items: sectionItems, meta }) => {
          const sectionDone = sectionItems.filter(i => i.checked).length
          const pct = sectionItems.length > 0 ? Math.round((sectionDone / sectionItems.length) * 100) : 0
          const sc = sectionScore(pct)
          const isOpen = openSections.has(name)
          return (
            <div key={name} className="bg-white rounded-2xl border border-slate-200/70 shadow-card overflow-hidden">
              <button className="w-full flex items-center justify-between p-4" onClick={() => toggleSection(name)}>
                <div className="flex items-center gap-3">
                  <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center text-base', sc.bg)}>
                    {meta.emoji}
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-800 text-sm">{name}</p>
                      <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full', sc.bg, sc.color)}>
                        {pct}%
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">{sectionDone}/{sectionItems.length} ítems · peso {meta.weight}%</p>
                  </div>
                </div>
                {isOpen ? <ChevronUp size={14} className="text-slate-300" /> : <ChevronDown size={14} className="text-slate-300" />}
              </button>

              {isOpen && (
                <div className="border-t border-slate-50">
                  <p className="text-xs text-slate-400 px-4 pt-3 pb-1 italic">{meta.tip}</p>
                  <div className="divide-y divide-slate-50">
                    {sectionItems.map(item => (
                      <div key={item.id}>
                        <div className="flex items-start gap-3 px-4 py-3.5">
                          <button onClick={() => toggle(item.id)} className="flex-shrink-0 mt-0.5">
                            {item.checked
                              ? <CheckCircle2 size={18} className="text-emerald-500" />
                              : <Circle size={18} className="text-slate-300" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <button onClick={() => toggle(item.id)} className="text-left w-full">
                              <p className={cn('text-sm font-medium leading-snug',
                                item.checked ? 'text-slate-400 line-through' : 'text-slate-800')}>
                                {item.label}
                              </p>
                              {item.note && <p className="text-xs text-slate-400 mt-0.5">{item.note}</p>}
                            </button>

                            {/* Nota del usuario */}
                            {editingNote === item.id ? (
                              <div className="mt-2 space-y-1.5">
                                <textarea
                                  value={noteInput}
                                  onChange={e => setNoteInput(e.target.value)}
                                  rows={2}
                                  placeholder="Tu observación sobre este punto..."
                                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-700 focus:outline-none focus:border-brand-400 resize-none"
                                  autoFocus
                                />
                                <div className="flex gap-1.5">
                                  <button onClick={() => saveNote(item.id, noteInput)}
                                    className="flex-1 bg-slate-900 text-white text-[10px] font-bold py-1.5 rounded-lg">
                                    Guardar
                                  </button>
                                  <button onClick={() => setEditingNote(null)}
                                    className="px-3 bg-slate-100 text-slate-500 text-[10px] rounded-lg">
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => { setEditingNote(item.id); setNoteInput(notes[item.id] ?? '') }}
                                className="flex items-center gap-1 mt-1.5 text-[10px] text-slate-400 hover:text-slate-600 transition-colors"
                              >
                                <StickyNote size={10} />
                                {notes[item.id]
                                  ? <span className="italic text-brand-500">{notes[item.id]}</span>
                                  : <span>Agregar nota</span>}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {/* Alerta docs si falta */}
        {!docsOk && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-2xl p-4">
            <AlertTriangle size={16} className="text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold text-red-700">Documentación sin verificar</p>
              <p className="text-xs text-red-600 mt-0.5 leading-relaxed">
                Pedile al vendedor: escritura, planos aprobados y libre deuda de ABL/inmobiliario antes de avanzar.
              </p>
            </div>
          </div>
        )}

        {/* La oferta aparece donde nace la duda: justo antes de ir a ver la propiedad. */}
        <Link href="/vara-visit"
          className="block bg-white rounded-2xl border border-slate-200/70 shadow-card p-5 hover:shadow-elevated transition-shadow">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
              <Camera size={18} className="text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="font-bold text-slate-900 text-sm">¿Preferís no ir solo?</p>
                <span className="text-[9px] font-bold bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                  Desde USD 25
                </span>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Con VARA Visit va un profesional con vos: evalúa estado, precio y señales de alerta en el momento,
                y te deja un informe escrito.
              </p>
              <p className="text-xs font-semibold text-amber-600 mt-1.5">Ver cómo funciona →</p>
            </div>
          </div>
        </Link>

        <Link href="/asistente"
          className="flex items-center justify-center gap-2 w-full bg-slate-900 hover:bg-slate-800 rounded-2xl p-4 text-xs font-bold text-white transition-colors">
          <MessageSquare size={14} /> Consultarle a VARA sobre esta propiedad
        </Link>

      </div>
    </div>
  )
}
