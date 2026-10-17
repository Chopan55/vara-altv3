'use client'

import { useState } from 'react'
import { AlertTriangle, Check, Copy, MessageCircle, Minus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { UserOverrides } from '@/lib/analysis/normalize'
import type { PropertyAnalysis, PriorityRisk } from '@/lib/analysis/types'
import { CONDITION_TEXT, copyText, money } from './format'

export function Section({
  id, title, children, hint,
}: { id?: string; title: string; children: React.ReactNode; hint?: string }) {
  return (
    <section id={id} className="mt-10 scroll-mt-6">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {hint && <p className="mt-0.5 text-sm text-slate-500">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}

// ───────────────────────── Encaje y lo que se ve bien ─────────────────────────

export function FitSection({ analysis }: { analysis: PropertyAnalysis }) {
  const fit = analysis.userFit
  if (fit.state !== 'EVALUATED') return null
  const icon = {
    MATCH: <Check size={15} className="mt-0.5 shrink-0 text-emerald-600" />,
    MISMATCH: <X size={15} className="mt-0.5 shrink-0 text-rose-600" />,
    UNKNOWN: <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-600" />,
  }
  return (
    <Section title="Encaje con vos" hint={fit.scoreExplanation}>
      <ul className="space-y-2">
        {fit.items.map(i => (
          <li key={i.key} className="flex gap-2 text-sm text-slate-700">
            {icon[i.status]}
            <span><span className="font-medium">{i.label}.</span> {i.detail}</span>
          </li>
        ))}
      </ul>
    </Section>
  )
}

export function GoodSection({ analysis }: { analysis: PropertyAnalysis }) {
  const items: string[] = []
  const p = analysis.pricePositioning
  if (p.position === 'WITHIN' && p.confidence !== 'INSUFFICIENT') items.push('El precio publicado está dentro del rango de los avisos más comparables.')
  if (p.position === 'BELOW' && p.confidence !== 'INSUFFICIENT') items.push('El precio publicado está por debajo de los avisos más comparables.')
  analysis.userFit.items
    .filter(i => i.status === 'MATCH' && i.importance !== 'NICE_TO_HAVE')
    .slice(0, 4)
    .forEach(i => items.push(i.detail))
  if (analysis.extractionQuality.completeness >= 0.75) items.push('El aviso trae casi todos los datos clave.')
  if (items.length === 0) return null

  return (
    <Section title="Lo que se ve bien">
      <ul className="space-y-2">
        {items.slice(0, 5).map(t => (
          <li key={t} className="flex gap-2 text-sm text-slate-700">
            <Check size={15} className="mt-0.5 shrink-0 text-emerald-600" />{t}
          </li>
        ))}
      </ul>
    </Section>
  )
}

// ───────────────────────── Qué miraría ─────────────────────────

function RiskItem({ r }: { r: PriorityRisk }) {
  return (
    <li className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="font-medium text-slate-900">{r.title}</p>
      <p className="mt-1 text-sm text-slate-600">{r.reason}</p>
      {r.nextAction && <p className="mt-2 text-sm text-brand-700">→ {r.nextAction}</p>}
    </li>
  )
}

export function RisksSection({ risks }: { risks: PriorityRisk[] }) {
  const [all, setAll] = useState(false)
  if (risks.length === 0) return null
  const visible = all ? risks : risks.slice(0, 3)
  return (
    <Section title="Qué miraría antes de avanzar">
      <ul className="space-y-2">{visible.map(r => <RiskItem key={r.id} r={r} />)}</ul>
      {risks.length > 3 && (
        <button type="button" onClick={() => setAll(a => !a)}
          className="mt-3 text-sm font-medium text-brand-700 hover:underline">
          {all ? 'Ver menos' : `Ver todos (${risks.length})`}
        </button>
      )}
    </Section>
  )
}

// ───────────────────────── Lo que falta → acción ─────────────────────────

const FIELD_INPUT: Record<string, {
  kind: 'number' | 'condition'; unit?: string; build: (v: string) => UserOverrides | null
}> = {
  coveredArea: { kind: 'number', unit: 'm²', build: v => num(v, n => ({ coveredArea: n })) },
  landArea: { kind: 'number', unit: 'm²', build: v => num(v, n => ({ landArea: n })) },
  ageYears: { kind: 'number', unit: 'años', build: v => num(v, n => ({ ageYears: n }), true) },
  bathrooms: { kind: 'number', build: v => num(v, n => ({ bathrooms: n })) },
  bedrooms: { kind: 'number', build: v => num(v, n => ({ bedrooms: n })) },
  expenses: { kind: 'number', unit: 'ARS / mes', build: v => num(v, n => ({ expenses: n })) },
  price: { kind: 'number', unit: 'USD', build: v => num(v, n => ({ price: n, currency: 'USD' })) },
  condition: {
    kind: 'condition',
    build: v => (v in CONDITION_TEXT ? { condition: v as keyof typeof CONDITION_TEXT } : null),
  },
}

function num(v: string, make: (n: number) => UserOverrides, allowZero = false): UserOverrides | null {
  const n = Number(v.replace(',', '.'))
  if (!isFinite(n) || n < 0 || (n === 0 && !allowZero)) return null
  return make(n)
}

function ConfirmField({ field, onConfirm }: { field: string; onConfirm: (p: UserOverrides) => void }) {
  const spec = FIELD_INPUT[field]
  const [value, setValue] = useState('')
  if (!spec) return null
  const submit = () => {
    const patch = spec.build(value)
    if (patch) onConfirm(patch)
  }
  return (
    <div className="mt-2 flex items-center gap-2">
      {spec.kind === 'condition' ? (
        <select value={value} onChange={e => setValue(e.target.value)}
          className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm" aria-label="Estado de conservación">
          <option value="">Elegí…</option>
          {Object.entries(CONDITION_TEXT).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
      ) : (
        <input value={value} onChange={e => setValue(e.target.value)} inputMode="decimal"
          className="w-28 rounded-lg border border-slate-300 px-2 py-1.5 text-sm" aria-label={field} />
      )}
      {spec.unit && <span className="text-xs text-slate-500">{spec.unit}</span>}
      <button type="button" onClick={submit} disabled={!value}
        className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40">
        Confirmar
      </button>
    </div>
  )
}

export function MissingSection({
  analysis, onConfirm, onAction,
}: {
  analysis: PropertyAnalysis
  onConfirm: (p: UserOverrides) => void
  onAction: (kind: 'copy' | 'whatsapp') => void
}) {
  const { items, draftMessage } = analysis.missingInformation
  const [open, setOpen] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  if (items.length === 0) return null

  const count = items.length
  const title = count === 1 ? 'Me falta un dato' : `Necesito ${count === 2 ? 'dos' : count === 3 ? 'tres' : count} datos`

  return (
    <Section id="faltantes" title={title} hint="Con esto mejoro la evaluación. Si ya lo sabés, confirmalo; si no, preguntalo.">
      <ul className="space-y-2">
        {items.map(i => (
          <li key={i.field} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-slate-900">{i.label}</p>
                <p className="text-sm text-slate-500">{i.why}</p>
              </div>
              {FIELD_INPUT[i.field] && (
                <button type="button" onClick={() => setOpen(open === i.field ? null : i.field)}
                  className="shrink-0 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                  Lo sé
                </button>
              )}
            </div>
            {open === i.field && <ConfirmField field={i.field} onConfirm={p => { setOpen(null); onConfirm(p) }} />}
          </li>
        ))}
      </ul>

      {draftMessage && (
        <div className="mt-4 rounded-xl bg-slate-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Preguntar</p>
          <p className="mt-1 text-sm text-slate-800">{draftMessage}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button"
              onClick={async () => { if (await copyText(draftMessage)) { setCopied(true); onAction('copy'); setTimeout(() => setCopied(false), 2000) } }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white">
              <Copy size={14} /> {copied ? 'Copiado' : 'Copiar mensaje'}
            </button>
            <a href={`https://wa.me/?text=${encodeURIComponent(draftMessage)}`} target="_blank" rel="noopener noreferrer"
              onClick={() => onAction('whatsapp')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-white">
              <MessageCircle size={14} /> Abrir en WhatsApp
            </a>
          </div>
          <p className="mt-2 text-xs text-slate-500">VARA no envía nada: vos elegís a quién y cuándo.</p>
        </div>
      )}
    </Section>
  )
}

// ───────────────────────── Costo total ─────────────────────────

const KIND_BADGE = {
  KNOWN: 'bg-emerald-50 text-emerald-700',
  ESTIMATED: 'bg-amber-50 text-amber-700',
  NOT_INCLUDED: 'bg-slate-100 text-slate-600',
} as const
const KIND_TEXT = { KNOWN: 'Dato del aviso', ESTIMATED: 'Estimado', NOT_INCLUDED: 'No incluido' } as const

export function CostSection({ analysis }: { analysis: PropertyAnalysis }) {
  const c = analysis.estimatedTransactionCost
  if (c.lines.length === 0 && c.notIncluded.length === 0) return null

  return (
    <Section title="¿Cuánta plata podrías necesitar?" hint="Precio más costos de la operación. Los costos son un rango estimado.">
      {c.totalRange ? (
        <p className="text-2xl font-semibold text-slate-900">
          {money(c.totalRange.min, c.totalRange.currency)} – {money(c.totalRange.max, c.totalRange.currency).replace(`${c.totalRange.currency} `, '')}
        </p>
      ) : (
        <p className="text-sm text-slate-600">No puedo estimar el total con los datos disponibles.</p>
      )}
      <ul className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {c.lines.map(l => (
          <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
            <div>
              <p className="text-slate-800">{l.label}</p>
              <span className={cn('mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium', KIND_BADGE[l.kind])}>
                {KIND_TEXT[l.kind]}
              </span>
            </div>
            <p className="text-right font-medium text-slate-900">
              {l.min !== null && l.max !== null
                ? l.min === l.max ? money(l.min, l.currency) : `${money(l.min, l.currency)} – ${money(l.max, l.currency).replace(`${l.currency} `, '')}`
                : '—'}
            </p>
          </li>
        ))}
      </ul>
      {c.notIncluded.length > 0 && (
        <div className="mt-3">
          <p className="flex items-center gap-1.5 text-xs font-medium text-slate-500"><Minus size={12} /> No incluido en el total</p>
          <ul className="mt-1 list-disc pl-5 text-xs text-slate-500">
            {c.notIncluded.map(n => <li key={n}>{n}</li>)}
          </ul>
        </div>
      )}
      {c.assumptions.length > 0 && (
        <ul className="mt-3 list-disc pl-5 text-xs text-slate-500">
          {c.assumptions.map(a => <li key={a}>{a}</li>)}
        </ul>
      )}
    </Section>
  )
}

// ───────────────────────── Detalle ─────────────────────────

export function DetailSection({ analysis }: { analysis: PropertyAnalysis }) {
  const t = analysis.timings
  const sec = (ms: number | null) => (ms === null ? '—' : `${(ms / 1000).toFixed(1)} s`)
  return (
    <Section title="Detalle">
      <details className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
        <summary className="cursor-pointer font-medium">Cómo llegué a esto</summary>
        <div className="mt-3 space-y-3">
          <p>{analysis.comparableEvidence.methodology}</p>
          {analysis.pricePositioning.comparableListingRange && (
            <p className="text-slate-500">{analysis.pricePositioning.comparableListingRange.method}</p>
          )}
          <div>
            <p className="font-medium">Confianza: {analysis.pricePositioning.confidence === 'HIGH' ? 'alta' : analysis.pricePositioning.confidence === 'MEDIUM' ? 'media' : analysis.pricePositioning.confidence === 'LOW' ? 'baja' : 'insuficiente'}</p>
            <ul className="mt-1 list-disc pl-5 text-slate-600">
              {analysis.pricePositioning.confidenceReasons.map(r => <li key={r}>{r}</li>)}
            </ul>
          </div>
          <div>
            <p className="font-medium">Datos del aviso</p>
            <p className="text-slate-600">
              Leídos: {analysis.extractionQuality.present.join(', ') || 'ninguno'}.{' '}
              Sin confirmar: {analysis.extractionQuality.missing.join(', ') || 'ninguno'}.
            </p>
            {analysis.extractionQuality.warnings.map(w => <p key={w} className="text-amber-700">{w}</p>)}
          </div>
          <p className="text-xs text-slate-400">
            Reconocí la propiedad en {sec(t.timeToPropertyMs)}, encontré comparables en {sec(t.timeToComparablesMs)} y
            armé la conclusión en {sec(t.timeToConclusionMs)}.
          </p>
        </div>
      </details>
    </Section>
  )
}
