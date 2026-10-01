'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { ArrowLeft, ChevronRight, Bitcoin, CheckCircle2, AlertCircle, Info } from 'lucide-react'
import { VaraLogo } from '@/components/ui/VaraLogo'
import { cn } from '@/lib/utils'

type PaymentMethod = 'CASH' | 'MORTGAGE' | 'MIXED'

const banks = [
  { name: 'Banco Nación',    rate: 9.5,  maxLtv: 80, maxTerm: 30 },
  { name: 'Banco Provincia', rate: 10.2, maxLtv: 75, maxTerm: 25 },
  { name: 'Santander',       rate: 11.0, maxLtv: 70, maxTerm: 20 },
  { name: 'BBVA',            rate: 10.8, maxLtv: 75, maxTerm: 25 },
]

const fmt = (n: number) => `USD ${Math.round(n).toLocaleString('es-AR')}`
const fmtARS = (n: number) => `$${Math.round(n).toLocaleString('es-AR')}`

/**
 * Valores de arranque del simulador.
 *
 * A diferencia de la calculadora de costos, acá un cero deja la pantalla
 * inservible: no se puede simular un crédito sin monto. Así que arrancamos con
 * un ejemplo y lo decimos con todas las letras, en vez de que parezca tu caso.
 */
const EXAMPLE_PRICE = 185_000
const EXAMPLE_DOWN_PAYMENT_RATE = 0.3

export function FinanciamientoPanel() {
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
  const [usdRate, setUsdRate] = useState(1250)
  const [bankIdx, setBankIdx] = useState(0)

  const bank = banks[bankIdx]
  const downPaymentExceedsPrice = method === 'MORTGAGE' && price > 0 && downPayment > price
  const downPaymentEqualsPrice = method === 'MORTGAGE' && price > 0 && downPayment === price
  const loan = price - downPayment
  const ltv = price > 0 ? (loan / price) * 100 : 0
  const r = bank.rate / 100 / 12
  const n = term * 12
  const monthly = loan > 0 ? loan * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1) : 0
  const totalPaid = monthly * n
  const totalInterest = totalPaid - loan
  const escritura = price * 0.035

  return (
    <div className="">
      <header className="px-4 lg:px-6 pt-8 pb-3">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <Link href="/vara-labs" className="flex items-center gap-1.5 text-slate-400 text-sm"><ArrowLeft size={14} /> VARA Labs</Link>
          </div>
          <span className="text-xs font-bold text-brand-500 tracking-widest uppercase">P4 · Payment Intelligence</span>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-1">Inteligencia financiera</h1>
          <p className="text-sm text-slate-500 mt-1">
            {priceFromProperty
              ? 'Contado vs hipoteca, sobre el precio de tu propiedad'
              : 'Contado vs hipoteca — los valores son un ejemplo, cambialos por los tuyos'}
          </p>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 pt-4 space-y-4">
        {/* Method */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">¿Cómo querés pagar?</p>
          <div className="grid grid-cols-3 gap-2">
            {([['CASH', 'Contado', '💵'], ['MORTGAGE', 'Hipoteca', '🏦'], ['MIXED', 'Mixto', '⚖️']] as [PaymentMethod, string, string][]).map(([m, label, emoji]) => (
              <button key={m} onClick={() => setMethod(m)}
                className={cn('py-3 rounded-xl border text-xs font-semibold transition-all flex flex-col items-center gap-1',
                  method === m ? 'bg-slate-900 border-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:border-slate-300')}>
                <span className="text-lg">{emoji}</span>{label}
              </button>
            ))}
          </div>
        </div>

        {/* Inputs */}
        <div className="bg-white rounded-2xl p-4 shadow-sm space-y-4">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Configurar operación</p>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Precio de la propiedad</label>
            <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2">
              <span className="text-xs text-slate-400">USD</span>
              <input type="number" value={price} onChange={e => { setPrice(+e.target.value); setDownPayment(Math.round(+e.target.value * 0.3)) }} className="flex-1 text-sm font-semibold text-slate-900 focus:outline-none bg-transparent" />
            </div>
          </div>

          {method !== 'CASH' && (
            <>
              <div>
                <div className="flex justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-600">Entrada</label>
                  <span className="text-xs text-slate-400">{Math.round(downPayment / price * 100)}%</span>
                </div>
                <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2">
                  <span className="text-xs text-slate-400">USD</span>
                  <input type="number" value={downPayment} onChange={e => setDownPayment(+e.target.value)} className="flex-1 text-sm font-semibold text-slate-900 focus:outline-none bg-transparent" />
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-600">Plazo</label>
                  <span className="text-xs text-slate-400">{term} años</span>
                </div>
                <input type="range" min={5} max={30} step={5} value={term} onChange={e => setTerm(+e.target.value)} className="w-full accent-amber-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-600 mb-2">Banco</p>
                <div className="space-y-2">
                  {banks.map((b, i) => (
                    <button key={b.name} onClick={() => setBankIdx(i)}
                      className={cn('w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-xs transition-all',
                        bankIdx === i ? 'bg-slate-900 border-slate-900 text-white' : 'border-slate-100 hover:border-slate-200 text-slate-700')}>
                      <span className="font-semibold">{b.name}</span>
                      <div className="flex items-center gap-3">
                        <span className={bankIdx === i ? 'text-amber-400' : 'text-brand-500'}>{b.rate}% TNA</span>
                        <span className="text-slate-400">{b.maxTerm}a máx</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Tipo de cambio USD/ARS</label>
            <div className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2">
              <span className="text-xs text-slate-400">$</span>
              <input type="number" value={usdRate} onChange={e => setUsdRate(+e.target.value)} className="flex-1 text-sm font-semibold text-slate-900 focus:outline-none bg-transparent" />
            </div>
          </div>
        </div>

        {/* Results */}
        {method === 'CASH' && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Resumen — Contado</p>
            <div className="space-y-2">
              {[['Precio', fmt(price)], ['Gastos escritura (~3.5%)', fmt(escritura)]].map(([l, v]) => (
                <div key={l} className="flex justify-between text-sm"><span className="text-slate-500">{l}</span><span className="font-semibold text-slate-700">{v}</span></div>
              ))}
              <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                <span className="font-bold text-slate-900">Total a desembolsar</span>
                <span className="font-extrabold text-slate-900 text-lg">{fmt(price + escritura)}</span>
              </div>
            </div>
            <div className="mt-3 bg-emerald-50 rounded-xl p-3 flex items-start gap-2">
              <CheckCircle2 size={14} className="text-emerald-600 mt-0.5" />
              <p className="text-xs text-emerald-700">Sin intereses, sin dependencia bancaria. La forma más eficiente de comprar si disponés del capital.</p>
            </div>
          </div>
        )}

        {method === 'MORTGAGE' && downPaymentEqualsPrice && (
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle size={16} className="text-slate-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-slate-700">Sin préstamo</p>
              <p className="text-xs text-slate-500 mt-0.5">La entrada cubre el precio completo. No se necesita hipoteca.</p>
            </div>
          </div>
        )}

        {method === 'MORTGAGE' && downPaymentExceedsPrice && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
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
                <p className="text-[10px] text-slate-400 mb-1">Cuota mensual</p>
                <p className="font-extrabold text-slate-900 text-xl">{fmt(monthly)}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{fmtARS(monthly * usdRate)}/mes</p>
              </div>
              <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
                <p className="text-[10px] text-slate-400 mb-1">Préstamo</p>
                <p className="font-extrabold text-slate-900 text-xl">{fmt(loan)}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">LTV: {Math.round(ltv)}%</p>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm space-y-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Desglose completo</p>
              {[['Entrada', fmt(downPayment)], ['Escritura', fmt(escritura)], ['Préstamo', fmt(loan)], [`Intereses (${term}a)`, fmt(totalInterest)], ['Total pagado al banco', fmt(totalPaid)]].map(([l, v]) => (
                <div key={l} className="flex justify-between text-sm"><span className="text-slate-500">{l}</span><span className="font-semibold text-slate-700">{v}</span></div>
              ))}
              <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                <span className="font-bold text-slate-900">Inversión total</span>
                <span className="font-extrabold text-slate-900 text-lg">{fmt(downPayment + escritura + totalPaid)}</span>
              </div>
            </div>
            <div className={cn('rounded-2xl p-4 border', ltv <= bank.maxLtv ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200')}>
              <div className="flex items-start gap-2">
                {ltv <= bank.maxLtv ? <CheckCircle2 size={16} className="text-emerald-600 mt-0.5" /> : <AlertCircle size={16} className="text-red-500 mt-0.5" />}
                <div>
                  <p className={cn('font-semibold text-sm', ltv <= bank.maxLtv ? 'text-emerald-800' : 'text-red-700')}>
                    {ltv <= bank.maxLtv ? `LTV ${Math.round(ltv)}% ✓ — dentro del límite de ${bank.name}` : `LTV ${Math.round(ltv)}% — supera el máximo permitido (${bank.maxLtv}%)`}
                  </p>
                  <p className={cn('text-xs mt-0.5', ltv <= bank.maxLtv ? 'text-emerald-600' : 'text-red-500')}>
                    Ingreso familiar mínimo requerido: {fmt(monthly * 3.3)}/mes
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        {method === 'MIXED' && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Estructura mixta típica en Argentina</p>
            <div className="space-y-3">
              {[
                { label: 'Contado (ARS o USD)', pct: 40, desc: 'Señas, reservas y pagos parciales' },
                { label: 'Hipoteca bancaria', pct: 40, desc: 'UVAs o tasa fija en USD' },
                { label: 'Saldo escritura', pct: 20, desc: 'Cancelado al escriturar' },
              ].map(({ label, pct, desc }) => (
                <div key={label} className="bg-slate-50 rounded-xl p-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-semibold text-slate-900 text-sm">{label}</span>
                    <span className="font-bold text-brand-500 text-sm">{pct}% · {fmt(price * pct / 100)}</span>
                  </div>
                  <p className="text-xs text-slate-400">{desc}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2">
              <Info size={14} className="text-amber-600 mt-0.5" />
              <p className="text-xs text-amber-700">VARA te asiste en coordinar cada tramo con el escribano, el banco y el vendedor.</p>
            </div>
          </div>
        )}

        {/* Crypto P4 */}
        <div className="bg-slate-900 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Bitcoin size={18} className="text-amber-400" />
            <span className="font-bold text-white text-sm">Settlement con activos digitales</span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300">Investigando</span>
          </div>
          <p className="text-slate-400 text-xs leading-relaxed mb-4">VARA evalúa coordinación de operaciones con USDT/USDC a través de proveedores PSAV regulados. VARA como orquestador, nunca custodio de fondos.</p>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {['USDT', 'USDC', 'USD', 'ARS'].map(c => (
              <div key={c} className="bg-slate-800 rounded-xl py-2 text-center">
                <p className="font-bold text-white text-xs">{c}</p>
                <p className="text-[9px] text-slate-500 mt-0.5">{c === 'USDT' || c === 'USDC' ? 'Pronto' : '✓'}</p>
              </div>
            ))}
          </div>
          <Link href="/vara-labs" className="flex items-center gap-1.5 text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors">
            Ver roadmap completo <ChevronRight size={12} />
          </Link>
        </div>
      </div>
    </div>
  )
}
