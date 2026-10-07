'use client'

import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { ADJUSTMENT_FREQUENCY_LABELS, ADJUSTMENT_INDEX_LABELS, GUARANTEE_LABELS, RENTAL_JURISDICTIONS } from '@/lib/rentals'
import type { RentalCountry, RentalCurrency, RentalInput, RentalRole } from '@/lib/rentals'
import { cn } from '@/lib/utils'

export type FieldUpdater = <K extends keyof RentalInput>(key: K, value: RentalInput[K]) => void

type NumericKey = { [K in keyof RentalInput]-?: RentalInput[K] extends number | null ? K : never }[keyof RentalInput]
type BoolKey = { [K in keyof RentalInput]-?: RentalInput[K] extends boolean | null ? K : never }[keyof RentalInput]
interface Option<T extends string> { value: T; label: string }

function optionsFromLabels<T extends string>(labels: Record<T, string>): Option<T>[] {
  return (Object.keys(labels) as T[]).map(value => ({ value, label: labels[value] }))
}

const COUNTRY_OPTIONS: Option<RentalCountry>[] = [{ value: 'AR', label: 'Argentina' }, { value: 'MX', label: 'México' }]
const ROLE_OPTIONS: Option<RentalRole>[] = [{ value: 'TENANT', label: 'Inquilino' }, { value: 'OWNER', label: 'Propietario' }]
const CURRENCY_OPTIONS: Option<RentalCurrency>[] = [
  { value: 'ARS', label: 'Peso argentino (ARS)' },
  { value: 'USD', label: 'Dólar estadounidense (USD)' },
  { value: 'MXN', label: 'Peso mexicano (MXN)' },
]
const FREQUENCY_OPTIONS = optionsFromLabels(ADJUSTMENT_FREQUENCY_LABELS)
const INDEX_OPTIONS = optionsFromLabels(ADJUSTMENT_INDEX_LABELS)

type TriValue = 'yes' | 'no' | 'unknown'
const TRI_OPTIONS: Option<TriValue>[] = [{ value: 'yes', label: 'Sí' }, { value: 'no', label: 'No' }, { value: 'unknown', label: 'No sé' }]
const toTri = (v: boolean | null): TriValue => (v === true ? 'yes' : v === false ? 'no' : 'unknown')
const fromTri = (v: TriValue): boolean | null => (v === 'yes' ? true : v === 'no' ? false : null)

const CONTRACT_CHECKS: { key: BoolKey; label: string }[] = [
  { key: 'hasContract', label: 'Contrato escrito' },
  { key: 'hasPropertyDescription', label: 'Descripción del inmueble en el contrato' },
  { key: 'hasDepositReturnClause', label: 'Cláusula de devolución del depósito' },
  { key: 'hasHandoverInventory', label: 'Inventario o acta de entrega del inmueble' },
  { key: 'paysBeforeSigning', label: 'Pago solicitado antes de firmar o recibir las llaves' },
]

const NOTES_MAX = 500
const CONTROL_CLASS = 'w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-base sm:text-sm text-slate-800 focus:outline-none focus:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-500/30'
const LABEL_CLASS = 'block text-sm font-medium text-slate-700 mb-1.5'
const HINT_CLASS = 'text-xs text-slate-500 mt-1.5'
const RADIO_LABEL_CLASS = 'flex min-h-9 min-w-14 cursor-pointer items-center justify-center rounded-lg border border-transparent px-3.5 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 peer-checked:border-brand-600 peer-checked:bg-white peer-checked:text-brand-700 peer-checked:shadow-card peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500 peer-focus-visible:ring-offset-1'
const BUTTON_CLASS = 'rounded-xl px-6 py-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2'

/**
 * Interpreta un importe tipeado. Acepta coma o punto decimal y separadores de miles
 * ("450.000", "1.234,56", "1,234.56"). Devuelve null si está vacío o no es un número válido.
 * Un único separador seguido de exactamente tres dígitos se toma como miles ("450.000" = 450000).
 */
export function parseDecimal(raw: string): number | null {
  const s = raw.replace(/[\s$]/g, '')
  if (!/^[\d.,]+$/.test(s) || !/\d/.test(s)) return null
  const lastDot = s.lastIndexOf('.')
  const lastComma = s.lastIndexOf(',')
  let normalized = s
  if (lastDot >= 0 && lastComma >= 0) {
    // Ambos separadores: el último es el decimal y el otro agrupa miles.
    const pieces = s.split(lastDot > lastComma ? '.' : ',')
    if (pieces.length !== 2 || !/^\d{1,3}([.,]\d{3})+$/.test(pieces[0])) return null
    normalized = `${pieces[0].replace(/[.,]/g, '')}.${pieces[1]}`
  } else if (lastDot >= 0 || lastComma >= 0) {
    const [head, ...tail] = s.split(lastDot >= 0 ? '.' : ',')
    const grouped = tail.every(p => p.length === 3) && head.length >= 1 && head.length <= 3 && (tail.length > 1 || head !== '0')
    if (!grouped && tail.length > 1) return null
    normalized = grouped ? [head, ...tail].join('') : `${head}.${tail[0]}`
  }
  if (!/^\d*\.?\d*$/.test(normalized)) return null
  const n = Number(normalized)
  return Number.isFinite(n) && n >= 0 ? n : null
}

function SectionCard({ step, title, description, children }: { step: number; title: string; description?: string; children: React.ReactNode }) {
  const headingId = useId()
  return (
    <section aria-labelledby={headingId} className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-4 sm:p-5">
      <div className="flex items-start gap-3 mb-4">
        <span aria-hidden="true" className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">{step}</span>
        <div className="min-w-0">
          <h2 id={headingId} className="text-base font-bold text-slate-900"><span className="sr-only">Paso {step}: </span>{title}</h2>
          {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

function SelectField<T extends string>({ label, value, options, emptyLabel, hint, onChange }: {
  label: string; value: T | null; options: readonly Option<T>[]; emptyLabel?: string; hint?: string; onChange: (value: T | null) => void
}) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className={LABEL_CLASS}>{label}</label>
      <div className="relative">
        <select id={id} value={value ?? ''} aria-describedby={hint ? `${id}-hint` : undefined}
          onChange={e => onChange(options.find(o => o.value === e.target.value)?.value ?? null)}
          className={cn(CONTROL_CLASS, 'appearance-none pr-9')}>
          {emptyLabel && <option value="">{emptyLabel}</option>}
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <ChevronDown size={14} aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
      </div>
      {hint && <p id={`${id}-hint`} className={HINT_CLASS}>{hint}</p>}
    </div>
  )
}

/** Campo numérico: conserva el texto tipeado ("1." sigue siendo "1.") y emite number | null. */
function NumberField({ label, value, locale, hint, onChange }: {
  label: string; value: number | null; locale: string; hint?: string; onChange: (value: number | null) => void
}) {
  const id = useId()
  const [text, setText] = useState(value === null ? '' : String(value))
  const trimmed = text.trim()
  const parsed = parseDecimal(text)
  const invalid = trimmed !== '' && parsed === null
  // Se muestra cómo se leyó el número solo cuando hay separadores, que es donde hay ambigüedad.
  const status = invalid
    ? 'Valor no válido: se toma como dato no cargado.'
    : parsed !== null && /[.,]/.test(trimmed)
      ? `Se interpreta como ${new Intl.NumberFormat(locale, { useGrouping: false, maximumFractionDigits: 4 }).format(parsed)}.`
      : null
  const describedBy = [hint ? `${id}-hint` : '', status ? `${id}-status` : ''].filter(Boolean).join(' ')
  return (
    <div>
      <label htmlFor={id} className={LABEL_CLASS}>{label}</label>
      <input id={id} type="text" inputMode="decimal" autoComplete="off" value={text}
        aria-invalid={invalid || undefined} aria-describedby={describedBy || undefined}
        onChange={e => { setText(e.target.value); onChange(parseDecimal(e.target.value)) }}
        className={CONTROL_CLASS} />
      {hint && <p id={`${id}-hint`} className={HINT_CLASS}>{hint}</p>}
      {status && <p id={`${id}-status`} className={cn(HINT_CLASS, invalid && 'text-red-700')}>{status}</p>}
    </div>
  )
}

function Segmented<T extends string>({ legend, value, options, onChange }: {
  legend: string; value: T; options: readonly Option<T>[]; onChange: (value: T) => void
}) {
  const name = useId()
  return (
    <div role="radiogroup" aria-labelledby={`${name}-legend`}>
      <p id={`${name}-legend`} className={LABEL_CLASS}>{legend}</p>
      <div className="inline-flex max-w-full gap-1 rounded-xl bg-slate-100 p-1">
        {options.map(o => (
          <div key={o.value} className="relative">
            <input type="radio" id={`${name}-${o.value}`} name={name} value={o.value} checked={o.value === value}
              onChange={() => onChange(o.value)} className="peer sr-only" />
            <label htmlFor={`${name}-${o.value}`} className={RADIO_LABEL_CLASS}>{o.label}</label>
          </div>
        ))}
      </div>
    </div>
  )
}

function TriField({ label, value, onChange }: { label: string; value: boolean | null; onChange: (value: boolean | null) => void }) {
  return <Segmented legend={label} value={toTri(value)} options={TRI_OPTIONS} onChange={v => onChange(fromTri(v))} />
}

interface RentalCheckFormProps {
  input: RentalInput
  /** Cambia al limpiar o cambiar de país: reinicia el texto tipeado de los campos numéricos. */
  resetKey: number
  submitted: boolean
  onChange: FieldUpdater
  onCountryChange: (country: RentalCountry) => void
  onSubmit: () => void
  onReset: () => void
}

export function RentalCheckForm({ input, resetKey, submitted, onChange, onCountryChange, onSubmit, onReset }: RentalCheckFormProps) {
  const notesId = useId()
  const locale = input.country === 'MX' ? 'es-MX' : 'es-AR'
  const jurisdiction = RENTAL_JURISDICTIONS.find(j => j.jurisdiction === input.jurisdiction)
  // Solo se ofrece lo que la jurisdicción contempla; el valor actual se conserva aunque no figure.
  const guarantees = jurisdiction?.applicableGuarantees ?? []
  const guaranteeOptions = (guarantees.includes(input.guaranteeType) ? guarantees : [input.guaranteeType, ...guarantees])
    .map(value => ({ value, label: GUARANTEE_LABELS[value] }))
  const indexes = jurisdiction?.adjustmentIndexes ?? []
  const indexOptions = INDEX_OPTIONS.filter(o => indexes.includes(o.value) || o.value === input.adjustmentIndex)

  const num = (key: NumericKey, label: string, hint?: string) => (
    <NumberField key={`${key}-${resetKey}`} label={label} hint={hint} locale={locale} value={input[key]} onChange={v => onChange(key, v)} />
  )
  const tri = (key: BoolKey, label: string) => <TriField key={key} label={label} value={input[key]} onChange={v => onChange(key, v)} />

  // Un campo condicional que se oculta no debe seguir aportando un valor invisible.
  const setHasBroker = (v: boolean | null) => {
    onChange('hasBroker', v)
    if (v !== true) onChange('brokerFeeAmount', null)
  }
  const setExtraordinary = (v: boolean | null) => {
    onChange('extraordinaryExpensesToTenant', v)
    if (v !== true) onChange('extraordinaryExpensesClear', null)
  }

  return (
    <form aria-label="Datos del alquiler" noValidate className="space-y-4" onSubmit={e => { e.preventDefault(); onSubmit() }}>
      <SectionCard step={1} title="País y rol" description="Define qué reglas y qué perspectiva se usan en la revisión.">
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="País" value={input.country} options={COUNTRY_OPTIONS} onChange={v => v !== null && onCountryChange(v)} />
          <div>
            <p className={LABEL_CLASS}>Jurisdicción</p>
            <p className="rounded-xl border border-slate-200 bg-slate-100 px-4 py-2.5 text-base sm:text-sm text-slate-700">{jurisdiction?.label ?? '—'}</p>
          </div>
          <Segmented legend="Rol" value={input.role} options={ROLE_OPTIONS} onChange={v => onChange('role', v)} />
        </div>
      </SectionCard>

      <SectionCard step={2} title="Datos del alquiler" description="Lo que no se conoce se puede dejar vacío o en “No sé”: se informa como dato faltante.">
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField label="Moneda del contrato" value={input.currency} options={CURRENCY_OPTIONS} onChange={v => v !== null && onChange('currency', v)} />
          {num('monthlyRent', 'Monto del alquiler mensual')}
          {num('contractMonths', 'Duración del contrato (meses)')}
          <SelectField label="Frecuencia de ajuste" value={input.adjustmentFrequency} options={FREQUENCY_OPTIONS} emptyLabel="No definido"
            onChange={v => onChange('adjustmentFrequency', v)} />
          <SelectField label="Índice de ajuste" value={input.adjustmentIndex} options={indexOptions} emptyLabel="No definido"
            onChange={v => onChange('adjustmentIndex', v)} />
          {input.country === 'AR' && (
            <SelectField label="Moneda de los ingresos" value={input.incomeCurrency} options={CURRENCY_OPTIONS} emptyLabel="No declarado" hint="Opcional."
              onChange={v => onChange('incomeCurrency', v)} />
          )}
          {tri('isFurnished', 'Inmueble amoblado')}
        </div>
      </SectionCard>

      <SectionCard step={3} title="Garantía y costos de entrada" description={`Importes en ${input.currency}, la moneda del contrato.`}>
        <div className="grid gap-4 sm:grid-cols-2">
          {num('depositAmount', 'Depósito en garantía (importe)')}
          {num('upfrontMonths', 'Meses de alquiler por adelantado')}
          <SelectField label="Tipo de garantía" value={input.guaranteeType} options={guaranteeOptions} onChange={v => v !== null && onChange('guaranteeType', v)} />
          {num('guaranteeCost', 'Costo de la garantía (importe)')}
          <TriField label="Intermediación de inmobiliaria o corredor" value={input.hasBroker} onChange={setHasBroker} />
          {input.hasBroker === true && num('brokerFeeAmount', 'Honorarios de intermediación (importe)', 'Importe que se le pide pagar al inquilino')}
          {num('reportsAndCertificationCost', 'Informes y certificaciones (importe)')}
          {num('movingCost', 'Mudanza (importe)')}
          {num('maintenanceOrExpenses', 'Expensas o mantenimiento mensual (importe)')}
          <TriField label="Expensas extraordinarias a cargo del inquilino" value={input.extraordinaryExpensesToTenant} onChange={setExtraordinary} />
          {input.extraordinaryExpensesToTenant === true && tri('extraordinaryExpensesClear', 'El contrato detalla cuáles son y cómo se cobran')}
        </div>
      </SectionCard>

      <SectionCard step={4} title="Contrato y condiciones">
        <div className="grid gap-4 sm:grid-cols-2">{CONTRACT_CHECKS.map(c => tri(c.key, c.label))}</div>
        <div className="mt-4">
          <label htmlFor={notesId} className={LABEL_CLASS}>Notas (opcional)</label>
          <textarea id={notesId} rows={3} maxLength={NOTES_MAX} value={input.notes} aria-describedby={`${notesId}-hint`}
            onChange={e => onChange('notes', e.target.value)} className={cn(CONTROL_CLASS, 'resize-y')} />
          <p id={`${notesId}-hint`} className={cn(HINT_CLASS, 'flex justify-between gap-3')}>
            <span>Anotaciones propias; no modifican el resultado.</span>
            <span>{input.notes.length}/{NOTES_MAX}</span>
          </p>
        </div>
      </SectionCard>

      <div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <button type="submit" className={cn(BUTTON_CLASS, 'bg-brand-600 font-bold text-white hover:bg-brand-700')}>Revisar mi alquiler</button>
          <button type="button" onClick={onReset} className={cn(BUTTON_CLASS, 'border border-slate-200 bg-white font-semibold text-slate-700 hover:bg-slate-50')}>Limpiar</button>
        </div>
        <p className={HINT_CLASS}>
          Los datos se procesan en este navegador y no se guardan.
          {submitted && ' El resultado se actualiza al editar los datos.'}
        </p>
      </div>
    </form>
  )
}
