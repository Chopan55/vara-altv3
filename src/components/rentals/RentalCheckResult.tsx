'use client'

import { useId, useMemo, useState } from 'react'
import { AlertOctagon, AlertTriangle, ChevronDown, ExternalLink, Info } from 'lucide-react'
import type {
  ChecklistItem, ConfidenceLevel, CostItem, GuaranteeNote, RentalCheckResult as RentalCheckData,
  RentalCurrency, RentalRole, RuleConfidence, RuleFinding, Severity, SourceRef,
} from '@/lib/rentals'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'

/*
 * Presentación pura del resultado: todo el contenido legal llega en `result`.
 * Solo se monta después de pedir la revisión (nunca en el render del servidor),
 * así que formatear con Intl no genera diferencias de hidratación.
 */

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info' | 'brand'

const SEVERITY: Record<Severity, { label: string; order: number; badge: BadgeVariant; card: string; Icon: typeof Info }> = {
  HIGH: { label: 'Severidad alta', order: 0, badge: 'error', card: 'border-red-200 bg-red-50/60', Icon: AlertOctagon },
  MEDIUM: { label: 'Severidad media', order: 1, badge: 'warning', card: 'border-amber-200 bg-amber-50/60', Icon: AlertTriangle },
  LOW: { label: 'Severidad baja', order: 2, badge: 'info', card: 'border-slate-200 bg-white', Icon: Info },
}
const CONFIDENCE_LEVEL: Record<ConfidenceLevel, { label: string; badge: BadgeVariant }> = {
  HIGH: { label: 'Alta', badge: 'success' },
  MEDIUM: { label: 'Media', badge: 'warning' },
  LOW: { label: 'Baja', badge: 'error' },
}
const RULE_CONFIDENCE: Record<RuleConfidence, { label: string; badge: BadgeVariant }> = {
  VERIFIED: { label: 'Verificada', badge: 'success' },
  NEEDS_REVIEW: { label: 'Requiere revisión', badge: 'warning' },
}

const formatterCache = new Map<RentalCurrency, Intl.NumberFormat>()

function formatMoney(amount: number, currency: RentalCurrency): string {
  if (!Number.isFinite(amount)) return '—'
  let formatter = formatterCache.get(currency)
  if (!formatter) {
    formatter = new Intl.NumberFormat(currency === 'MXN' ? 'es-MX' : 'es-AR', {
      style: 'currency', currency, minimumFractionDigits: 0, maximumFractionDigits: 2,
    })
    formatterCache.set(currency, formatter)
  }
  return formatter.format(amount)
}

interface Alert {
  key: string
  kind: 'RISK' | 'CONTRACT'
  finding: RuleFinding
}

function mergeAlerts(result: RentalCheckData): Alert[] {
  const alerts: Alert[] = [
    ...result.riskFlags.map(finding => ({ key: `risk-${finding.ruleId}`, kind: 'RISK' as const, finding })),
    ...result.contractAlerts.map(finding => ({ key: `contract-${finding.ruleId}`, kind: 'CONTRACT' as const, finding })),
  ]
  return alerts.sort((a, b) => SEVERITY[a.finding.severity].order - SEVERITY[b.finding.severity].order)
}

/** Una fuente repetida se muestra una vez; si alguna copia requiere revisión, se conserva ese estado. */
function dedupeSources(sources: SourceRef[]): SourceRef[] {
  const byKey = new Map<string, SourceRef>()
  for (const source of sources) {
    const key = source.url || source.label
    const existing = byKey.get(key)
    if (!existing) byKey.set(key, source)
    else if (source.confidence === 'NEEDS_REVIEW') byKey.set(key, { ...existing, confidence: 'NEEDS_REVIEW' })
  }
  return Array.from(byKey.values())
}

function Block({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId} className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-4 sm:p-5">
      <h3 id={headingId} className="text-sm font-bold text-slate-900">{title}</h3>
      {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}

function SourceLink({ source }: { source: SourceRef }) {
  if (!/^https?:\/\//i.test(source.url)) return <span className="font-medium text-slate-700">{source.label}</span>
  return (
    <a href={source.url} target="_blank" rel="noopener noreferrer"
      className="inline-flex items-center gap-1 rounded font-medium text-brand-700 underline underline-offset-2 hover:text-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
      {source.label}
      <ExternalLink size={11} aria-hidden="true" />
      <span className="sr-only">(se abre en una pestaña nueva)</span>
    </a>
  )
}

function ConfidenceBadge({ confidence }: { confidence: RuleConfidence }) {
  return <Badge variant={RULE_CONFIDENCE[confidence].badge}>{RULE_CONFIDENCE[confidence].label}</Badge>
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-900 p-5 text-white">
      <p className="text-sm font-medium text-slate-300 mb-1">{label}</p>
      <p className="text-2xl sm:text-3xl font-extrabold tracking-tight break-words">{value}</p>
    </div>
  )
}

function CostTable({ caption, items, total, currency }: { caption: string; items: CostItem[]; total: number; currency: RentalCurrency }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card overflow-hidden">
      <table className="w-full text-sm">
        <caption className="px-4 py-3 bg-slate-50 border-b border-slate-100 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">{caption}</caption>
        <tbody>
          {items.map(item => (
            <tr key={item.id} className="border-b border-slate-50 last:border-0">
              <th scope="row" className={cn('px-4 py-3 text-left align-top font-medium', item.declared ? 'text-slate-800' : 'text-slate-500')}>
                {item.label}
                {item.note && <span className="mt-0.5 block text-xs font-normal text-slate-500">{item.note}</span>}
              </th>
              <td className="px-4 py-3 text-right align-top whitespace-nowrap">
                {item.declared
                  ? <span className="font-semibold text-slate-900">{formatMoney(item.amount, item.currency)}</span>
                  : <span className="italic text-slate-500">Sin dato</span>}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-slate-100 bg-slate-50">
            <th scope="row" className="px-4 py-3 text-left font-bold text-slate-700">Total</th>
            <td className="px-4 py-3 text-right font-bold text-brand-700 whitespace-nowrap">{formatMoney(total, currency)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function CostsSection({ result, role }: { result: RentalCheckData; role: RentalRole }) {
  const hasUndeclared = [...result.entryCostItems, ...result.monthlyCostItems].some(i => !i.declared)
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Figure label="Costo para entrar" value={formatMoney(result.entryTotal, result.currency)} />
        <Figure label="Costo mensual estimado" value={formatMoney(result.monthlyTotal, result.currency)} />
      </div>
      {role === 'OWNER' && <p className="text-xs text-slate-600">Importes desde la perspectiva de lo que paga el inquilino al entrar y por mes.</p>}
      {hasUndeclared && (
        <p className="text-xs text-slate-600">Los ítems marcados “Sin dato” se toman como cero: los totales pueden quedar por debajo del costo real.</p>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        <CostTable caption="Detalle del costo para entrar" items={result.entryCostItems} total={result.entryTotal} currency={result.currency} />
        <CostTable caption="Detalle del costo mensual" items={result.monthlyCostItems} total={result.monthlyTotal} currency={result.currency} />
      </div>
    </div>
  )
}

function AlertCard({ alert: { finding, kind } }: { alert: Alert }) {
  const sev = SEVERITY[finding.severity]
  return (
    <li className={cn('rounded-xl border p-4', sev.card)}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <sev.Icon size={16} aria-hidden="true" className="text-slate-700" />
        <Badge variant={sev.badge}>{sev.label}</Badge>
        <Badge>{kind === 'RISK' ? 'Riesgo' : 'Contrato'}</Badge>
      </div>
      <h4 className="text-sm font-semibold text-slate-900">{finding.title}</h4>
      <p className="mt-1 text-sm leading-relaxed text-slate-700">{finding.explanation}</p>
      <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600">
        <span>Fuente:</span>
        <SourceLink source={finding.source} />
        <ConfidenceBadge confidence={finding.source.confidence} />
      </p>
    </li>
  )
}

function AlertsSection({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-semibold text-slate-800">Sin alertas con los datos cargados</p>
        <p className="mt-1 text-xs leading-relaxed text-slate-600">
          Esto no significa que no existan riesgos: la revisión solo cubre los datos ingresados y las reglas que esta herramienta contempla.
        </p>
      </div>
    )
  }
  return <ul className="space-y-3">{alerts.map(a => <AlertCard key={a.key} alert={a} />)}</ul>
}

function ChecklistGroup({ title, items, done, onToggle }: {
  title: string; items: ChecklistItem[]; done: ReadonlySet<string>; onToggle: (id: string) => void
}) {
  if (items.length === 0) return null
  return (
    <div>
      <h4 className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">{title}</h4>
      <ul>
        {items.map(item => (
          <li key={item.id}>
            <label className="flex cursor-pointer items-start gap-3 rounded-lg px-1 py-2 hover:bg-slate-50">
              <input type="checkbox" checked={done.has(item.id)} onChange={() => onToggle(item.id)}
                className="mt-0.5 h-5 w-5 flex-shrink-0 accent-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500" />
              <span className={cn('text-sm leading-relaxed', done.has(item.id) ? 'text-slate-500 line-through' : 'text-slate-800')}>{item.text}</span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  )
}

function ChecklistSection({ items }: { items: ChecklistItem[] }) {
  const [done, setDone] = useState<ReadonlySet<string>>(() => new Set())
  const toggle = (id: string) =>
    setDone(prev => {
      const next = new Set(prev)
      if (!next.delete(id)) next.add(id)
      return next
    })
  if (items.length === 0) return <p className="text-sm text-slate-600">No hay pasos para mostrar con los datos cargados.</p>
  return (
    <div className="space-y-4">
      <ChecklistGroup title="Imprescindible" items={items.filter(i => i.priority === 'MUST')} done={done} onToggle={toggle} />
      <ChecklistGroup title="Recomendado" items={items.filter(i => i.priority !== 'MUST')} done={done} onToggle={toggle} />
      <p className="text-xs text-slate-500">{items.filter(i => done.has(i.id)).length} de {items.length} marcados. Las marcas no se guardan.</p>
    </div>
  )
}

function GuaranteeBody({ note }: { note: GuaranteeNote }) {
  return (
    <>
      <p className="text-sm leading-relaxed text-slate-700">{note.summary}</p>
      {note.caveats.length > 0 && (
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-slate-600">
          {note.caveats.map((caveat, i) => <li key={`${i}-${caveat}`}>{caveat}</li>)}
        </ul>
      )}
    </>
  )
}

function GuaranteeSection({ notes, currency }: { notes: GuaranteeNote[]; currency: RentalCurrency }) {
  if (notes.length === 0) return <p className="text-sm text-slate-600">No hay notas de garantía para mostrar.</p>
  const ordered = [...notes].sort((a, b) => Number(b.selected) - Number(a.selected))
  return (
    <ul className="space-y-3">
      {ordered.map(note => note.selected ? (
        <li key={note.type} className="rounded-xl border-2 border-brand-500 bg-brand-50/60 p-4">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-slate-900">{note.label}</h4>
            <Badge variant="brand">Garantía declarada</Badge>
          </div>
          {note.declaredCost !== null && (
            <p className="mb-1.5 text-xs font-medium text-slate-700">Costo declarado: {formatMoney(note.declaredCost, currency)}</p>
          )}
          <GuaranteeBody note={note} />
        </li>
      ) : (
        <li key={note.type}>
          <details className="rounded-xl border border-slate-200 bg-white">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 [&::-webkit-details-marker]:hidden">
              {note.label}
              <ChevronDown size={14} aria-hidden="true" className="flex-shrink-0 text-slate-500" />
            </summary>
            <div className="px-4 pb-4"><GuaranteeBody note={note} /></div>
          </details>
        </li>
      ))}
    </ul>
  )
}

function MissingSection({ items }: { items: RentalCheckData['missingData'] }) {
  if (items.length === 0) return <p className="text-sm text-slate-600">No se detectaron datos faltantes con lo cargado.</p>
  return (
    <ul className="space-y-2">
      {items.map(item => (
        <li key={String(item.field)} className="text-sm leading-relaxed">
          <span className="font-semibold text-slate-800">{item.label}</span>
          <span className="text-slate-600"> — {item.why}</span>
        </li>
      ))}
    </ul>
  )
}

function SourcesSection({ result }: { result: RentalCheckData }) {
  const sources = useMemo(() => dedupeSources(result.sources), [result.sources])
  const level = CONFIDENCE_LEVEL[result.confidenceLevel]
  return (
    <div className="space-y-4">
      <div>
        <p className="flex flex-wrap items-center gap-2 text-sm text-slate-800">
          Nivel de confianza de la revisión: <Badge size="md" variant={level.badge}>{level.label}</Badge>
        </p>
        {result.confidenceReasons.length > 0 && (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-slate-600">
            {result.confidenceReasons.map((reason, i) => <li key={`${i}-${reason}`}>{reason}</li>)}
          </ul>
        )}
      </div>
      {sources.length > 0 && (
        <ul className="space-y-2">
          {sources.map(source => (
            <li key={source.url || source.label} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <SourceLink source={source} />
              <ConfidenceBadge confidence={source.confidence} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function RentalCheckResult({ result, role }: { result: RentalCheckData; role: RentalRole }) {
  const headingId = useId()
  const alerts = useMemo(() => mergeAlerts(result), [result])
  return (
    <section aria-labelledby={headingId} aria-live="polite" className="space-y-4">
      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">5</span>
        <div className="min-w-0">
          <h2 id={headingId} className="text-base font-bold text-slate-900"><span className="sr-only">Paso 5: </span>Resultado</h2>
          <p className="mt-0.5 text-xs text-slate-500">Estimación orientativa con los datos cargados. Se actualiza al editar el formulario.</p>
        </div>
      </div>
      <CostsSection result={result} role={role} />
      <Block title="Alertas principales" description="Ordenadas de mayor a menor severidad."><AlertsSection alerts={alerts} /></Block>
      <Block title="Checklist antes de firmar"><ChecklistSection items={result.signingChecklist} /></Block>
      <Block title="Garantía / caución / póliza"><GuaranteeSection notes={result.guaranteeNotes} currency={result.currency} /></Block>
      <Block title="Datos que faltan"><MissingSection items={result.missingData} /></Block>
      <Block title="Fuentes y nivel de confianza"><SourcesSection result={result} /></Block>
      <div role="note" className="flex gap-2 rounded-2xl bg-amber-50 p-4">
        <Info size={16} aria-hidden="true" className="mt-0.5 flex-shrink-0 text-amber-600" />
        <p className="text-xs leading-relaxed text-amber-800">{result.disclaimer}</p>
      </div>
    </section>
  )
}
