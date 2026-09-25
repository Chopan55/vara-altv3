'use client'

/**
 * La plata, en un solo lugar.
 *
 * Antes eran tres destinos separados en el menú —Costos, Financiamiento,
 * Precio de venta— y nadie sabía cuál abrir. No es que estuvieran mal
 * hechos: es que las tres preguntas viven en la misma cabeza, el mismo día,
 * y estaban a tres clics distintos.
 *
 * Las pestañas dependen del rol, porque a un comprador no le sirve fijar
 * precio de venta y a un vendedor no le sirve simular un crédito para
 * comprar. Mostrar las dos cosas a todos habría sido volver al problema.
 */

import { Suspense } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, DollarSign, Landmark, Tag } from 'lucide-react'
import { useVaraState } from '@/hooks/useVaraState'
import { CostosPanel } from '@/components/money/CostosPanel'
import { PreciosPanel } from '@/components/money/PreciosPanel'
import { FinanciamientoPanel } from '@/components/money/FinanciamientoPanel'

type MoneyTab = 'costos' | 'financiamiento' | 'precios'

interface TabDef {
  id: MoneyTab
  label: string
  /** Para qué sirve. Es lo que antes había que adivinar desde el menú. */
  hint: string
  icon: React.ElementType
}

const BUY_TABS: TabDef[] = [
  { id: 'costos', label: 'Costos', hint: 'Cuánto vas a pagar además del precio', icon: DollarSign },
  { id: 'financiamiento', label: 'Financiamiento', hint: 'Cómo se puede pagar', icon: Landmark },
]

const SELL_TABS: TabDef[] = [
  { id: 'costos', label: 'Costos', hint: 'Cuánto te queda después de vender', icon: DollarSign },
  { id: 'precios', label: 'Precio de venta', hint: 'A cuánto publicar', icon: Tag },
]

function DineroContent() {
  const vara = useVaraState()
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const isSeller = vara.loaded && vara.journeyType === 'SELL_PROPERTY'
  const tabs = isSeller ? SELL_TABS : BUY_TABS

  const requested = searchParams.get('tab')
  const active: MoneyTab = tabs.some(t => t.id === requested)
    ? (requested as MoneyTab)
    : tabs[0].id

  // La pestaña va en la URL para que se pueda compartir y volver atrás.
  const go = (tab: MoneyTab) => router.replace(`${pathname}?tab=${tab}`, { scroll: false })

  const current = tabs.find(t => t.id === active) ?? tabs[0]

  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="px-4 lg:px-6 pt-8 pb-3">
        <div className="max-w-4xl mx-auto">
          <Link href="/dashboard"
            className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-sm mb-4 transition-colors">
            <ArrowLeft size={14} /> Volver al inicio
          </Link>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Dinero</h1>
          <p className="text-sm text-slate-500 mt-1">{current.hint}</p>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4">
        <div className="flex items-center gap-1.5 border-b border-slate-200/70">
          {tabs.map(t => {
            const Icon = t.icon
            const on = t.id === active
            return (
              <button
                key={t.id} onClick={() => go(t.id)}
                aria-current={on ? 'page' : undefined}
                className={`flex items-center gap-1.5 text-sm font-semibold px-3 py-2.5 border-b-2 -mb-px transition-colors ${
                  on
                    ? 'border-brand-600 text-brand-700'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}>
                <Icon size={14} /> {t.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="pb-8">
        {active === 'costos' && <CostosPanel />}
        {active === 'financiamiento' && <FinanciamientoPanel />}
        {active === 'precios' && <PreciosPanel />}
      </div>
    </div>
  )
}

export default function DineroPage() {
  // useSearchParams necesita un límite de Suspense o falla el prerender.
  return (
    <Suspense fallback={null}>
      <DineroContent />
    </Suspense>
  )
}
