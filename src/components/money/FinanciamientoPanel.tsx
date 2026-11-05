'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { ChevronRight, CheckCircle2, AlertCircle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useOperations } from '@/hooks/useOperations'
import { useJurisdiction } from '@/hooks/useJurisdiction'

type PaymentMethod = 'CASH' | 'MORTGAGE' | 'MIXED'

/**
 * Valores de arranque del simulador.
 *
 * A diferencia de la calculadora de costos, acá un cero deja la pantalla
 * inservible: no se puede simular un crédito sin monto ni tasa. Así que
 * arrancamos con un ejemplo y lo decimos con todas las letras, en vez de que
 * parezca tu caso. No mostramos tasas "de bancos": cambian todo el tiempo y
 * una tasa vieja con el nombre de un banco real parece un dato verdadero.
 *
 * Los gastos de cierre NO se calculan acá: la única fuente de costos es la
 * pestaña Costos (generateChecklist). Acá solo se enlaza.
 */
const EXAMPLE_PRICE = 185_000
const EXAMPLE_DOWN_PAYMENT_RATE = 0.3
const EXAMPLE_RATE = 10
/** Regla habitual de los bancos: la cuota no debería pasar ~30% del ingreso. */
const MAX_INSTALLMENT_SHARE = 0.3

export function FinanciamientoPanel() {
  const { activeOperation } = useOperations()
  const j = useJurisdiction(activeOperation?.country ?? null)
  const fmt = (n: number) => `USD ${Math.round(n).toLocaleString(j.locale)}`
  const fmtLocal = (n: number) => `${j.currencySymbol}${Math.round(n).toLocaleString(j.locale)} ${j.localCurrency}`
  const closing = j.professionalLabels.CLOSING_PROFESSIONAL.replace('/a', '').toLowerCase()

  const [method, setMethod] = useState<PaymentMethod>('MORTGAGE')
  const [price, setPrice] = useState(EXAMPLE_PRICE)
  const [downPayment, setDownPayment] = useState(Math.round(EXAMPLE_PRICE * EXAMPLE_DOWN_PAYMENT_RATE))
  const [priceFromProperty, setPriceFromProperty] = useState(false)

  useEffect(() => {
    let alive = true
    import('@/lib/candidates/store')
      .then(m => m.loadCandidates())
      .then(list => {
        if (!alive) return
        const real = list.find(c => c.price > 0 && c.status !== 'DISCARDED')
        if (real) {
          setPrice(real.price)
          setDownPayment(Math.round(real.price * EXAMPLE_DOWN_PAYMENT_RATE))
          setPriceFromProperty(true)
        }
      })
      .catch(() => { /* sin propiedad cargada, queda el ejemplo */ })
    return () => { alive = false }
  }, [])
  const [term, setTerm] = useState(20)
  const [rate, setRate] = useState(EXAMPLE_RATE)
  const [rateTouched, setRateTouched] = useState(false)
  const [fxRate, setFxRate] = useState<number | ''>('')

  const downPaymentExceedsPrice = method === 'MORTGAGE' && price > 0 && downPayment > price
  const downPaymentEqualsPrice = method === 'MORTGAGE' && price > 0 && downPayment === price
  const loan = Math.max(0, price - downPayment)
  const ltv = price > 0 ? (loan / price) * 100 : 0
  const r = rate / 100 / 12
  const n = term * 12
  const monthly = loan > 0 && n > 0 ? (r > 0 ? loan * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1) : loan / n) : 0
  const totalPaid = monthly * n
  const totalInterest = totalPaid - loan
  const fx = typeof fxRate === 'number' && fxRate > 0 ? fxRate : null

  const costsLink = (
    <Link href="/dinero?tab=costos" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline">
      Ver gastos de cierre en Costos <ChevronRight size={12} />
    </Link>
  )

  return (
    <div className="">
      <header className="px-4 lg:px-6 pt-8 pb-3">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Financiamiento</h2>
          <p className="text-sm text-slate-500 mt-1">
            {priceFromProperty
              ? 'Contado vs crédito hipotecario, sobre el precio de tu propiedad'
              : 'Contado vs crédito hipotecario — los valores son un ejemplo, cambialos por los tuyos'}
          </p>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 pt-4 space-y-4">
        {/* Method */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">¿Cómo querés pagar?</p>
          <div className="grid grid-cols-3 gap-2">
            {([['CASH', 'Contado', '💵'], ['MORTGAGE', 'Crédito', '🏦'], ['MIXED', 'Mixto', '⚖️']] as [PaymentMethod, string, string][]).map(([m, label, emoji]) => (
              <button key={m} onClick={() => setMethod(m)} aria-pressed={method === m}
                className={cn('py-3 rounded-xl border text-xs font-semibold transition-all flex flex-col items-center gap-1',
                  method === m ? 'bg-slate-900 border-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:border-slate-300')}>
                <span className="text-lg" aria-hidden="true">{emoji}</span>{label}
              </button>
            ))}
          </div>
        </div>

        {/* Inputs */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tus números</p>
          <div>
            <label htmlFor="fin-price" className="text-xs font-semibold text-slate-600 mb-1.5 block">Precio de la propiedad</label>
            <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2">
              <span className="text-xs text-slate-400">USD</span>
              <input id="fin-price" type="number" inputMode="numeric" min={0} value={price}
                onChange={e => { const v = Math.max(0, +e.target.value); setPrice(v); setDownPayment(Math.round(v * EXAMPLE_DOWN_PAYMENT_RATE)) }}
                className="flex-1 text-sm font-semibold text-slate-900 focus:outline-none bg-transparent" />
            </div>
          </div>

          {method !== 'CASH' && (
            <>
              <div>
                <div className="flex justify-between mb-1.5">
                  <label htmlFor="fin-down" className="text-xs font-semibold text-slate-600">Entrada (lo que ponés vos)</label>
                  <span className="text-xs text-slate-400">{price > 0 ? Math.round(downPayment / price * 100) : 0}%</span>
                </div>
                <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2">
                  <span className="text-xs text-slate-400">USD</span>
                  <input id="fin-down" type="number" inputMode="numeric" min={0} value={downPayment}
                    onChange={e => setDownPayment(Math.max(0, +e.target.value))}
                    className="flex-1 text-sm font-semibold text-slate-900 focus:outline-none bg-transparent" />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1.5">
                  <label htmlFor="fin-term" className="text-xs font-semibold text-slate-600">Plazo</label>
                  <span className="text-xs text-slate-400">{term} años</span>
                </div>
                <input id="fin-term" type="range" min={5} max={30} step={5} value={term} onChange={e => setTerm(+e.target.value)} className="w-full accent-amber-400" />
              </div>
              <div>
                <label htmlFor="fin-rate" className="text-xs font-semibold text-slate-600 mb-1.5 block">Tasa anual del crédito</label>
                <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2">
                  <input id="fin-rate" type="number" inputMode="decimal" min={0} step={0.1} value={rate}
                    onChange={e => { setRate(Math.max(0, +e.target.value)); setRateTouched(true) }}
                    className="flex-1 text-sm font-semibold text-slate-900 focus:outline-none bg-transparent" />
                  <span className="text-xs text-slate-400">%</span>
                </div>
                {!rateTouched && (
                  <p className="text-[11px] text-amber-700 mt-1">Tasa de ejemplo. Poné la que te ofrezca tu banco: cambia seguido y entre bancos.</p>
                )}
              </div>
            </>
          )}

          <div>
            <label htmlFor="fin-fx" className="text-xs font-semibold text-slate-600 mb-1.5 block">
              Tipo de cambio USD/{j.localCurrency} <span className="font-normal text-slate-400">(opcional)</span>
            </label>
            <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2">
              <span className="text-xs text-slate-400">{j.currencySymbol}</span>
              <input id="fin-fx" type="number" inputMode="decimal" min={0} value={fxRate} placeholder={`Cuántos ${j.localCurrency} vale 1 USD hoy`}
                onChange={e => setFxRate(e.target.value === '' ? '' : Math.max(0, +e.target.value))}
                className="flex-1 text-sm font-semibold text-slate-900 focus:outline-none bg-transparent placeholder:font-normal placeholder:text-slate-300" />
            </div>
          </div>
        </div>

        {/* Results */}
        {method === 'CASH' && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Resumen — Contado</p>
            <div className="flex justify-between items-center">
              <span className="font-bold text-slate-900">Precio</span>
              <span className="font-extrabold text-slate-900 text-lg">{fmt(price)}</span>
            </div>
            {fx && <p className="text-right text-[11px] text-slate-400 mt-0.5">{fmtLocal(price * fx)}</p>}
            <p className="text-xs text-slate-500 mt-2">A esto sumale los gastos de cierre: impuestos, honorarios de {closing} y registro.</p>
            <div className="mt-1">{costsLink}</div>
            <div className="mt-3 bg-emerald-50 rounded-xl p-3 flex items-start gap-2">
              <CheckCircle2 size={14} className="text-emerald-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-emerald-700">Sin intereses ni aprobación bancaria. Suele ser lo más rápido si tenés el capital.</p>
            </div>
          </div>
        )}

        {method === 'MORTGAGE' && downPaymentEqualsPrice && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle size={16} className="text-slate-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-slate-700">Sin préstamo</p>
              <p className="text-xs text-slate-500 mt-0.5">La entrada cubre el precio completo. No necesitás crédito.</p>
            </div>
          </div>
        )}

        {method === 'MORTGAGE' && downPaymentExceedsPrice && (
          <div role="alert" className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-700">La entrada supera el precio</p>
              <p className="text-xs text-red-600 mt-0.5">La entrada no puede ser mayor al precio de la propiedad. Corregí el valor para ver el cálculo.</p>
            </div>
          </div>
        )}

        {method === 'MORTGAGE' && !downPaymentExceedsPrice && !downPaymentEqualsPrice && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
                <p className="text-[10px] text-slate-400 mb-1">Cuota mensual estimada</p>
                <p className="font-extrabold text-slate-900 text-xl">{fmt(monthly)}</p>
                {fx && <p className="text-[11px] text-slate-400 mt-0.5">{fmtLocal(monthly * fx)}/mes</p>}
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
                <p className="text-[10px] text-slate-400 mb-1">Préstamo</p>
                <p className="font-extrabold text-slate-900 text-xl">{fmt(loan)}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{Math.round(ltv)}% del precio</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Desglose</p>
              {[['Entrada', fmt(downPayment)], ['Préstamo', fmt(loan)], [`Intereses (${term} años, ${rate}%)`, fmt(totalInterest)], ['Total que le devolvés al banco', fmt(totalPaid)]].map(([l, v]) => (
                <div key={l} className="flex justify-between text-sm gap-3"><span className="text-slate-500">{l}</span><span className="font-semibold text-slate-700 text-right">{v}</span></div>
              ))}
              <div className="flex justify-between items-center pt-2 border-t border-slate-100 gap-3">
                <span className="font-bold text-slate-900">Entrada + crédito</span>
                <span className="font-extrabold text-slate-900 text-lg text-right">{fmt(downPayment + totalPaid)}</span>
              </div>
              <p className="text-xs text-slate-500 pt-1">No incluye gastos de cierre.</p>
              {costsLink}
            </div>
            <div className="rounded-2xl p-4 border bg-slate-50 border-slate-200">
              <div className="flex items-start gap-2">
                <Info size={16} className="text-slate-500 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-sm text-slate-800">
                    Ingreso mensual sugerido: {fmt(monthly / MAX_INSTALLMENT_SHARE)}
                    {fx && <span className="font-normal text-slate-500"> ({fmtLocal((monthly / MAX_INSTALLMENT_SHARE) * fx)})</span>}
                  </p>
                  <p className="text-xs mt-0.5 text-slate-500">
                    Los bancos suelen pedir que la cuota no pase el 30% del ingreso. Cada banco fija cuánto
                    financia como máximo y con qué tasa: confirmalo antes de ofertar.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        {method === 'MIXED' && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Ejemplo de estructura mixta</p>
            <div className="space-y-3">
              {[
                { label: `Ahorro propio (USD o ${j.localCurrency})`, pct: 40, desc: `${j.depositLabel} y pagos parciales` },
                { label: 'Crédito hipotecario', pct: 40, desc: 'Lo desembolsa el banco en la firma' },
                { label: 'Saldo al cierre', pct: 20, desc: `Se paga en la firma ante ${closing}` },
              ].map(({ label, pct, desc }) => (
                <div key={label} className="bg-slate-50 rounded-xl p-3">
                  <div className="flex justify-between items-center mb-1 gap-3">
                    <span className="font-semibold text-slate-900 text-sm">{label}</span>
                    <span className="font-bold text-brand-500 text-sm text-right">{pct}% · {fmt(price * pct / 100)}</span>
                  </div>
                  <p className="text-xs text-slate-400">{desc}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
              <Info size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700">Los porcentajes son un ejemplo: cada operación se arma distinto. VARA te ayuda a coordinar cada tramo con {closing}, el banco y la otra parte.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
