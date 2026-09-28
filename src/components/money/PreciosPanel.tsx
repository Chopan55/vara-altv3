'use client'

/**
 * A cuánto publicar.
 *
 * Esta pantalla mostraba un análisis de mercado completo —comparables,
 * posición, recomendación— armado con datos inventados detrás de un botón de
 * "ver un ejemplo". Era honesto en la forma: avisaba. Pero era la última
 * parte del producto donde alguien podía ver un número de mercado que no
 * existía.
 *
 * Ahora muestra la comparación real y nada más. Si no hay avisos cargados, no
 * hay análisis — que es exactamente la situación en la que está alguien que
 * todavía no juntó referencias.
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Tag, ArrowRight } from 'lucide-react'
import { MarketComparison } from '@/components/comparables/MarketComparison'
import type { PropertyCandidate } from '@/lib/candidates/model'

export function PreciosPanel() {
  const [mine, setMine] = useState<PropertyCandidate | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let alive = true
    import('@/lib/candidates/store')
      .then(m => m.loadCandidates())
      .then(list => {
        if (!alive) return
        setMine(list.find(c => c.price > 0 && c.status !== 'DISCARDED') ?? null)
      })
      .catch(() => { /* sin propiedad cargada, el panel igual sirve */ })
      .finally(() => { if (alive) setLoaded(true) })
    return () => { alive = false }
  }, [])

  return (
    <div className="max-w-4xl mx-auto px-4 py-4 space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200/70 shadow-card p-4">
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-50 flex items-center justify-center flex-shrink-0">
            <Tag size={15} className="text-brand-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">A cuánto publicar</p>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
              {loaded && mine
                ? `Tu propiedad: ${mine.currency} ${mine.price.toLocaleString('es-AR')}${mine.surface > 0 ? ` · ${mine.surface} m²` : ' · falta la superficie'}`
                : loaded
                  ? 'Todavía no tenés una propiedad cargada con precio.'
                  : '—'}
            </p>
          </div>
        </div>

        {loaded && !mine && (
          <Link href="/propiedades"
            className="flex items-center gap-1.5 mt-3 text-xs font-semibold text-brand-600 hover:text-brand-700">
            Cargar mi propiedad <ArrowRight size={12} />
          </Link>
        )}

        {loaded && mine && !(mine.surface > 0) && (
          <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mt-3 leading-relaxed">
            Sin la superficie no se puede calcular el precio por m², que es lo único
            que compara honestamente propiedades de distinto tamaño. Completala en la ficha.
          </p>
        )}
      </div>

      <MarketComparison />

      <div className="bg-slate-50 rounded-2xl px-4 py-3.5">
        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide mb-1.5">
          Qué NO te decimos
        </p>
        <p className="text-xs text-slate-600 leading-relaxed">
          Cuánto vale tu propiedad. Eso lo dice una tasación hecha por alguien que
          la fue a ver — no un promedio de avisos. Lo que sí podemos mostrarte es
          dónde cae tu precio frente a lo que se está pidiendo por propiedades
          parecidas, que es un dato verificable y sirve para decidir.
        </p>
      </div>
    </div>
  )
}
