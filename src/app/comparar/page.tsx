'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowLeft, BarChart2, Bed, Bath, Sparkles, SlidersHorizontal, Crown, Car, Sun, Paintbrush,
  Receipt, CalendarClock, Ruler, DollarSign, TrendingDown, TrendingUp, Minus, AlertCircle,
  ChevronDown, Home,
} from 'lucide-react'
import { formatPrice, cn } from '@/lib/utils'
import { loadUserProperties, type UserProperty } from '@/lib/userProperties'
import { analyzePricePosition } from '@/lib/market/priceReference'
import {
  scoreCandidates, explainWinner, mergeScoringWeights, weightsWithData, dataCoverage,
  criterionValue, isLowerBetter, DEFAULT_SCORING_WEIGHTS, SCORING_CRITERION_LABELS,
  LIGHT_LABELS, CONDITION_LABELS,
  type ScoringCriterion, type ScoringWeight, type ManualAttrs, type LightLevel, type ConditionLevel,
} from '@/lib/candidates/model'
import { loadProfile, profileToImportance } from '@/lib/buyerProfile'

const MAX_COMPARE = 3
const WEIGHTS_KEY = 'vara_compare_weights'
const MANUAL_KEY = 'vara_compare_manual'

// ───────────────────────────── Ponderación ─────────────────────────────

type Importance = 0 | 1 | 2 | 3 | 4 | 5

const IMPORTANCE_LABELS = ['No cuenta', 'Poco', 'Algo', 'Importante', 'Mucho', 'Clave']

/** El orden en que se le pregunta a la persona qué le importa. */
const CRITERIA_ORDER: ScoringCriterion[] = [
  'price', 'price_m2', 'surface', 'bedrooms', 'bathrooms', 'age', 'condition', 'light',
  'garage', 'amenities', 'expenses', 'rooms',
]

const CRITERION_HINTS: Partial<Record<ScoringCriterion, string>> = {
  light: 'Lo cargás vos en la tabla',
  condition: 'Lo cargás vos en la tabla',
  price_m2: 'Para comparar casas de distinto tamaño',
}

const PRESETS: { id: string; label: string; hint: string; values: Partial<Record<ScoringCriterion, Importance>> }[] = [
  {
    id: 'balanced', label: 'Equilibrado', hint: 'Un poco de todo',
    values: { price_m2: 4, price: 3, surface: 3, bedrooms: 2, bathrooms: 2, age: 2, condition: 2, light: 2, amenities: 1, garage: 1, expenses: 1 },
  },
  {
    id: 'family', label: 'Para una familia', hint: 'Espacio, baños y jardín',
    values: { bedrooms: 5, bathrooms: 4, surface: 4, amenities: 4, light: 3, garage: 3, condition: 3, price: 3, price_m2: 2, age: 2 },
  },
  {
    id: 'invest', label: 'Inversión', hint: 'Precio y costo de tenerla',
    values: { price_m2: 5, price: 4, expenses: 4, age: 3, condition: 3, surface: 2 },
  },
  {
    id: 'movein', label: 'Para mudarme ya', hint: 'Estado y luz',
    values: { condition: 5, light: 5, age: 3, amenities: 3, bathrooms: 2, price: 2 },
  },
]

function weightsFromImportance(values: Partial<Record<ScoringCriterion, Importance>>): ScoringWeight[] {
  return DEFAULT_SCORING_WEIGHTS.map(def => {
    const imp = values[def.criterion] ?? 0
    return { criterion: def.criterion, enabled: imp > 0, weight: imp * 20 }
  })
}

function importanceOf(weights: ScoringWeight[], criterion: ScoringCriterion): Importance {
  const w = weights.find(x => x.criterion === criterion)
  if (!w || !w.enabled || w.weight <= 0) return 0
  return Math.min(5, Math.max(1, Math.round(w.weight / 20))) as Importance
}

// ───────────────────────────── Piezas visuales ─────────────────────────────

function PosIcon({ position }: { position: string }) {
  if (position === 'BELOW') return <TrendingDown size={12} className="text-emerald-600" aria-label="Por debajo del mercado" />
  if (position === 'ABOVE') return <TrendingUp size={12} className="text-rose-500" aria-label="Por encima del mercado" />
  return <Minus size={12} className="text-slate-300" aria-hidden="true" />
}

function MatchRing({ value, winner }: { value: number; winner: boolean }) {
  const r = 18
  const c = 2 * Math.PI * r
  return (
    <div className="relative w-12 h-12 flex-shrink-0" role="img" aria-label={`Afinidad ${value} de 100`}>
      <svg viewBox="0 0 44 44" className="-rotate-90 w-12 h-12" aria-hidden="true">
        <circle cx="22" cy="22" r={r} fill="none" strokeWidth="4" className="stroke-slate-100" />
        <circle
          cx="22" cy="22" r={r} fill="none" strokeWidth="4" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - value / 100)}
          className={winner ? 'stroke-emerald-500' : 'stroke-brand-400'}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[13px] font-extrabold text-slate-900 tabular-nums">
        {value}
      </span>
    </div>
  )
}

function ImportanceDots({ level }: { level: Importance }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`Importancia: ${IMPORTANCE_LABELS[level]}`}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className={cn('w-1 h-1 rounded-full', i <= level ? 'bg-brand-500' : 'bg-slate-200')} />
      ))}
    </span>
  )
}

const PROP_TYPE_LABEL: Record<string, string> = {
  HOUSE: 'Casa', APARTMENT: 'Depto.', PH: 'PH', LAND: 'Terreno',
  GARAGE: 'Cochera', LOCAL: 'Local', OFFICE: 'Oficina', FIELD: 'Campo', OTHER: 'Otro',
}

/** Un nombre corto para distinguir una propiedad de otra en un botón. */
function shortName(p: UserProperty): string {
  return p.neighborhood || p.city || p.title.split(/\s+/).slice(0, 3).join(' ')
}

const MISSING = <span className="text-slate-300" title="Falta este dato">—</span>

// ───────────────────────────── Filas de la tabla ─────────────────────────────

interface RowDef {
  criterion: ScoringCriterion
  label: string
  icon: LucideIcon
  cell: (p: UserProperty) => React.ReactNode | null
  manual?: 'light' | 'condition'
}

function buildRows(): RowDef[] {
  return [
    {
      criterion: 'price', label: 'Precio', icon: DollarSign,
      cell: p => (p.price > 0 ? <span className="font-extrabold text-slate-900">{formatPrice(p.price, p.currency)}</span> : null),
    },
    {
      criterion: 'price_m2', label: 'Precio por m²', icon: Receipt,
      cell: p => {
        if (!(p.price > 0 && p.surface > 0)) return null
        const usdm2 = Math.round(p.price / p.surface)
        const { position } = analyzePricePosition(usdm2, p.province ?? '')
        return (
          <span className="inline-flex items-center gap-1.5 font-bold text-slate-800">
            {usdm2.toLocaleString('es-AR')} <PosIcon position={position} />
          </span>
        )
      },
    },
    {
      criterion: 'surface', label: 'Superficie', icon: Ruler,
      cell: p => (p.surface > 0
        ? <span className="font-bold text-slate-800">{p.surface} m²{p.coveredSurface ? <span className="block text-[10px] font-medium text-slate-400">{p.coveredSurface} m² cubiertos</span> : null}</span>
        : null),
    },
    {
      criterion: 'bedrooms', label: 'Dormitorios', icon: Bed,
      cell: p => (p.bedrooms > 0 ? <span className="inline-flex items-center gap-1 font-bold text-slate-800"><Bed size={13} className="text-slate-400" aria-hidden="true" />{p.bedrooms}</span> : null),
    },
    {
      criterion: 'bathrooms', label: 'Baños', icon: Bath,
      cell: p => (p.bathrooms > 0 ? <span className="inline-flex items-center gap-1 font-bold text-slate-800"><Bath size={13} className="text-slate-400" aria-hidden="true" />{p.bathrooms}</span> : null),
    },
    {
      criterion: 'age', label: 'Antigüedad', icon: CalendarClock,
      cell: p => {
        const age = criterionValue(p, 'age')
        if (age === null) return null
        return <span className="font-bold text-slate-800">{age === 0 ? 'A estrenar' : `${age} años`}</span>
      },
    },
    {
      criterion: 'condition', label: 'Estado', icon: Paintbrush, manual: 'condition',
      cell: () => null,
    },
    {
      criterion: 'light', label: 'Luz natural', icon: Sun, manual: 'light',
      cell: () => null,
    },
    {
      criterion: 'garage', label: 'Cochera', icon: Car,
      cell: p => (criterionValue(p, 'garage') ? <span className="font-bold text-slate-800">Sí</span> : null),
    },
    {
      criterion: 'amenities', label: 'Amenities', icon: Home,
      cell: p => {
        const list = p.features.filter(f => !/antig[uü]edad/i.test(f))
        if (list.length === 0) return null
        return (
          <div className="flex flex-wrap gap-1 justify-center">
            {list.slice(0, 4).map(f => (
              <span key={f} className="text-[10px] bg-slate-50 text-slate-600 px-1.5 py-0.5 rounded-full border border-slate-100">{f}</span>
            ))}
            {list.length > 4 && <span className="text-[10px] text-slate-400">+{list.length - 4}</span>}
          </div>
        )
      },
    },
    {
      criterion: 'expenses', label: 'Expensas', icon: Receipt,
      cell: p => (p.expenses && p.expenses > 0 ? <span className="font-bold text-slate-800">ARS {p.expenses.toLocaleString('es-AR')}</span> : null),
    },
  ]
}

/** Ids que ganan una fila. Con un solo dato o con empate no se destaca a nadie. */
function bestIds(props: UserProperty[], criterion: ScoringCriterion, manual: Record<string, ManualAttrs>): string[] {
  const vals = props.map(p => criterionValue(p, criterion, manual[p.id]))
  const known = vals.filter((v): v is number => v !== null)
  if (known.length < 2) return []
  const target = isLowerBetter(criterion) ? Math.min(...known) : Math.max(...known)
  if (known.every(v => v === target)) return []
  return props.filter((_, i) => vals[i] === target).map(p => p.id)
}

// ───────────────────────────── Página ─────────────────────────────

export default function CompararPage() {
  const [properties, setProperties] = useState<UserProperty[]>([])
  const [loaded, setLoaded] = useState(false)
  const [selected, setSelected] = useState<string[]>([])
  const [weights, setWeights] = useState<ScoringWeight[]>(() => weightsFromImportance(PRESETS[0].values))
  const [manual, setManual] = useState<Record<string, ManualAttrs>>({})
  const [panelOpen, setPanelOpen] = useState(true)
  const [fromProfile, setFromProfile] = useState<Partial<Record<ScoringCriterion, Importance>>>({})

  useEffect(() => {
    setFromProfile(profileToImportance(loadProfile()) as Partial<Record<ScoringCriterion, Importance>>)
    loadUserProperties().then(ps => {
      setProperties(ps)
      setSelected(prev => (prev.length === 0 ? ps.slice(0, MAX_COMPARE).map(p => p.id) : prev))
      setLoaded(true)
    })
    try {
      const raw = localStorage.getItem(WEIGHTS_KEY)
      if (raw) setWeights(mergeScoringWeights(JSON.parse(raw)))
    } catch {}
    try {
      const raw = localStorage.getItem(MANUAL_KEY)
      if (raw) setManual(JSON.parse(raw) as Record<string, ManualAttrs>)
    } catch {}
  }, [])

  const updateWeights = (next: ScoringWeight[]) => {
    setWeights(next)
    try { localStorage.setItem(WEIGHTS_KEY, JSON.stringify(next)) } catch {}
  }

  const setImportance = (criterion: ScoringCriterion, level: Importance) =>
    updateWeights(weights.map(w => (w.criterion === criterion ? { ...w, enabled: level > 0, weight: level * 20 } : w)))

  const setManualAttr = (id: string, key: 'light' | 'condition', raw: string) => {
    setManual(prev => {
      const current: ManualAttrs = { ...prev[id] }
      if (!raw) delete current[key]
      else if (key === 'light') current.light = Number(raw) as LightLevel
      else current.condition = Number(raw) as ConditionLevel
      const next = { ...prev, [id]: current }
      try { localStorage.setItem(MANUAL_KEY, JSON.stringify(next)) } catch {}
      return next
    })
  }

  const toggle = (id: string) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : prev.length < MAX_COMPARE ? [...prev, id] : prev,
    )
  }

  const compared = useMemo(
    () => selected.map(id => properties.find(p => p.id === id)).filter(Boolean) as UserProperty[],
    [selected, properties],
  )
  const rows = useMemo(buildRows, [])

  /** A, B, C: la forma de nombrar cada columna aunque dos casas compartan barrio. */
  const letterOf = (id: string) => String.fromCharCode(65 + Math.max(0, compared.findIndex(p => p.id === id)))
  const buttonLabel = (p: UserProperty) => {
    const name = shortName(p)
    const repeated = compared.filter(x => shortName(x) === name).length > 1
    return `${letterOf(p.id)} · ${name}${repeated && p.price > 0 ? ` · ${formatPrice(p.price, p.currency)}` : ''}`
  }

  const activeWeights = useMemo(() => weightsWithData(compared, weights, manual), [compared, weights, manual])
  const scores = useMemo(() => scoreCandidates(compared, activeWeights, manual), [compared, activeWeights, manual])
  const ranking = useMemo(() => [...scores].sort((a, b) => b.score - a.score), [scores])
  const why = useMemo(() => explainWinner(scores), [scores])
  const hasWeights = activeWeights.length > 0
  const winnerId = hasWeights && ranking.length >= 2 && ranking[0].score > ranking[1].score ? ranking[0].candidateId : null
  const matchOf = (id: string) => scores.find(s => s.candidateId === id)?.score ?? 0

  const missingFor = (p: UserProperty) =>
    activeWeights
      .filter(w => w.criterion !== 'garage' && criterionValue(p, w.criterion, manual[p.id]) === null)
      .map(w => SCORING_CRITERION_LABELS[w.criterion].toLowerCase())

  const topCriteria = CRITERIA_ORDER
    .filter(c => importanceOf(weights, c) >= 4)
    .map(c => SCORING_CRITERION_LABELS[c])

  if (!loaded) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-slate-400 animate-spin" />
      </div>
    )
  }

  const cols = `150px repeat(${compared.length}, minmax(0, 1fr))`

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <div className="max-w-5xl mx-auto px-4 py-6">

        <div className="flex items-center gap-3 mb-6">
          <Link href="/propiedades" className="text-slate-400 hover:text-slate-700 transition-colors" aria-label="Volver a mis propiedades">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-[var(--foreground)] leading-tight">Comparar propiedades</h1>
            <p className="text-xs text-slate-400 mt-0.5">Elegí hasta {MAX_COMPARE} y decidí qué te importa más</p>
          </div>
        </div>

        {properties.length === 0 && (
          <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-8 text-center">
            <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <BarChart2 size={20} className="text-slate-300" />
            </div>
            <p className="text-sm font-semibold text-slate-800 mb-1">Sin propiedades guardadas</p>
            <p className="text-xs text-slate-400 max-w-xs mx-auto mb-4">
              Importá propiedades desde un aviso de Zonaprop o Argenprop para compararlas.
            </p>
            <Link href="/propiedades" className="inline-block text-xs font-bold bg-brand-600 text-white px-4 py-2 rounded-xl hover:bg-brand-700 transition-colors">
              Ir a mis propiedades →
            </Link>
          </div>
        )}

        {properties.length > 0 && (
          <div className="mb-5 space-y-2">
            {properties.map(p => {
              const isSelected = selected.includes(p.id)
              const disabled = !isSelected && selected.length >= MAX_COMPARE
              const incomplete = !(p.surface > 0) || !(p.price > 0)
              return (
                <button
                  key={p.id}
                  onClick={() => !disabled && toggle(p.id)}
                  aria-pressed={isSelected}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-2xl border text-left transition-all w-full',
                    isSelected
                      ? 'bg-brand-50 border-brand-300'
                      : disabled
                      ? 'bg-white border-slate-200/70 opacity-40 cursor-not-allowed'
                      : 'bg-white border-slate-200/70 shadow-card hover:border-brand-300 hover:bg-brand-50/30',
                  )}
                >
                  <div className={cn(
                    'w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0',
                    isSelected ? 'bg-brand-600 border-brand-600' : 'border-slate-300',
                  )}>
                    {isSelected && <span className="text-white text-[9px] font-black">✓</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{p.title}</p>
                    <p className="text-xs text-slate-400 truncate">{[p.neighborhood, p.city].filter(Boolean).join(', ')}</p>
                  </div>
                  {incomplete && (
                    <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                      <AlertCircle size={10} aria-hidden="true" /> Faltan datos
                    </span>
                  )}
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold text-slate-900">{p.price > 0 ? formatPrice(p.price, p.currency) : '—'}</p>
                    <p className="text-[10px] text-slate-400">{p.surface > 0 ? `${p.surface} m²` : 'sin superficie'}</p>
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {compared.length === 1 && (
          <p className="text-center text-sm text-slate-400 py-4">Seleccioná al menos una más para comparar</p>
        )}

        {compared.length >= 2 && (
          <div className="space-y-4">

            {/* ── Qué te importa ── */}
            <section className="bg-white rounded-2xl border border-slate-200/70 shadow-card overflow-hidden">
              <button
                onClick={() => setPanelOpen(o => !o)}
                aria-expanded={panelOpen}
                className="w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-slate-50/60 transition-colors"
              >
                <span className="w-8 h-8 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center flex-shrink-0">
                  <SlidersHorizontal size={15} aria-hidden="true" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold text-slate-900">Qué te importa más</span>
                  <span className="block text-xs text-slate-400 truncate">
                    {topCriteria.length > 0 ? `Lo que más pesa: ${topCriteria.join(', ')}` : 'Marcá qué criterios cuentan para decidir'}
                  </span>
                </span>
                <ChevronDown size={16} className={cn('text-slate-400 transition-transform', panelOpen && 'rotate-180')} aria-hidden="true" />
              </button>

              {panelOpen && (
                <div className="px-4 pb-4 border-t border-slate-100">
                  <div className="flex flex-wrap gap-1.5 pt-3.5">
                    {PRESETS.map(preset => (
                      <button
                        key={preset.id}
                        onClick={() => updateWeights(weightsFromImportance(preset.values))}
                        title={preset.hint}
                        className="text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-brand-50 hover:text-brand-700 border border-slate-200/70 rounded-full px-3 py-1.5 transition-colors"
                      >
                        {preset.label}
                      </button>
                    ))}
                    {Object.keys(fromProfile).length > 0 ? (
                      <button
                        onClick={() => updateWeights(weightsFromImportance(fromProfile))}
                        title="Toma lo que cargaste en Mi búsqueda"
                        className="text-xs font-semibold text-brand-700 bg-brand-50 border border-brand-200 rounded-full px-3 py-1.5"
                      >
                        Usar mi búsqueda
                      </button>
                    ) : (
                      <Link href="/mi-busqueda" className="text-xs font-semibold text-slate-500 underline px-2 py-1.5">Cargar mi búsqueda</Link>
                    )}
                  </div>

                  <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3.5 mt-4">
                    {CRITERIA_ORDER.map(criterion => {
                      const level = importanceOf(weights, criterion)
                      const id = `imp-${criterion}`
                      return (
                        <div key={criterion}>
                          <div className="flex items-baseline justify-between gap-2 mb-1">
                            <label htmlFor={id} className="text-xs font-semibold text-slate-700">
                              {SCORING_CRITERION_LABELS[criterion]}
                            </label>
                            <span className={cn('text-[11px] font-medium', level === 0 ? 'text-slate-300' : 'text-brand-600')}>
                              {IMPORTANCE_LABELS[level]}
                            </span>
                          </div>
                          <input
                            id={id}
                            type="range" min={0} max={5} step={1} value={level}
                            onChange={e => setImportance(criterion, Number(e.target.value) as Importance)}
                            className="w-full accent-[var(--color-brand-600)] cursor-pointer"
                            aria-valuetext={IMPORTANCE_LABELS[level]}
                          />
                          {CRITERION_HINTS[criterion] && (
                            <p className="text-[10px] text-slate-400 mt-0.5">{CRITERION_HINTS[criterion]}</p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </section>

            {/* ── Tabla ── */}
            <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card overflow-x-auto">
              <div className="min-w-[640px]">

                <div className="grid border-b border-slate-100" style={{ gridTemplateColumns: cols }}>
                  <div className="p-3 flex items-end">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Propiedad</span>
                  </div>
                  {compared.map(p => {
                    const isWinner = p.id === winnerId
                    const coverage = dataCoverage(p, activeWeights, manual[p.id])
                    return (
                      <div key={p.id} className={cn('p-3 border-l border-slate-100', isWinner && 'bg-emerald-50/50')}>
                        <div className="flex items-start gap-2.5">
                          <MatchRing value={hasWeights ? matchOf(p.id) : 0} winner={isWinner} />
                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-1.5 text-[10px] font-bold text-brand-600 uppercase tracking-wider">
                              <span
                                className="w-4 h-4 rounded bg-slate-900 text-white text-[9px] flex items-center justify-center"
                                aria-label={`Propiedad ${letterOf(p.id)}`}
                              >
                                {letterOf(p.id)}
                              </span>
                              {PROP_TYPE_LABEL[p.type] ?? p.type}
                            </p>
                            <p className="text-xs font-semibold text-slate-800 leading-tight line-clamp-2">{p.title}</p>
                            <p className="text-[10px] text-slate-400 truncate mt-0.5">{[p.neighborhood, p.city].filter(Boolean).join(', ')}</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {isWinner && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                              <Crown size={10} aria-hidden="true" /> Mejor para vos
                            </span>
                          )}
                          {coverage < 0.7 && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full" title={`Faltan: ${missingFor(p).join(', ')}`}>
                              <AlertCircle size={10} aria-hidden="true" /> Datos incompletos
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>

                {rows.map(row => {
                  const level = importanceOf(weights, row.criterion)
                  const best = bestIds(compared, row.criterion, manual)
                  const Icon = row.icon
                  return (
                    <div
                      key={row.criterion}
                      className={cn('grid border-b border-slate-100 last:border-0 transition-opacity', level === 0 && 'opacity-60')}
                      style={{ gridTemplateColumns: cols }}
                    >
                      <div className="p-3 flex flex-col justify-center gap-1">
                        <span className="flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                          <Icon size={12} className="text-slate-400" aria-hidden="true" /> {row.label}
                        </span>
                        <ImportanceDots level={level} />
                      </div>
                      {compared.map(p => {
                        const isBest = best.includes(p.id)
                        return (
                          <div
                            key={p.id}
                            className={cn(
                              'p-3 border-l border-slate-100 flex items-center justify-center gap-1 text-sm text-center',
                              isBest && 'bg-emerald-50/60',
                            )}
                          >
                            {row.manual === 'light' && (
                              <select
                                value={manual[p.id]?.light ?? ''}
                                onChange={e => setManualAttr(p.id, 'light', e.target.value)}
                                aria-label={`Luz natural de ${p.title}`}
                                className="text-xs rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-slate-700 max-w-full"
                              >
                                <option value="">Sin cargar</option>
                                {([1, 2, 3] as LightLevel[]).map(l => <option key={l} value={l}>{LIGHT_LABELS[l]}</option>)}
                              </select>
                            )}
                            {row.manual === 'condition' && (
                              <select
                                value={manual[p.id]?.condition ?? ''}
                                onChange={e => setManualAttr(p.id, 'condition', e.target.value)}
                                aria-label={`Estado de ${p.title}`}
                                className="text-xs rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-slate-700 max-w-full"
                              >
                                <option value="">Sin cargar</option>
                                {([1, 2, 3, 4] as ConditionLevel[]).map(c => <option key={c} value={c}>{CONDITION_LABELS[c]}</option>)}
                              </select>
                            )}
                            {!row.manual && (row.cell(p) ?? MISSING)}
                            {isBest && <span className="text-emerald-500 text-[9px] font-black flex-shrink-0" aria-label="Mejor de la fila">✦</span>}
                          </div>
                        )
                      })}
                    </div>
                  )
                })}

                {/* Un botón por propiedad, debajo de su columna y con su nombre. */}
                <div className="grid p-3 gap-2" style={{ gridTemplateColumns: cols }}>
                  <div />
                  {compared.map(p => (
                    <Link
                      key={p.id}
                      href={`/propiedades/${p.id}`}
                      aria-label={`Ver potencial de ${p.title}`}
                      className="flex flex-col items-center justify-center gap-0.5 text-brand-700 bg-brand-50 border border-brand-200 rounded-xl py-2.5 px-2 hover:bg-brand-100 transition-colors min-w-0"
                    >
                      <span className="flex items-center gap-1.5 text-xs font-semibold"><Sparkles size={11} aria-hidden="true" /> Ver potencial</span>
                      <span className="text-[10px] text-brand-600/80 truncate max-w-full">{buttonLabel(p)}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Análisis ── */}
            <div className="bg-slate-900 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles size={14} className="text-amber-400" aria-hidden="true" />
                <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">Análisis VARA</span>
                <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Según tus prioridades</span>
              </div>

              {!hasWeights ? (
                <p className="text-sm text-slate-100 leading-relaxed">
                  Marcá arriba qué te importa para que VARA pueda ordenarlas.
                </p>
              ) : winnerId ? (
                <p className="text-sm text-slate-100 leading-relaxed">
                  <span className="font-bold text-white">{compared.find(p => p.id === winnerId)?.title}</span> es la que mejor encaja con lo que marcaste
                  {why.length > 0 && <>: se destaca en <span className="font-semibold text-white">{why.map(c => SCORING_CRITERION_LABELS[c].toLowerCase()).join(', ')}</span></>}.
                </p>
              ) : (
                <p className="text-sm text-slate-100 leading-relaxed">
                  Están parejas según tus prioridades. Si ajustás qué te importa más, se va a notar la diferencia.
                </p>
              )}

              {hasWeights && (
                <ol className="mt-4 space-y-1.5">
                  {ranking.map((s, i) => {
                    const p = compared.find(x => x.id === s.candidateId)!
                    return (
                      <li key={s.candidateId} className="flex items-center gap-3 text-sm">
                        <span className="w-5 text-center text-xs font-bold text-slate-500">{i + 1}</span>
                        <span className="flex-1 min-w-0 truncate text-slate-200">{letterOf(p.id)} · {p.title}</span>
                        <span className="text-xs font-bold text-white tabular-nums">{s.score}</span>
                      </li>
                    )
                  })}
                </ol>
              )}

              {compared.some(p => dataCoverage(p, activeWeights, manual[p.id]) < 0.7) && (
                <div className="mt-4 rounded-xl bg-slate-800 px-3.5 py-3 text-xs text-slate-300 leading-relaxed">
                  <p className="font-semibold text-amber-300 mb-1">Ojo con los datos que faltan</p>
                  {compared.filter(p => dataCoverage(p, activeWeights, manual[p.id]) < 0.7).map(p => (
                    <p key={p.id}>
                      <span className="text-slate-100">{letterOf(p.id)} · {shortName(p)}:</span> faltan {missingFor(p).join(', ')}. Su puntaje puede estar subestimado.
                    </p>
                  ))}
                </div>
              )}

              <p className="text-[10px] text-slate-400 mt-4 leading-relaxed">
                El puntaje compara solo estas propiedades entre sí y solo con lo que cargaste o trajo el aviso. No reemplaza una tasación profesional.
              </p>
            </div>

          </div>
        )}

      </div>
    </div>
  )
}
